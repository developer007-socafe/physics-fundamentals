/* Physics Fundamentals — simulations.js
   Auto-initializes any <canvas data-sim="name"> with interactive sims.
   Each sim exports init(canvas, ctx) returning controls + frame(dt).
   Supports pause/step/reset and live parameter sliders. */

(function (global) {
  'use strict';

  const simulations = {};

  function register(name, factory) {
    simulations[name] = factory;
  }

  // ---- Shared helpers ---------------------------------------------------
  function line(ctx, x1, y1, x2, y2, color = '#333', width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function circle(ctx, x, y, r, fill = '#333') {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function rect(ctx, x, y, w, h, fill = '#eee') {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  // ---- Pendulum ---------------------------------------------------------
  register('pendulum', function (canvas, ctx) {
    let L = 180, g = 9.81, damp = 0.02, theta = 1.2, omega = 0;
    let playing = true, t = 0;
    return {
      params: {
        length: { v: L, min: 40, max: 260, step: 1 },
        gravity: { v: g, min: 2, max: 20, step: 0.1 },
        damping: { v: damp, min: 0, max: 0.2, step: 0.005 },
      },
      frame(dt) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const Lnow = this.params.length.v;
        const gnow = this.params.gravity.v;
        const dnow = this.params.damping.v;
        // sync external params once (they are mutated in place by UI)
        if (playing) {
          const a = (-gnow / Lnow) * Math.sin(theta) - dnow * omega;
          omega += a * dt * 6;
          theta += omega * dt * 6;
          t += dt * 6;
        }
        const cx = w / 2, cy = 50;
        const bx = cx, by = cy + 20;
        const angle = theta;
        const bobx = bx + Lnow * Math.sin(angle);
        const boby = by + Lnow * Math.cos(angle);
        // rod + pivot
        line(ctx, bx, by, bobx, boby, '#555', 2);
        circle(ctx, bx, by - 2, 6, '#888');
        // trail
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 40; i++) {
          const a = angle + (i / 40 - 0.5) * 0.4;
          ctx.lineTo(bx + Lnow * Math.sin(a), by + Lnow * Math.cos(a));
        }
        ctx.stroke();
        // bob
        circle(ctx, bobx, boby, 14, '#2563eb');
        circle(ctx, bobx, boby, 6, '#fff');
        // energy bar
        const E = 0.5 * omega * omega * Lnow * Lnow + gnow * Lnow * (1 - Math.cos(theta));
        rect(ctx, 0, h - 6, w * Math.min(E / 200, 1), 6, '#2563eb');
      },
      reset() { theta = 1.2; omega = 0; t = 0; }
    };
  });

  // ---- Projectile motion ------------------------------------------------
  register('projectile', function (canvas, ctx) {
    let v0 = 30, angle = 45, g = 9.81;
    let x = 0, y = 0, vx = 0, vy = 0, active = false, t = 0;
    return {
      params: {
        speed: { v: v0, min: 5, max: 80, step: 1 },
        angle: { v: angle, min: 10, max: 85, step: 1 },
        gravity: { v: g, min: 2, max: 20, step: 0.1 },
      },
      frame(dt) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const gnow = this.params.gravity.v;
        const scale = 6; // px per meter
        const ground = h - 40;
        line(ctx, 0, ground, w, ground, '#333', 2);
        if (!active) {
          this.launch();
        } else if (y >= ground) {
          // flying
          t += dt * 10;
          x = vx * t;
          y = ground - (vy * t - 0.5 * gnow * t * t);
        }
        // trail
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= t * 10; i++) {
          const tt = i / 10;
          const xx = vx * tt;
          const yy = ground - (vy * tt - 0.5 * gnow * tt * tt);
          if (yy <= ground) ctx.lineTo(xx * scale, yy);
        }
        ctx.stroke();
        // projectile
        circle(ctx, x * scale, y, 8, '#2563eb');
        if (y >= ground && t > 0) {
          // mark landing
          circle(ctx, x * scale, y, 6, '#ef4444');
          ctx.fillStyle = '#555';
          ctx.font = '13px sans-serif';
          ctx.fillText(`Range: ${(vx * t).toFixed(1)} m`, x * scale + 12, y + 4);
        }
      },
      launch() {
        const a = this.params.angle.v * Math.PI / 180;
        const sp = this.params.speed.v;
        vx = sp * Math.cos(a);
        vy = sp * Math.sin(a);
        x = 0; y = 0; t = 0;
        active = true;
      },
      reset() { active = false; x = 0; y = 0; t = 0; this.launch(); }
    };
  });

  // ---- Wave interference (two sources) ----------------------------------
  register('wave', function (canvas, ctx) {
    let sep = 120, freq = 0.04, speed = 0.06, phase = 0, t = 0;
    return {
      params: {
        separation: { v: sep, min: 40, max: 240, step: 2 },
        frequency: { v: freq, min: 0.01, max: 0.1, step: 0.005 },
        speed: { v: speed, min: 0.02, max: 0.15, step: 0.005 },
      },
      frame(dt) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        t += dt * 6;
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        const f = this.params.frequency.v;
        const c = this.params.speed.v;
        const s = this.params.separation.v;
        const x1 = w / 2 - s / 2;
        const x2 = w / 2 + s / 2;
        const y0 = h / 2;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            const d1 = Math.sqrt((x - x1) ** 2 + (y - y0) ** 2);
            const d2 = Math.sqrt((x - x2) ** 2 + (y - y0) ** 2);
            const a1 = Math.sin(f * d1 - c * t);
            const a2 = Math.sin(f * d2 - c * t + phase);
            const amp = (a1 + a2) / 2;
            const idx = (y * w + x) * 4;
            const val = Math.round(127 + 127 * amp);
            // color map: blue (trough) -> white (zero) -> red (peak) ... use blue-ish
            const r = Math.round(180 + 60 * amp);
            const gval = Math.round(180 - 120 * Math.abs(amp));
            const b = Math.round(220 - 80 * amp);
            data[idx] = Math.max(0, Math.min(255, r));
            data[idx + 1] = Math.max(0, Math.min(255, gval));
            data[idx + 2] = Math.max(0, Math.min(255, b));
            data[idx + 3] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        // sources
        circle(ctx, x1, y0, 5, '#ef4444');
        circle(ctx, x2, y0, 5, '#ef4444');
      },
      reset() { t = 0; }
    };
  });

  // ---- Ideal gas in a box -----------------------------------------------
  register('gas', function (canvas, ctx) {
    let n = 80, speed = 3, T = 1;
    const particles = [];
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * 400, y: Math.random() * 300,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      });
    }
    return {
      params: {
        temperature: { v: T, min: 0.2, max: 2, step: 0.1 },
        particles: { v: n, min: 20, max: 150, step: 5 },
      },
      frame(dt) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);
        const temp = this.params.temperature.v;
        const targetN = this.params.particles.v;
        while (particles.length > targetN) particles.pop();
        while (particles.length < targetN) {
          particles.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
          });
        }
        particles.forEach((p) => {
          const sdt = speed * temp;
          p.vx += (Math.random() - 0.5) * 0.02;
          p.vy += (Math.random() - 0.5) * 0.02;
          p.x += p.vx * sdt;
          p.y += p.vy * sdt;
          if (p.x < 0 || p.x > w) { p.vx *= -0.98; p.x = Math.max(0, Math.min(w, p.x)); }
          if (p.y < 0 || p.y > h) { p.vy *= -0.98; p.y = Math.max(0, Math.min(h, p.y)); }
          circle(ctx, p.x, p.y, 3, '#2563eb');
        });
        // pressure indicator (collisions)
        const ke = particles.reduce((a, p) => a + 0.5 * (p.vx ** 2 + p.vy ** 2), 0);
      },
      reset() { particles.length = 0; for (let i = 0; i < n; i++) particles.push({x: Math.random()*400, y: Math.random()*300, vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2}); }
    };
  });

  // ---- Electric field lines ---------------------------------------------
  register('field', function (canvas, ctx) {
    let q1 = 1, q2 = -1, sep = 120;
    return {
      params: {
        charge1: { v: q1, min: -2, max: 2, step: 0.1 },
        charge2: { v: q2, min: -2, max: 2, step: 0.1 },
        separation: { v: sep, min: 40, max: 240, step: 4 },
      },
      frame() {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const c1 = { x: w / 2 - this.params.separation.v / 2, y: h / 2 };
        const c2 = { x: w / 2 + this.params.separation.v / 2, y: h / 2 };
        const q = [this.params.charge1.v, this.params.charge2.v];
        // field grid
        const step = 10;
        for (let y = step; y < h; y += step) {
          for (let x = step; x < w; x += step) {
            const fx = q[0] * (x - c1.x) / ((x - c1.x) ** 2 + (y - c1.y) ** 2 + 1) ** 1.5
                       + q[1] * (x - c2.x) / ((x - c2.x) ** 2 + (y - c2.y) ** 2 + 1) ** 1.5;
            const fy = q[0] * (y - c1.y) / ((x - c1.x) ** 2 + (y - c1.y) ** 2 + 1) ** 1.5
                       + q[1] * (y - c2.y) / ((x - c2.x) ** 2 + (y - c2.y) ** 2 + 1) ** 1.5;
            const mag = Math.sqrt(fx * fx + fy * fy);
            if (mag < 0.5 || mag > 8) continue;
            const ang = Math.atan2(fy, fx);
            const len = Math.min(mag * 6, 14);
            const hue = Math.max(0, Math.min(260, 220 - mag * 20));
            ctx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2);
            ctx.lineTo(x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2);
            ctx.stroke();
          }
        }
        // charges
        circle(ctx, c1.x, c1.y, 10 + Math.abs(q[0]), q[0] > 0 ? '#ef4444' : '#38bdfa');
        circle(ctx, c2.x, c2.y, 10 + Math.abs(q[1]), q[1] > 0 ? '#ef4444' : '#38bdfa');
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText(`+${q[0]}`, c1.x - 6, c1.y - 14);
        ctx.fillText(`${q[1]}`, c2.x - 6, c2.y - 14);
      },
      reset() { /* params reset by UI */ }
    };
  });

  // ---- Light clock (relativity) -----------------------------------------
  register('lightclock', function (canvas, ctx) {
    let v = 0;
    return {
      params: {
        velocity: { v: 0, min: 0, max: 0.9, step: 0.02 },
      },
      frame() {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const beta = this.params.velocity.v;
        const gamma = 1 / Math.sqrt(1 - beta * beta) || 1;
        const d = 150; // clock separation (moving frame sees diagonal)
        const L = beta > 0 ? d / gamma : d;
        // mirrors
        line(ctx, 40, h / 2 - L, 40, h / 2 + L, '#555', 3);
        line(ctx, w - 60, h / 2 - d / 2, w - 60, h / 2 + d / 2, '#555', 3);
        // photon path (lab frame): longer diagonal path
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const x0 = 40, x1 = w - 60;
        ctx.moveTo(x0, h / 2 - L);
        ctx.lineTo(x1, h / 2 - d / 2);
        ctx.lineTo(x0, h / 2 + L);
        ctx.lineTo(x1, h / 2 + d / 2);
        ctx.stroke();
        circle(ctx, x0, h / 2 - L, 5, '#f59e0b');
        // info
        ctx.fillStyle = '#555';
        ctx.font = '13px sans-serif';
        ctx.fillText(`β = ${beta.toFixed(2)} (v/c)`, 10, 20);
        ctx.fillText(`γ = ${gamma.toFixed(2)}`, 10, 38);
        ctx.fillText(`Lab-frame path longer by γ`, 10, h - 12);
      },
      reset() { this.params.velocity.v = 0; }
    };
  });

  // ---- Quantum tunneling -----------------------------------------------
  register('tunnel', function (canvas, ctx) {
    let E = 0.6, V = 1;
    return {
      params: {
        energy: { v: 0.6, min: 0.1, max: 1.5, step: 0.05 },
        barrier: { v: 1, min: 0.5, max: 2, step: 0.05 },
      },
      frame() {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const E = this.params.energy.v;
        const V = this.params.barrier.v;
        // barrier
        rect(ctx, w / 2 - 10, h / 2 - 50, 20, 100, '#d97706');
        // transmission
        let T;
        if (E > V) {
          const k = Math.sqrt(E * E - V * V);
          T = 1 / (1 + (V * V * Math.sin(k * 10) ** 2) / (4 * E * E - 4 * V * V * Math.cos(k * 10) ** 2) || 0);
          T = Math.max(0, Math.min(1, T));
        } else {
          const kappa = Math.sqrt(V * V - E * E);
          T = 1 / (1 + (V * V * Math.sinh(kappa * 10) ** 2) / (4 * E * (V * V - E * E)) || 0);
          T = Math.max(0, Math.min(1, 1 / (1 + (V * V) / (4 * E * (V * V - E * E)) * Math.exp(2 * kappa * 10))));
        }
        // wavefunction sketch
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const xi = x / w;
          let y;
          if (x < w / 2 - 10) y = Math.sin(xi * 8 * Math.PI) * 30;
          else if (x < w / 2 + 10) {
            const decay = Math.exp(-Math.sqrt(Math.max(0, V * V - E * E)) * (x - (w / 2 - 10)) / 10);
            y = Math.sin((w / 2 - 10) / w * 8 * Math.PI) * 30 * decay;
          } else y = Math.sin(xi * 8 * Math.PI) * 30 * T;
          ctx.lineTo(x, h / 2 + y);
        }
        ctx.stroke();
        // labels
        ctx.fillStyle = '#555';
        ctx.font = '13px sans-serif';
        ctx.fillText(`E = ${E.toFixed(2)}`, 10, 20);
        ctx.fillText(`V = ${V.toFixed(2)}`, 10, 38);
        ctx.fillStyle = '#2563eb';
        ctx.fillText(`Transmission T ≈ ${(T * 100).toFixed(1)}%`, w / 2, 20);
      },
      reset() { this.params.energy.v = 0.6; this.params.barrier.v = 1; }
    };
  });

  // ---- Generic harness --------------------------------------------------
  function makeControls(sim, container) {
    const wrap = document.createElement('div');
    wrap.className = 'controls';
    wrap.innerHTML = '';
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.className = 'btn-sm';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'btn-sm';
    const stepBtn = document.createElement('button');
    stepBtn.textContent = 'Step';
    stepBtn.className = 'btn-sm';
    wrap.append(pauseBtn, resetBtn, stepBtn);
    const keys = Object.keys(sim.params);
    keys.forEach((k) => {
      const label = document.createElement('label');
      label.textContent = `${k}: `;
      const input = document.createElement('input');
      input.type = 'range';
      const p = sim.params[k];
      input.min = p.min; input.max = p.max; input.step = p.step;
      input.value = p.v;
      const val = document.createElement('span');
      val.textContent = String(p.v);
      input.addEventListener('input', () => {
        p.v = parseFloat(input.value);
        val.textContent = input.value;
      });
      label.append(input, val);
      wrap.appendChild(label);
    });
    container.appendChild(wrap);
    return { pauseBtn, resetBtn, stepBtn };
  }

  let pauseAll = false;
  function initCanvas(canvas) {
    const name = canvas.getAttribute('data-sim');
    if (!name || !simulations[name]) {
      console.warn('Unknown simulation:', name);
      return;
    }
    const factory = simulations[name];
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(rect.width, 480) || 560;
    canvas.height = Math.max(rect.height, 320) || 360;
    const ctx = canvas.getContext('2d');
    const sim = factory(canvas, ctx);
    const container = canvas.parentElement;
    const controls = makeControls(sim, container);

    let last = null;
    let running = true;
    controls.pauseBtn.addEventListener('click', () => { running = !running; controls.pauseBtn.textContent = running ? 'Pause' : 'Resume'; });
    controls.resetBtn.addEventListener('click', () => sim.reset());
    controls.stepBtn.addEventListener('click', () => { sim.frame(1 / 60); });

    function loop(ts) {
      if (!last) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      if (running && !pauseAll) {
        sim.frame(dt);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Auto-init all simulation canvases on the page
  global.PhysicsSims = { initCanvas, register, makeControls };
  function autoInit() {
    document.querySelectorAll('canvas[data-sim]').forEach(initCanvas);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : {});
