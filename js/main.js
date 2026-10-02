/* Physics Fundamentals — main.js
   Theme toggle, mobile nav, scroll animations, and client-side search. */

(function () {
  'use strict';

  const root = document.documentElement;
  const STORAGE_KEY = 'physics-theme';
  const SEARCH_INDEX_KEY = 'PHYSICS_SEARCH_INDEX';

  /* ------------------------------------------------------------------ */
  /* Theme toggle                                                       */
  /* ------------------------------------------------------------------ */
  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', () =>
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mobile menu                                                        */
  /* ------------------------------------------------------------------ */
  function initMenu() {
    const btn = document.querySelector('.menu-btn');
    const menu = document.getElementById('topicMenu');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    // clicking anywhere outside the menu closes it
    document.addEventListener('click', (e) => {
      if (menu.hidden) return;
      if (!menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        btn.focus();
      }
    });

    setOpen(false);
  }

  /* ------------------------------------------------------------------ */
  /* Scroll-driven animations                                           */
  /* ------------------------------------------------------------------ */
  function initReveal() {
    const items = document.querySelectorAll('.fade-in');
    if (!items.length) return;
    const onScroll = () => {
      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.85) {
          el.classList.add('visible');
        }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Active nav link                                                    */
  /* ------------------------------------------------------------------ */
  function initActiveLink() {
    const here = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a').forEach((a) => {
      const href = a.getAttribute('href').split('/').pop();
      if (href === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Client-side search                                                 */
  /* ------------------------------------------------------------------ */
  function loadSearchIndex() {
    return new Promise((resolve) => {
      if (window[SEARCH_INDEX_KEY]) return resolve(window[SEARCH_INDEX_KEY]);
      const s = document.createElement('script');
      s.src = 'js/search-data.js';
      s.onload = () => resolve(window[SEARCH_INDEX_KEY] || []);
      s.onerror = () => resolve([]);
      document.head.appendChild(s);
    });
  }

  function initSearch() {
    // Anchor to the header bar, not .nav — the theme toggle now lives inside
    // the dropdown, so inserting before it would hide the search box.
    const header = document.querySelector('.header-inner');
    if (!header) return;
    // The search-data module is loaded dynamically (js/search-data.js).
    // Once it populates window.PHYSICS_SEARCH_INDEX, we build the UI.
    loadSearchIndex().then((index) => {
      if (index && index.length) buildSearchUI(header, index);
    });
  }

  function buildSearchUI(header, index) {
    if (header.querySelector('.search-box')) return;
    const wrap = document.createElement('div');
    wrap.className = 'search-box';
    wrap.innerHTML =
      '<input type="search" class="search-input" placeholder="Search topics…" aria-label="Search">' +
      '<div class="search-results" role="listbox"></div>';
    header.appendChild(wrap);

    const input = wrap.querySelector('.search-input');
    const results = wrap.querySelector('.search-results');
    let active = -1;
    let items = [];

    function render(matches) {
      active = -1;
      items = matches.slice(0, 8);
      results.innerHTML = '';
      if (!items.length) {
        results.style.display = 'none';
        return;
      }
      results.style.display = 'block';
      items.forEach((it, i) => {
        const a = document.createElement('a');
        a.href = it.url;
        a.className = 'search-item';
        a.setAttribute('role', 'option');
        a.innerHTML =
          '<span class="search-title">' + escapeHtml(it.title) + '</span>' +
          '<span class="search-url">' + escapeHtml(it.url) + '</span>';
        if (i === 0) a.setAttribute('aria-selected', 'true');
        results.appendChild(a);
      });
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function highlight(text, query) {
      if (!query) return escapeHtml(text);
      const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return escapeHtml(text).replace(re, '<mark>$1</mark>');
    }

    // Re-render with highlighting on each keystroke
    function doSearch() {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.style.display = 'none';
        items = [];
        return;
      }
      const matches = index
        .filter((it) => {
          const hay = (it.title + ' ' + it.description + ' ' + it.terms).toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => {
          const ta = a.title.toLowerCase().includes(q);
          const tb = b.title.toLowerCase().includes(q);
          return tb - ta;
        })
        .map((it) => ({
          title: highlight(it.title, q),
          url: it.url,
          description: highlight(it.description, q),
          terms: it.terms
        }));
      render(matches);
    }

    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = Math.min(active + 1, items.length - 1);
        updateActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(active - 1, 0);
        updateActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[active]) {
          window.location.href = items[active].url;
        }
      } else if (e.key === 'Escape') {
        results.style.display = 'none';
        input.value = '';
        items = [];
      }
    });

    function updateActive() {
      document.querySelectorAll('.search-item').forEach((a, i) => {
        a.setAttribute('aria-selected', i === active);
        a.classList.toggle('active', i === active);
        if (i === active) a.scrollIntoView({ block: 'nearest' });
      });
    }

    // Click a result
    results.addEventListener('click', (e) => {
      const a = e.target.closest('.search-item');
      if (a) window.location.href = a.href;
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        results.style.display = 'none';
      }
    });

    // Ctrl+K / / shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        input.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                               */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMenu();
    initReveal();
    initActiveLink();
    initSearch();
  });
})();
