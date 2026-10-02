# Physics Fundamentals

An educational, interactive website explaining the fundamentals of physics — a
free, ad-free, curiosity-driven guide covering mechanics through modern physics.

Built as a static site (HTML, CSS, vanilla JavaScript) with no build step and no
framework, so it loads fast and works everywhere.

## Topics

1. **Classical Mechanics** — kinematics, Newton's laws, energy, momentum,
   rotation, oscillations, projectile motion
2. **Thermodynamics** — heat, work, entropy, kinetic theory, ideal gas law, the
   four laws, heat engines and Carnot efficiency
3. **Electromagnetism** — electric charge & Coulomb's law, fields & potentials,
   circuits, magnetism, Maxwell's equations, optics
4. **Waves & Oscillations** — wave equation, superposition, interference,
   standing waves, sound, the Doppler effect
5. **Quantum Mechanics** — Planck's quantum, wave–particle duality, the
   Schrödinger equation, uncertainty, tunneling
6. **Relativity** — special & general relativity, spacetime, time dilation, the
   light-clock, black holes, cosmology
7. **Modern Physics** — atomic models, Bohr model, nuclear physics, the Standard
   Model, the origin of mass, open questions

## Features

- **Scholarly, readable design** — a "paper-like" theme with a light/dark mode
  toggle (saved to `localStorage`)
- **Math rendered with MathJax** — equations look clean and print-quality
- **Glossary tooltips** — hover bolded terms for quick definitions
- **Interactive simulations** — playable canvas simulations (projectile motion,
  pendulum, two-source interference, ideal gas, electric field lines, quantum
  tunneling, relativistic light clock)
- **Client-side search** — type `/` or `Ctrl+K` to search topics instantly, or
  use the search box in the header
- **Responsive** — mobile menu + full mobile layout; scales from phones to
  4K displays

## File structure

```
physics-fundamentals/
├── index.html
├── mechanics.html
├── thermodynamics.html
├── electromagnetism.html
├── waves.html
├── quantum.html
├── relativity.html
├── modern-physics.html
├── css/
│   ├── reset.css
│   └── style.css
├── js/
│   ├── main.js          # theme toggle, nav, scroll anims, search
│   ├── search-data.js   # client-side search index
│   └── simulations.js   # interactive canvas physics sims
└── img/                 # (images, if added)
```

## Running locally

No server is required — open `index.html` directly in a browser.

```sh
cd ~/Projects/physics-fundamentals
python3 -m http.server 8080   # then visit http://localhost:8080
```

(Serving over HTTP helps MathJax load and avoids any local-file CORS quirks.)

## Simulation reference

The `simulations.js` framework auto-initializes any
`<canvas data-sim="name">`. Available simulations:

| Name        | Topic            | What it shows                                   |
|-------------|------------------|-------------------------------------------------|
| `projectile`| Mechanics        | Projectile motion; find the 45° max-range angle |
| `pendulum`  | Mechanics        | Simple pendulum; effect of length, gravity, damping |
| `wave`      | Waves            | Two-source interference; path-difference fringes |
| `gas`       | Thermodynamics   | Ideal gas in a box; pressure from molecular impacts |
| `field`     | Electromagnetism | Electric field lines of two charges               |
| `lightclock`| Relativity       | Time dilation via the moving light-clock        |
| `tunnel`    | Quantum          | Quantum tunneling through a potential barrier   |

## License

This project is an educational resource. Provided as-is for learning.
