/* Physics Fundamentals — live-data.js
   Three free, no-auth, CORS-enabled public APIs, rendered with plain
   DOM calls. Every element is created with createElement and every
   string that comes from a network response is written with
   textContent, so remote data can never become markup.

     1. NASA Astronomy Picture of the Day  -> index.html   (#apod-*)
     2. USGS real-time earthquake feed     -> mechanics.html(#quake-*)
     3. ISS live sub-satellite point       -> index.html   (#iss-*)

   Guarantees for every request:
     - AbortController with a hard 8s ceiling
     - explicit non-2xx handling
     - a visible plain-text message on any failure, replacing the
       "contacting..." status line, so nothing is ever left blank
     - no spinners, no layout that depends on a successful response
*/

(function () {
  'use strict';

  var TIMEOUT_MS = 8000;
  var MAG_FLOOR = 4.5;
  var MAX_QUAKES = 8;

  /* NASA's endpoint intermittently returns 500 for anonymous requests, so
     try a documented no-key mirror of the same service as a second option.
     Both are tried before the user is told anything failed. */
  var APOD_URLS = [
    'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY',
    'https://apod.as93.net/apod'
  ];
  var QUAKE_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
  /* Same endpoint, scheme tried https-first because the site is served
     over https on GitHub Pages and a plain http:// fetch from an https
     page is blocked as mixed content. The documented http:// URL is
     still used as the fallback. */
  var ISS_URLS = [
    'https://api.open-notify.org/iss-now.json',
    'http://api.open-notify.org/iss-now.json'
  ];
  /* This service returns only latitude and longitude. It does not report
     altitude or velocity, so those fields are declared absent up front
     rather than shown as broken values. */
  var ISS_FIELDS_ABSENT = 'not reported by this service';

  var OFFLINE_HINT = 'Live feeds need an internet connection and this page served over http(s) — open the site through a local server rather than a file:// path.';

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function byId(id) {
    return document.getElementById(id);
  }

  /* Writes a status line. isError recolours it as a warning. */
  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message;
    if (isError) node.classList.add('is-error');
    else node.classList.remove('is-error');
  }

  function failureMessage(label, err) {
    var why = err && err.message ? err.message : 'unknown error';
    return label + ' unavailable (' + why + '). ' + OFFLINE_HINT;
  }

  /* API strings occasionally carry stray markup. Drop any tags from the
     TEXT ONLY, then hand the result to textContent. */
  function plain(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasFetch() {
    return typeof window.fetch === 'function' &&
      typeof window.AbortController === 'function';
  }

  /* fetch + JSON with an 8s AbortController ceiling. Rejects with a
     readable message on timeout, network error or non-2xx status. */
  function getJSON(url) {
    return new Promise(function (resolve, reject) {
      if (!hasFetch()) {
        reject(new Error('this browser has no fetch/AbortController support'));
        return;
      }
      var controller = new AbortController();
      var settled = false;

      function fail(message) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error(message));
      }

      var timer = window.setTimeout(function () {
        try { controller.abort(); } catch (e) { /* older engines */ }
        fail('no response within ' + (TIMEOUT_MS / 1000) + 's');
      }, TIMEOUT_MS);

      window.fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors'
      }).then(function (res) {
        if (!res.ok) {
          fail('server replied HTTP ' + res.status +
            (res.statusText ? ' ' + res.statusText : ''));
          return;
        }
        return res.json().then(function (data) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(data);
        }, function () {
          fail('response was not valid JSON');
        });
      }).catch(function (err) {
        fail(err && err.name === 'AbortError' ? 'request aborted' : 'network error');
      });
    });
  }

  /* Tries each URL in turn (used for the ISS endpoint, which is served
     over both schemes). Rejects with the last readable error. */
  function getJSONFrom(list) {
    var urls = Array.isArray(list) ? list.slice() : [list];
    function attempt(i) {
      return getJSON(urls[i]).catch(function (err) {
        if (i < urls.length - 1) return attempt(i + 1);
        throw err;
      });
    }
    return attempt(0);
  }

  /* ------------------------------------------------------------------ */
  /* 1. NASA — Astronomy Picture of the Day                             */
  /* ------------------------------------------------------------------ */

  function initAPOD() {
    var status = byId('apod-status');
    if (!status) return;

    var figure = byId('apod-figure');
    var media = byId('apod-media');
    var link = byId('apod-media-link');
    var title = byId('apod-title');
    var explanation = byId('apod-explanation');
    var meta = byId('apod-meta');

    setStatus(status, 'Contacting the NASA APOD service…', false);

    getJSONFrom(APOD_URLS).then(function (data) {
      var headline = plain(data && data.title);
      var date = plain(data && data.date);
      var kind = plain(data && data.media_type).toLowerCase();
      var url = plain(data && data.url);
      var credit = plain(data && data.copyright);

      if (!headline || !url) {
        setStatus(status, 'NASA APOD returned an incomplete record. Try again later.', true);
        return;
      }

      if (title) title.textContent = headline;

      if (explanation) {
        explanation.textContent = plain(data.explanation) ||
          'No caption was supplied with today’s picture.';
      }

      if (media && figure) {
        figure.hidden = false;
        if (kind === 'image') {
          var img = document.createElement('img');
          img.className = 'apod-media';
          img.alt = 'Astronomy Picture of the Day: ' + headline;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.src = url;
          /* A dead image URL must not leave an empty box. */
          img.addEventListener('error', function () {
            media.textContent = '';
            media.appendChild(document.createTextNode(
              'The picture itself could not be loaded from ' + url));
          });
          media.appendChild(img);
          if (link) {
            link.hidden = false;
            link.href = url;
            link.textContent = 'Open the full-resolution image';
          }
        } else {
          /* Videos, GIFs and interactive pages: offer the link only. */
          var note = document.createElement('p');
          note.className = 'live-body';
          note.textContent = 'Today’s APOD is a ' + (kind || 'non-image') +
            ' item, so there is no still picture to show here.';
          media.appendChild(note);
          if (link) {
            link.hidden = false;
            link.href = url;
            link.textContent = 'Open today’s ' + (kind || 'APOD') + ' at apod.nasa.gov';
          }
        }
      }

      if (meta) {
        var bits = ['NASA APOD', date];
        if (credit) bits.push(credit.replace(/^\s*\(|\)\s*$/g, ''));
        bits.push('DEMO_KEY rate limits apply');
        meta.textContent = bits.filter(Boolean).join('  ·  ');
      }

      setStatus(status, 'Live — fetched ' + date + '.', false);
    }).catch(function (err) {
      setStatus(status, failureMessage('NASA Astronomy Picture of the Day', err), true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2. USGS — significant earthquakes in the last day                   */
  /* ------------------------------------------------------------------ */

  function fmtUTC(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return 'time unknown';
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function magLabel(mag) {
    if (mag < 5) return 'Moderate';
    if (mag < 6) return 'Strong';
    if (mag < 7) return 'Major';
    if (mag < 8) return 'Great';
    return 'Very great';
  }

  function initQuakes() {
    var status = byId('quake-status');
    var list = byId('quake-list');
    var count = byId('quake-count');
    if (!status && !list) return;

    if (status) setStatus(status, 'Contacting the USGS earthquake feed…', false);

    getJSON(QUAKE_URL).then(function (data) {
      var features = data && Array.isArray(data.features) ? data.features : [];
      var rows = features
        .map(function (f) {
          var p = (f && f.properties) || {};
          return {
            mag: typeof p.mag === 'number' ? p.mag : null,
            place: plain(p.place) || 'Location unreported',
            time: p.time,
            url: plain(p.url),
            type: plain(p.type)
          };
        })
        .filter(function (r) { return r.mag !== null && r.mag >= MAG_FLOOR; })
        .sort(function (a, b) { return b.mag - a.mag; });

      if (count) {
        count.textContent = rows.length
          ? rows.length + ' event' + (rows.length === 1 ? '' : 's') + ' at M' +
            MAG_FLOOR.toFixed(1) + ' or above in the last 24 h'
          : 'No events at M' + MAG_FLOOR.toFixed(1) + ' or above in the last 24 h';
        /* The summary line is written even when the list is empty, so it has
           to be revealed here — otherwise it stays behind `hidden` while
           carrying the "quiet day" message the reader actually needs. */
        count.hidden = false;
      }

      if (!list) return;

      list.textContent = '';
      if (!rows.length) {
        var empty = document.createElement('li');
        empty.className = 'live-body';
        empty.textContent = 'The feed responded normally but listed no quakes of ' +
          'magnitude ' + MAG_FLOOR.toFixed(1) + ' or greater in the past day. ' +
          'That is a quiet day for the planet, not a failure.';
        list.appendChild(empty);
        if (status) setStatus(status, 'Live — quiet 24 hours on the seismic network.', false);
        return;
      }

      rows.slice(0, MAX_QUAKES).forEach(function (r) {
        var li = document.createElement('li');

        var head = document.createElement('div');
        var mag = document.createElement('span');
        mag.className = 'qmag';
        mag.textContent = 'M ' + r.mag.toFixed(1) + '  ' + magLabel(r.mag);
        var place = document.createElement('span');
        place.className = 'qplace';
        place.textContent = ' — ' + r.place;
        head.appendChild(mag);
        head.appendChild(place);
        li.appendChild(head);

        var when = document.createElement('span');
        when.className = 'qtime';
        when.textContent = fmtUTC(r.time);
        li.appendChild(when);

        if (r.url) {
          var more = document.createElement('a');
          more.className = 'qtime';
          more.href = r.url;
          more.target = '_blank';
          more.rel = 'noopener noreferrer';
          more.textContent = 'USGS event page →';
          li.appendChild(more);
        }

        list.appendChild(li);
      });

      if (rows.length > MAX_QUAKES) {
        var more2 = document.createElement('li');
        more2.className = 'qtime';
        more2.textContent = '+ ' + (rows.length - MAX_QUAKES) +
          ' further event' + (rows.length - MAX_QUAKES === 1 ? '' : 's') + ' not shown.';
        list.appendChild(more2);
      }

      if (status) {
        setStatus(status, 'Live — ' + rows.length + ' event' +
          (rows.length === 1 ? '' : 's') + ' above magnitude ' +
          MAG_FLOOR.toFixed(1) + ' in the USGS "all day" feed.', false);
      }
    }).catch(function (err) {
      setStatus(status, failureMessage('USGS earthquake feed', err), true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. ISS — live sub-satellite point                                  */
  /* ------------------------------------------------------------------ */

  function initISS() {
    var status = byId('iss-status');
    if (!status) return;

    var dot = byId('iss-dot');
    var latEl = byId('iss-lat');
    var lonEl = byId('iss-lon');
    var altEl = byId('iss-alt');
    var velEl = byId('iss-vel');
    var verdictEl = byId('iss-verdict');
    var stamp = byId('iss-stamp');

    setStatus(status, 'Contacting the ISS position service…', false);

    getJSONFrom(ISS_URLS).then(function (data) {
      var pos = data && data.iss_position;
      if (!pos) {
        setStatus(status, 'The ISS service replied without a position. Try again shortly.', true);
        return;
      }
      var lat = Number(pos.latitude);
      var lon = Number(pos.longitude);
      if (!isFinite(lat) || !isFinite(lon)) {
        setStatus(status, 'The ISS service returned a position this page could not read.', true);
        return;
      }

      if (latEl) latEl.textContent = (lat >= 0 ? '+' : '−') + Math.abs(lat).toFixed(3) + '°';
      if (lonEl) lonEl.textContent = (lon >= 0 ? '+' : '−') + Math.abs(lon).toFixed(3) + '°';

      var alt = Number(pos.altitude_km);
      if (altEl) {
        altEl.textContent = isFinite(alt)
          ? alt.toFixed(1) + ' km above sea level'
          : ISS_FIELDS_ABSENT;
      }
      var vel = Number(pos.velocity);
      if (velEl) {
        velEl.textContent = isFinite(vel)
          ? vel.toFixed(2) + ' km/h (' + (vel * 1000 / 3600).toFixed(2) + ' km/s)'
          : ISS_FIELDS_ABSENT;
      }

      /* Computed indicator: drop the sub-satellite point on an
         equirectangular graticule (latitude is a plain fraction of the
         box height, longitude wraps at ±180°). */
      if (dot && dot.setAttribute) {
        var x = (lon + 180) / 360;
        var y = (90 - lat) / 180;
        dot.setAttribute('cx', (x * 100).toFixed(2) + '%');
        dot.setAttribute('cy', (y * 100).toFixed(2) + '%');
        var track = byId('iss-track-line');
        if (track) {
          track.setAttribute('d', 'M 0 25 L ' + (x * 100).toFixed(2) + ' ' +
            (y * 100).toFixed(2));
        }
      }

      /* Reveal the results panel. Without this the freshly filled
         values stay hidden behind the `hidden` attribute. */
      var wrap = byId('iss-track');
      if (wrap) wrap.hidden = false;

      if (verdictEl) {
        var band = Math.abs(lat);
        var where;
        if (band > 66.5) {
          where = 'over a polar region';
        } else if (lat >= 0) {
          where = 'over the northern hemisphere';
        } else {
          where = 'over the southern hemisphere';
        }
        var clock = new Date();
        var local = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        verdictEl.textContent = 'The station is ' + where +
          ' at ' + Math.abs(lat).toFixed(1) + '° ' +
          (lat >= 0 ? 'north' : 'south') + ', ' +
          Math.abs(lon).toFixed(1) + '° ' + (lon >= 0 ? 'east' : 'west') +
          '. Page clock reads ' + local + ' local time.';
      }

      /* The feed reports a Unix timestamp in SECONDS, which must be
         scaled to milliseconds before it can be formatted as a date.
         Without this the page shows 21 Jan 1970. */
      var when = Number(data.timestamp) * 1000;
      if (stamp) stamp.textContent = fmtUTC(when);

      setStatus(status, 'Live — sub-satellite point updated ' + fmtUTC(when) + '.', false);
    }).catch(function (err) {
      setStatus(status, failureMessage('ISS position feed', err), true);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    /* Each widget only runs when its markup is on the page, so this one
       file is safe to load on every page of the site. */
    initAPOD();
    initQuakes();
    initISS();
  });
})();