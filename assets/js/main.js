/* =============================================================================
   Taylor Bosier — site behaviour
   Vanilla JS, no dependencies. Every animation degrades to "instantly done"
   when the visitor asks for reduced motion.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var prefersReduced = function () { return reduceMotion.matches; };

  /* --- Theme ------------------------------------------------------------ */
  /* The initial theme is applied by an inline script in <head> so the page
     never flashes the wrong colours. This only wires up the toggle. */

  function initTheme() {
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    var system = window.matchMedia("(prefers-color-scheme: dark)");

    function label() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      toggle.setAttribute("aria-pressed", String(dark));
    }

    toggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
      label();
    });

    /* Follow the OS unless the visitor has made an explicit choice. */
    system.addEventListener("change", function (e) {
      var stored = null;
      try { stored = localStorage.getItem("theme"); } catch (err) { /* ignore */ }
      if (stored) return;
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      label();
    });

    label();
  }

  /* --- Header: stuck state, scroll progress, back-to-top ---------------- */

  function initScrollChrome() {
    var header = document.querySelector(".site-header");
    var progress = document.querySelector(".progress-bar");
    var toTop = document.querySelector(".to-top");
    var ticking = false;

    function update() {
      var y = window.scrollY || document.documentElement.scrollTop;

      if (header) header.classList.toggle("is-stuck", y > 8);
      if (toTop) toTop.classList.toggle("is-shown", y > window.innerHeight * 0.6);

      if (progress) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
      }
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: prefersReduced() ? "auto" : "smooth" });
      });
    }

    update();
  }

  /* --- Mobile navigation ------------------------------------------------ */

  function initNavToggle() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) close();
    });
  }

  /* --- Scroll reveal ---------------------------------------------------- */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (prefersReduced() || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    /* Stagger siblings inside a shared [data-stagger] parent. */
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      var step = parseInt(group.getAttribute("data-stagger"), 10) || 70;
      group.querySelectorAll(":scope > .reveal").forEach(function (el, i) {
        el.style.setProperty("--reveal-delay", i * step + "ms");
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* --- Timeline spine draws itself as it scrolls into view -------------- */

  function initTimeline() {
    var timeline = document.querySelector(".timeline");
    if (!timeline) return;

    if (prefersReduced() || !("IntersectionObserver" in window)) {
      timeline.style.setProperty("--draw", 1);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        timeline.style.setProperty("--draw", 1);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });

    observer.observe(timeline);
  }

  /* --- Count-up metrics ------------------------------------------------- */

  function initCounters() {
    var counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    function render(el, value) {
      var decimals = parseInt(el.getAttribute("data-decimals"), 10) || 0;
      var text = value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      el.textContent = (el.getAttribute("data-prefix") || "") + text + (el.getAttribute("data-suffix") || "");
    }

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count"));
      if (isNaN(target)) return;

      if (prefersReduced()) { render(el, target); return; }

      var duration = 1500;
      var start = null;

      function frame(now) {
        if (start === null) start = now;
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3); /* easeOutCubic */
        render(el, target * eased);
        if (t < 1) window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      counters.forEach(run);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) {
      render(el, 0);
      observer.observe(el);
    });
  }

  /* --- Cursor spotlight on cards ---------------------------------------- */

  function initSpotlight() {
    if (prefersReduced()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(2) + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(2) + "%");
      });
    });
  }

  /* --- Active section + sliding nav indicator --------------------------- */

  function initSectionTracking() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link[href^="#"]'));
    var indicator = document.querySelector(".nav__indicator");
    if (!links.length) return;

    var sections = links
      .map(function (link) { return document.querySelector(link.getAttribute("href")); })
      .filter(Boolean);
    if (!sections.length) return;

    function moveIndicator(link) {
      if (!indicator || window.innerWidth <= 720) return;
      if (!link) { indicator.style.setProperty("--o", 0); return; }
      indicator.style.setProperty("--x", link.offsetLeft + "px");
      indicator.style.setProperty("--w", link.offsetWidth + "px");
      indicator.style.setProperty("--o", 1);
    }

    function setActive(id) {
      var current = null;
      links.forEach(function (link) {
        var match = link.getAttribute("href") === "#" + id;
        if (match) { link.setAttribute("aria-current", "true"); current = link; }
        else { link.removeAttribute("aria-current"); }
      });
      moveIndicator(current);
    }

    if (!("IntersectionObserver" in window)) return;

    /* Whichever tracked section covers the middle of the viewport wins. */
    var visible = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
        else visible.delete(entry.target.id);
      });

      var best = null;
      var bestRatio = 0;
      visible.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      });
      if (best) setActive(best);
      else if (window.scrollY < 80) setActive("");
    }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] });

    sections.forEach(function (section) { observer.observe(section); });

    window.addEventListener("resize", function () {
      moveIndicator(document.querySelector('.nav__link[aria-current="true"]'));
    });
  }

  /* --- Hero: wireframe torus + orbiting glyphs -------------------------- */
  /* A torus is the canonical object of topology, and it rotates well. It is
     drawn across two canvases that sandwich the portrait, so the near half
     passes in front of the photo and the far half behind it — that overlap is
     what sells the depth. Segments are bucketed by depth and stroked as one
     path per bucket, which keeps a frame to ~16 stroke calls. */

  function initOrbit() {
    var host = document.querySelector("[data-orbit]");
    if (!host) return;

    var back = host.querySelector(".orbit--back");
    var front = host.querySelector(".orbit--front");
    if (!back || !front || !back.getContext) return;

    var bctx = back.getContext("2d");
    var fctx = front.getContext("2d");

    var GLYPHS = ["∂", "∇", "∫", "Σ", "π", "λ",
                  "θ", "≅", "⊗", "ℝ", "μ", "∞"];

    /* The ring lies in the XZ plane — flat, like a planet's rings — so that
       spinning it about Y carries the tube circles and glyphs around the ring
       without changing its silhouette. TILT is how far it is tipped towards
       the viewer: 0 is edge-on, π/2 is face-on. */
    var TILT = 1.02;      // how far the ring is tipped towards the viewer
    var FOCAL = 3.2;      // perspective depth
    var FIT = 0.82;       // shrink so the widest projected point stays inside
    var R = 0.41;         // torus major radius, in box units
    var r = 0.072;        // torus tube radius
    var GLYPH_R = 0.52;   // glyph orbit radius
    var MINOR = 18;       // circles around the tube
    var MAJOR = 2;        // circles the long way round
    var SEG = 14;         // segments per circle
    var BUCKETS = 6;      // depth buckets, one stroked path each
    var FPS = 30;         // the rotation is slow; 30fps halves the raster cost

    var size = 0, dpr = 1;
    var lineRGB = "43,127,212", glyphRGB = "26,99,173";

    function hexToRgb(hex) {
      hex = (hex || "").trim().replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length !== 6) return null;
      var n = parseInt(hex, 16);
      return (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255);
    }

    function readColours() {
      var cs = getComputedStyle(document.documentElement);
      lineRGB = hexToRgb(cs.getPropertyValue("--brand")) || lineRGB;
      glyphRGB = hexToRgb(cs.getPropertyValue("--brand-strong")) || glyphRGB;
    }

    function resize() {
      var rect = host.getBoundingClientRect();
      size = Math.round(Math.min(rect.width, rect.height));
      if (!size) return false;
      /* Capped at 1.5: these are soft wireframe lines, and the extra pixels of
         a 2x buffer cost real raster time for no visible gain. */
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      [back, front].forEach(function (cv) {
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
        cv.style.width = size + "px";
        cv.style.height = size + "px";
      });
      return true;
    }

    /* The tilt never changes, so its sine and cosine are hoisted out of the
       per-point maths — this runs on ~640 points every frame. */
    var CT = Math.cos(TILT), ST = Math.sin(TILT);

    /* Ring and tube angles are fixed too; only the spin varies, so the
       geometry is tabulated once instead of re-derived each frame. */
    var uCos = [], uSin = [], vCos = [], vSin = [], mCos = [], mSin = [];
    var MAJ_SEG = 56;
    (function tabulate() {
      var i, a;
      for (i = 0; i < MINOR; i++) {
        a = (i / MINOR) * Math.PI * 2;
        uCos.push(Math.cos(a)); uSin.push(Math.sin(a));
      }
      for (i = 0; i <= SEG; i++) {
        a = (i / SEG) * Math.PI * 2;
        vCos.push(Math.cos(a)); vSin.push(Math.sin(a));
      }
      for (i = 0; i <= MAJ_SEG; i++) {
        a = (i / MAJ_SEG) * Math.PI * 2;
        mCos.push(Math.cos(a)); mSin.push(Math.sin(a));
      }
    })();

    /* project() returns into these rather than allocating a fresh object per
       point; callers copy out what they need before the next call. */
    var px = 0, py = 0, pz = 0;

    function project(x, y, z, cosA, sinA) {
      var x1 = x * cosA + z * sinA;
      var z1 = -x * sinA + z * cosA;
      var y2 = y * CT - z1 * ST;
      var z2 = y * ST + z1 * CT;
      var s = FOCAL / (FOCAL + z2);
      px = x1 * s; py = y2 * s; pz = z2;
    }

    var MAXZ = R + r;
    var fontCache = {};

    function render(angle) {
      var half = size / 2;
      var scale = size * FIT;
      var cosA = Math.cos(angle), sinA = Math.sin(angle);

      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, size, size);
      fctx.clearRect(0, 0, size, size);

      var paths = [];
      for (var i = 0; i < BUCKETS * 2; i++) paths.push(new Path2D());

      function addSegment(ax, ay, az, bx, by, bz) {
        var z = (az + bz) / 2;
        var t = (z + MAXZ) / (2 * MAXZ);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var idx = Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));
        var path = paths[(z > 0 ? BUCKETS : 0) + idx];
        path.moveTo(half + ax * scale, half + ay * scale);
        path.lineTo(half + bx * scale, half + by * scale);
      }

      var k, j, m, lx, ly, lz, have;

      // Circles around the tube.
      for (k = 0; k < MINOR; k++) {
        var cu = uCos[k], su = uSin[k];
        have = false;
        for (j = 0; j <= SEG; j++) {
          var rad = R + r * vCos[j];
          project(rad * cu, r * vSin[j], rad * su, cosA, sinA);
          if (have) addSegment(lx, ly, lz, px, py, pz);
          lx = px; ly = py; lz = pz; have = true;
        }
      }

      // Circles the long way round.
      for (k = 0; k < MAJOR; k++) {
        var vk = (k / MAJOR) * Math.PI * 2;
        var rr = R + r * Math.cos(vk);
        var zz = r * Math.sin(vk);
        have = false;
        for (m = 0; m <= MAJ_SEG; m++) {
          project(rr * mCos[m], zz, rr * mSin[m], cosA, sinA);
          if (have) addSegment(lx, ly, lz, px, py, pz);
          lx = px; ly = py; lz = pz; have = true;
        }
      }

      for (var b = 0; b < BUCKETS * 2; b++) {
        var isFront = b >= BUCKETS;
        var level = (b % BUCKETS) / (BUCKETS - 1);
        var ctx = isFront ? fctx : bctx;
        ctx.strokeStyle = "rgba(" + lineRGB + "," + (0.10 + level * 0.48).toFixed(3) + ")";
        ctx.lineWidth = 0.8 + level * 0.7;
        ctx.stroke(paths[b]);
      }

      // Glyphs riding a wider orbit in the same plane. Font strings are
      // cached by rounded pixel size — setting ctx.font re-parses it.
      bctx.textAlign = fctx.textAlign = "center";
      bctx.textBaseline = fctx.textBaseline = "middle";

      for (k = 0; k < GLYPHS.length; k++) {
        var gu = angle * 0.65 + (k / GLYPHS.length) * Math.PI * 2;
        project(GLYPH_R * Math.cos(gu), 0, GLYPH_R * Math.sin(gu), 1, 0);
        var depth = (pz + GLYPH_R) / (2 * GLYPH_R);
        depth = depth < 0 ? 0 : depth > 1 ? 1 : depth;
        var ctx2 = pz > 0 ? fctx : bctx;
        var fs = Math.round(size * (0.036 + depth * 0.026));
        var font = fontCache[fs];
        if (!font) font = fontCache[fs] = '500 ' + fs + 'px "Fraunces", Georgia, serif';
        ctx2.font = font;
        ctx2.fillStyle = "rgba(" + glyphRGB + "," + (0.18 + depth * 0.62).toFixed(2) + ")";
        ctx2.fillText(GLYPHS[k], half + px * scale, half + py * scale);
      }
    }

    var angle = 0.6;
    var running = false;
    var last = 0;
    var accum = 0;
    var FRAME_MS = 1000 / FPS;

    /* The angle advances on every tick so the speed stays time-based, but a
       repaint only happens once per FRAME_MS. */
    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);

      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      angle += dt * 0.00016;

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;
      render(angle);
    }

    function start() {
      if (running || prefersReduced()) return;
      running = true;
      last = 0;
      accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    function init() {
      readColours();
      if (!resize()) return;
      render(angle);
      if (!prefersReduced()) start();
    }

    init();

    /* Only animate while the hero is on screen and the tab is visible. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(host);
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (resize()) render(angle); }, 150);
    });

    /* Repaint in the new palette when the theme changes. */
    new MutationObserver(function () {
      readColours();
      render(angle);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Small bits ------------------------------------------------------- */

  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* --- Boot ------------------------------------------------------------- */

  function init() {
    initTheme();
    initScrollChrome();
    initNavToggle();
    initReveal();
    initTimeline();
    initCounters();
    initSpotlight();
    initSectionTracking();
    initOrbit();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
