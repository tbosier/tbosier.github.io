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

  /* --- Hero: a (3,5) torus knot ----------------------------------------- */
  /* A closed curve that winds 3 times around the axis of the torus and 5
     times around its core. Because 3 and 5 are coprime it closes into a
     single strand that cannot be untangled into a circle — a genuine knot,
     not a loop that merely looks tangled.

       x = (R + r·cos(q t))·cos(p t)
       y = (R + r·cos(q t))·sin(p t)
       z =        r·sin(q t)

     Drawn across two canvases that sandwich the portrait, so the strand
     passes in front of the photo on its near pass and behind on its far one —
     which is what makes the over-and-under legible.

     (A Hopf fibration was tried here first. Its fibres are genuine circles —
     verified planar to 1e-16 — but they are large and eccentric relative to
     one another, so at this size the union reads as loose swooping lines
     rather than linked rings. The knot is compact and centred.) */

  function initKnot() {
    var host = document.querySelector("[data-knot]");
    if (!host) return;

    var back = host.querySelector(".knot--back");
    var front = host.querySelector(".knot--front");
    if (!back || !front || !back.getContext) return;

    var bctx = back.getContext("2d");
    var fctx = front.getContext("2d");

    var P = 3, Q = 5;        // winds 3 one way, 5 the other
    var R = 1, TUBE = 0.36;
    var STEPS = 620;
    var TILT = 0.46;
    var FOCAL = 6.5;
    var BUCKETS = 7;

    var size = 0, dpr = 1, lineRGB = "43,127,212";

    /* The curve is fixed; only the viewing rotation changes. */
    var pts = new Float64Array(STEPS * 3);
    var maxR = 0;
    (function build() {
      for (var k = 0; k < STEPS; k++) {
        var t = 2 * Math.PI * k / STEPS;
        var rad = R + TUBE * Math.cos(Q * t);
        var x = rad * Math.cos(P * t);
        var y = rad * Math.sin(P * t);
        var z = TUBE * Math.sin(Q * t);
        pts[k * 3] = x; pts[k * 3 + 1] = y; pts[k * 3 + 2] = z;
        var m = Math.sqrt(x * x + y * y + z * z);
        if (m > maxR) maxR = m;
      }
    })();

    var CT = Math.cos(TILT), ST = Math.sin(TILT);
    var px = 0, py = 0, pz = 0;
    /* Spin about the torus's own axis, then a fixed tilt. Yawing about Y
       instead would swing the knot edge-on twice a turn and its structure
       would never settle; this way the silhouette holds and the strand
       travels around it. */
    function project(x, y, z, cosA, sinA) {
      var x1 = x * cosA - y * sinA;
      var y1 = x * sinA + y * cosA;
      var y2 = y1 * CT - z * ST;
      var z2 = y1 * ST + z * CT;
      var sc = FOCAL / (FOCAL + z2);
      px = x1 * sc; py = y2 * sc; pz = z2;
    }

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
    }

    function resize() {
      var rect = host.getBoundingClientRect();
      size = Math.round(Math.min(rect.width, rect.height));
      if (!size) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      [back, front].forEach(function (cv) {
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
        cv.style.width = size + "px";
        cv.style.height = size + "px";
      });
      return true;
    }

    function render(angle) {
      var reach = maxR * (FOCAL / (FOCAL - maxR));
      var half = size / 2, scale = (size * 0.485) / reach;
      var cosY = Math.cos(angle), sinY = Math.sin(angle);

      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, size, size);
      fctx.clearRect(0, 0, size, size);

      var paths = [];
      for (var i = 0; i < BUCKETS * 2; i++) paths.push(new Path2D());

      var lx = 0, ly = 0, lz = 0, have = false;
      for (var k = 0; k <= STEPS; k++) {
        var j = (k % STEPS) * 3;
        project(pts[j], pts[j + 1], pts[j + 2], cosY, sinY);

        if (have) {
          var z = (lz + pz) / 2;
          var t = (z + maxR) / (2 * maxR);
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var bi = Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));
          var path = paths[(z > 0 ? BUCKETS : 0) + bi];
          path.moveTo(half + lx * scale, half + ly * scale);
          path.lineTo(half + px * scale, half + py * scale);
        }
        lx = px; ly = py; lz = pz; have = true;
      }

      for (var b = 0; b < BUCKETS * 2; b++) {
        var isFront = b >= BUCKETS;
        var level = (b % BUCKETS) / (BUCKETS - 1);
        var ctx = isFront ? fctx : bctx;
        // The near pass crosses the photo, so it is drawn lighter.
        var alpha = (0.16 + level * 0.62) * (isFront ? 0.62 : 1);
        ctx.strokeStyle = "rgba(" + lineRGB + "," + alpha.toFixed(3) + ")";
        ctx.lineWidth = 1.0 + level * 1.1;
        ctx.lineCap = "round";
        ctx.stroke(paths[b]);
      }
    }

    var angle = 0.4;
    var running = false, last = 0, accum = 0;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      angle += dt * 0.00015;
      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;
      render(angle);
    }

    function start() {
      if (running || prefersReduced()) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    readColours();
    if (!resize()) return;
    render(angle);
    if (!prefersReduced()) start();

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

    new MutationObserver(function () {
      readColours();
      render(angle);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Figure panel ------------------------------------------------------ */
  /* Three scenes in one panel, drawn on canvas as real figures: a Bayesian
     forecast, an MCMC posterior, and gradient descent on a loss surface.
     Each is an actual computation, not a canned animation.

     Colour follows the sequential rule: one hue, light to dark, with all text
     in ink tokens rather than the series colour. Values are read from the CSS
     custom properties so both themes stay in step. */

  function initFigure() {
    var panel = document.querySelector("[data-figure]");
    if (!panel) return;

    var canvas = panel.querySelector(".figure__canvas");
    var caption = panel.querySelector("[data-figure-caption]");
    var tabs = Array.prototype.slice.call(panel.querySelectorAll("[data-scene]"));
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1;
    var C = {};

    function readColours() {
      var cs = getComputedStyle(document.documentElement);
      function v(name, fallback) { return (cs.getPropertyValue(name) || "").trim() || fallback; }
      C.brand = v("--brand", "#2b7fd4");
      C.brandStrong = v("--brand-strong", "#1a63ad");
      C.ink = v("--ink", "#0d2436");
      C.muted = v("--ink-muted", "#557189");
      C.faint = v("--ink-faint", "#8aa2b6");
      C.line = v("--line", "#d9e6f2");
      C.surface = v("--bg-elevated", "#ffffff");
    }

    function rgba(hex, a) {
      hex = (hex || "").replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (isNaN(n)) return "rgba(43,127,212," + a + ")";
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      surfaceCache = null;
      return true;
    }

    function begin() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
    }

    /* Plot area: a little room for the baseline and direct labels. */
    var PAD = { l: 10, r: 10, t: 22, b: 18 };
    function px(f) { return PAD.l + f * (W - PAD.l - PAD.r); }
    function py(f) { return PAD.t + f * (H - PAD.t - PAD.b); }

    function label(text, x, y, colour, align) {
      ctx.font = "500 10.5px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colour;
      ctx.fillText(text, x, y);
    }

    /* ---- seeded randomness -------------------------------------------- */

    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function gauss(rand) {
      var u = 1 - rand(), v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    /* =================================================================== */
    /* 1. Bayesian forecast                                                 */
    /*    Conjugate Normal linear model on the observed series, then draws   */
    /*    from the posterior predictive, then the 95% credible band.        */
    /* =================================================================== */

    var NH = 34, NF = 20, NT = NH + NF;
    var obs = new Float64Array(NH);
    var pA, pB, pS2, pSxx, pTbar, yLo, yHi;

    (function fit() {
      var rand = mulberry32(20260910), i;
      for (i = 0; i < NH; i++) obs[i] = 2.4 + 0.108 * i + gauss(rand) * 0.62;

      var sy = 0, st = 0;
      for (i = 0; i < NH; i++) { sy += obs[i]; st += i; }
      var ybar = sy / NH; pTbar = st / NH;

      var sxx = 0, sxy = 0;
      for (i = 0; i < NH; i++) {
        var d = i - pTbar;
        sxx += d * d; sxy += d * (obs[i] - ybar);
      }
      pSxx = sxx; pB = sxy / sxx; pA = ybar - pB * pTbar;

      var rss = 0;
      for (i = 0; i < NH; i++) { var r = obs[i] - (pA + pB * i); rss += r * r; }
      pS2 = rss / (NH - 2);

      var lo = Infinity, hi = -Infinity;
      for (i = 0; i < NH; i++) { if (obs[i] < lo) lo = obs[i]; if (obs[i] > hi) hi = obs[i]; }
      var end = pA + pB * (NT - 1), sd = Math.sqrt(pS2);
      yHi = Math.max(hi, end) + 3.2 * sd;
      yLo = lo - 1.8 * sd;
    })();

    var fSamples = [];     // one array of draws per forecast step
    for (var fi = 0; fi < NF; fi++) fSamples.push([]);
    var fPaths = [];       // a few kept whole, drawn as spaghetti
    var fDraws = 0, fCycle = -1, fRand = mulberry32(7), fQuant = null;

    function fx(t) { return px(t / (NT - 1)); }
    function fy(y) { return py((yHi - y) / (yHi - yLo)); }

    function drawFromPosterior() {
      var dof = NH - 2, chi = 0, i, z;
      for (i = 0; i < dof; i++) { z = gauss(fRand); chi += z * z; }
      var s2 = (dof * pS2) / chi, s = Math.sqrt(s2);
      var b = pB + gauss(fRand) * Math.sqrt(s2 / pSxx);
      var a = pA + gauss(fRand) * Math.sqrt(s2 * (1 / NH + pTbar * pTbar / pSxx));

      var path = fPaths.length < 22 ? [] : null;
      for (i = 0; i < NF; i++) {
        var y = a + b * (NH + i) + gauss(fRand) * s;
        fSamples[i].push(y);
        if (path) path.push(y);
      }
      if (path) fPaths.push(path);
      fDraws++;
      fQuant = null;
    }

    function quantiles() {
      if (fQuant) return fQuant;
      fQuant = [];
      for (var i = 0; i < NF; i++) {
        var a = fSamples[i].slice().sort(function (p, q) { return p - q; });
        fQuant.push({
          lo: a[Math.floor(a.length * 0.025)],
          mid: a[Math.floor(a.length * 0.5)],
          hi: a[Math.floor(a.length * 0.975)]
        });
      }
      return fQuant;
    }

    var F_PERIOD = 15;
    var N_DRAWS = 2000;

    function sceneForecast(t) {
      var phase = t % F_PERIOD, cycle = Math.floor(t / F_PERIOD), i;
      if (cycle !== fCycle) {
        fCycle = cycle;
        for (i = 0; i < NF; i++) fSamples[i].length = 0;
        fPaths.length = 0; fDraws = 0; fRand = mulberry32(7); fQuant = null;
      }

      // Baseline and the observed/forecast divider.
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.l, H - PAD.b + 0.5); ctx.lineTo(W - PAD.r, H - PAD.b + 0.5);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(C.faint, 0.75);
      ctx.beginPath();
      ctx.moveTo(fx(NH - 0.5), PAD.t - 6); ctx.lineTo(fx(NH - 0.5), H - PAD.b);
      ctx.stroke();
      ctx.restore();

      // Phase 1 — the observed series arrives.
      var shown = Math.min(NH, Math.floor(phase / 2.4 * NH) + 1);

      if (phase >= 2.7) {
        // Phase 2 — draw a fixed N from the posterior predictive. It stops at
        // N rather than counting forever: the point of the figure is that the
        // band widens with the horizon, not how many draws were taken.
        if (fDraws < N_DRAWS) {
          for (i = 0; i < 30 && fDraws < N_DRAWS; i++) drawFromPosterior();
        }

        // Spaghetti: a handful of whole trajectories, kept thin and faint.
        ctx.strokeStyle = rgba(C.brand, 0.14);
        ctx.lineWidth = 1;
        for (i = 0; i < fPaths.length; i++) {
          ctx.beginPath();
          ctx.moveTo(fx(NH - 1), fy(obs[NH - 1]));
          for (var j = 0; j < NF; j++) ctx.lineTo(fx(NH + j), fy(fPaths[i][j]));
          ctx.stroke();
        }
      }

      // Phase 3 — the credible band and the median, once N is reached.
      if (fDraws >= N_DRAWS) {
        var q = quantiles();

        ctx.fillStyle = rgba(C.brand, 0.2);
        ctx.beginPath();
        ctx.moveTo(fx(NH - 1), fy(obs[NH - 1]));
        for (i = 0; i < NF; i++) ctx.lineTo(fx(NH + i), fy(q[i].hi));
        for (i = NF - 1; i >= 0; i--) ctx.lineTo(fx(NH + i), fy(q[i].lo));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = C.brandStrong; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx(NH - 1), fy(obs[NH - 1]));
        for (i = 0; i < NF; i++) ctx.lineTo(fx(NH + i), fy(q[i].mid));
        ctx.stroke();

      }

      // Observed points last, so they sit on top.
      ctx.fillStyle = C.ink;
      for (i = 0; i < shown; i++) {
        ctx.beginPath();
        ctx.arc(fx(i), fy(obs[i]), 1.9, 0, Math.PI * 2);
        ctx.fill();
      }

      label("posterior predictive", PAD.l, PAD.t - 10, C.muted, "left");

      /* Legend goes top-left: the series rises to the right, so that corner
         is the empty one. Identity never rests on colour alone. */
      if (fDraws >= N_DRAWS) {
        legend([
          { kind: "dot", colour: C.ink, text: "observed" },
          { kind: "line", colour: C.brandStrong, text: "median" },
          { kind: "area", colour: rgba(C.brand, 0.3), text: "95% credible" }
        ], PAD.l + 2, PAD.t + 12);
      }
    }

    /* A compact legend, drawn downwards from (x, y). */
    function legend(items, x, y) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var cy2 = y + i * 13;
        ctx.fillStyle = it.colour;
        ctx.strokeStyle = it.colour;
        if (it.kind === "line") {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, cy2); ctx.lineTo(x + 13, cy2);
          ctx.stroke();
        } else if (it.kind === "area") {
          ctx.fillRect(x, cy2 - 4, 13, 8);
        } else {
          ctx.beginPath();
          ctx.arc(x + 6, cy2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        label(it.text, x + 18, cy2, C.muted, "left");
      }
    }

    /* =================================================================== */
    /* 2. Posterior via random-walk Metropolis                              */
    /* =================================================================== */

    var cx = 0, cy = 0, mDraws = 0, mAcc = 0, mPts = [];

    function logTarget(x, y) {
      var by = y + 0.45 * (x * x - 1.6);
      return -(x * x) / 1.5 - (by * by) / 0.5;
    }
    function resetChain() { cx = 0; cy = 0; mDraws = 0; mAcc = 0; mPts = []; }
    resetChain();

    function scenePosterior() {
      var cur = logTarget(cx, cy), n;
      for (n = 0; n < 90; n++) {
        var qx = cx + (Math.random() - 0.5) * 1.1;
        var qy = cy + (Math.random() - 0.5) * 0.9;
        var lp = logTarget(qx, qy);
        if (Math.log(Math.random()) < lp - cur) { cx = qx; cy = qy; cur = lp; mAcc++; }
        mDraws++;
        mPts.push(cx, cy);
      }
      if (mPts.length > 24000) mPts.splice(0, mPts.length - 24000);

      ctx.fillStyle = rgba(C.brand, 0.14);
      for (var i = 0; i < mPts.length; i += 2) {
        var X = px((mPts[i] + 3) / 6);
        var Y = py(1 - (mPts[i + 1] + 2.2) / 4.4);
        ctx.fillRect(X, Y, 1.6, 1.6);
      }

      // The chain's current position.
      ctx.fillStyle = C.brandStrong;
      ctx.beginPath();
      ctx.arc(px((cx + 3) / 6), py(1 - (cy + 2.2) / 4.4), 3, 0, Math.PI * 2);
      ctx.fill();

      label("posterior draws", PAD.l, PAD.t - 10, C.muted, "left");
      if (mDraws > 120000) resetChain();
    }

    /* =================================================================== */
    /* 3. Gradient descent on a loss surface                                */
    /*    The surface never changes, so it is rendered once to an offscreen  */
    /*    canvas and blitted; only the path is redrawn.                      */
    /* =================================================================== */

    var U0 = -1.8, U1 = 2.0, V0 = -0.8, V1 = 2.6;
    function loss(u, v) { var d = v - u * u; return (1 - u) * (1 - u) + 11 * d * d; }

    var surfaceCache = null;

    function buildSurface() {
      var off = document.createElement("canvas");
      off.width = Math.round(W); off.height = Math.round(H);
      var o = off.getContext("2d");
      var img = o.createImageData(off.width, off.height);
      var d = img.data;

      var base = C.brand.replace("#", "");
      if (base.length === 3) base = base[0] + base[0] + base[1] + base[1] + base[2] + base[2];
      var bn = parseInt(base, 16);
      var br = bn >> 16 & 255, bg = bn >> 8 & 255, bb = bn & 255;

      for (var y = 0; y < off.height; y++) {
        var v = V1 - (y / off.height) * (V1 - V0);
        for (var x = 0; x < off.width; x++) {
          var u = U0 + (x / off.width) * (U1 - U0);
          // Contour banding on log-loss: one hue, light to dark.
          var lv = Math.log(1 + loss(u, v)) * 1.9;
          var band = lv - Math.floor(lv);
          var a = band < 0.3 ? (0.3 - band) / 0.3 * 0.30 + 0.05 : 0.05;
          var i = (y * off.width + x) * 4;
          d[i] = br; d[i + 1] = bg; d[i + 2] = bb; d[i + 3] = (a * 255) | 0;
        }
      }
      o.putImageData(img, 0, 0);
      return off;
    }

    var gu = -1.4, gv = 2.0, gdu = 0, gdv = 0, gStep = 0, gLoss = 0, gTrail = [];

    function resetDescent() {
      gu = -1.45 + (Math.random() - 0.5) * 0.4;
      gv = 2.0 + (Math.random() - 0.5) * 0.4;
      gdu = gdv = 0; gStep = 0; gTrail = [];
    }
    resetDescent();

    function sceneDescent() {
      if (!surfaceCache) surfaceCache = buildSurface();
      ctx.drawImage(surfaceCache, 0, 0, W, H);

      for (var i = 0; i < 3; i++) {
        var du = -2 * (1 - gu) - 44 * gu * (gv - gu * gu);
        var dv = 22 * (gv - gu * gu);
        gdu = 0.9 * gdu - 0.0016 * du;
        gdv = 0.9 * gdv - 0.0016 * dv;
        gu += gdu; gv += gdv; gStep++;

        if (!isFinite(gu) || !isFinite(gv) || gu < U0 || gu > U1 || gv < V0 || gv > V1) {
          resetDescent(); break;
        }
        gTrail.push(gu, gv);
      }
      if (gTrail.length > 2400) gTrail.splice(0, gTrail.length - 2400);
      gLoss = loss(gu, gv);

      function tx(u) { return px((u - U0) / (U1 - U0)); }
      function ty(v) { return py((V1 - v) / (V1 - V0)); }

      ctx.strokeStyle = rgba(C.brandStrong, 0.85);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (i = 0; i < gTrail.length; i += 2) {
        var X = tx(gTrail[i]), Y = ty(gTrail[i + 1]);
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();

      // The optimum, then the current iterate on top of it.
      ctx.strokeStyle = rgba(C.muted, 0.8); ctx.lineWidth = 1.2;
      var ox = tx(1), oy = ty(1);
      ctx.beginPath();
      ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy);
      ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4);
      ctx.stroke();

      ctx.fillStyle = C.brandStrong;
      ctx.strokeStyle = C.surface; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx(gu), ty(gv), 4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      label("loss surface", PAD.l, PAD.t - 10, C.muted, "left");
      if (gStep > 3000) resetDescent();
    }

    /* =================================================================== */

    var SCENES = {
      forecast: {
        draw: function (t) { begin(); sceneForecast(t); },
        caption: function () {
          return "Conjugate Normal posterior over trend and variance, then " +
                 fDraws.toLocaleString("en-US") + " draws from the posterior predictive. " +
                 "The band is the middle 95% of those draws \u2014 it widens with the horizon.";
        }
      },
      posterior: {
        draw: function () { begin(); scenePosterior(); },
        caption: function () {
          return "Random-walk Metropolis on a banana-shaped posterior &mdash; " +
                 mDraws.toLocaleString("en-US") + " draws, " +
                 Math.round(mAcc / Math.max(mDraws, 1) * 100) + "% accepted.";
        }
      },
      descent: {
        draw: function () { begin(); sceneDescent(); },
        caption: function () {
          return "Gradient descent with momentum down a Rosenbrock valley &mdash; step " +
                 gStep.toLocaleString("en-US") + ", loss " + gLoss.toFixed(3) + ".";
        }
      }
    };

    var current = "forecast";
    var clock = 0;

    function setCaption() {
      if (!caption) return;
      var c = SCENES[current].caption;
      caption.innerHTML = typeof c === "function" ? c() : c;
    }

    function select(name) {
      if (!SCENES[name]) return;
      current = name;
      if (name === "posterior") resetChain();
      if (name === "descent") resetDescent();
      if (name === "forecast") fCycle = -1;

      tabs.forEach(function (b) {
        var on = b.getAttribute("data-scene") === name;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });

      SCENES[current].draw(clock);
      setCaption();
    }

    tabs.forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-scene")); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var i = tabs.indexOf(b);
        var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        select(next.getAttribute("data-scene"));
      });
    });

    /* ---- loop --------------------------------------------------------- */

    var running = false, last = 0, accum = 0, tick = 0;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000;

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      SCENES[current].draw(clock);
      if (++tick % 8 === 0) setCaption();
    }

    function start() {
      if (running || prefersReduced()) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    readColours();
    if (!resize()) return;

    if (prefersReduced()) {
      // Wind the scenes to a settled, meaningful frame and hold there.
      clock = 9.6;
      for (var w = 0; w < 500; w++) drawFromPosterior();
      select(current);
    } else {
      select(current);
      start();
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(panel);
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (resize()) SCENES[current].draw(clock);
      }, 150);
    });

    new MutationObserver(function () {
      readColours();
      surfaceCache = null;
      SCENES[current].draw(clock);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Routing: a pickup-and-delivery dispatch, solved live -------------- */
  /* A real (small) solve, not a scripted animation:
       1. an instance is generated — a depot, paired pickup/delivery orders,
          and a fleet;
       2. candidate routes (columns) are built by randomised cheapest-insertion
          respecting precedence, capacity and the range limit;
       3. a set-partitioning pass picks a least-cost cover of every order;
       4. the trucks drive the routes that were chosen.
     Distances are Euclidean over a board scaled to miles, and every number in
     the readout is measured off the same solution that is drawn. */

  function initRouting() {
    var root = document.querySelector("[data-routing]");
    if (!root) return;

    var canvas = root.querySelector(".routing__canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var stepEls = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });
    var replay = root.querySelector("[data-routing-replay]");

    /* Board is 1,600 x 900 miles; every distance below is in miles. */
    var MILES_W = 1600, MILES_H = 900;
    var MAX_RANGE = 2500, MIN_RANGE = 20;
    var CAPACITY = 3;              // orders on board at once
    var N_ORDERS = 12, N_TRUCKS = 4;
    var COLS_PER_ORDER = 20;   // columns seeded on each order

    var W = 0, H = 0, dpr = 1, C = {};

    function readColours() {
      var cs = getComputedStyle(document.documentElement);
      function v(n, f) { return (cs.getPropertyValue(n) || "").trim() || f; }
      C.brand = v("--brand", "#2b7fd4");
      C.strong = v("--brand-strong", "#1a63ad");
      C.ink = v("--ink", "#0d2436");
      C.muted = v("--ink-muted", "#557189");
      C.faint = v("--ink-faint", "#8aa2b6");
      C.line = v("--line", "#d9e6f2");
      C.surface = v("--bg-elevated", "#ffffff");
    }
    function rgba(hex, a) {
      hex = (hex || "").replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (isNaN(n)) return "rgba(43,127,212," + a + ")";
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      return true;
    }

    var PAD = 26;
    function sx(mx) { return PAD + (mx / MILES_W) * (W - PAD * 2); }
    function sy(my) { return PAD + (my / MILES_H) * (H - PAD * 2); }

    /* ---- instance ----------------------------------------------------- */

    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    var depot, orders, columns, chosen, rng, seed = 1;

    function dist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function buildInstance() {
      rng = mulberry32(seed);
      depot = { x: MILES_W * 0.5, y: MILES_H * 0.5, depot: true };
      orders = [];

      for (var i = 0; i < N_ORDERS; i++) {
        // Pickups spread over the board; each delivery is a plausible haul away.
        var p = {
          x: 90 + rng() * (MILES_W - 180),
          y: 70 + rng() * (MILES_H - 140)
        };
        var ang = rng() * Math.PI * 2;
        var len = 140 + rng() * 420;
        var d = {
          x: Math.min(MILES_W - 70, Math.max(70, p.x + Math.cos(ang) * len)),
          y: Math.min(MILES_H - 60, Math.max(60, p.y + Math.sin(ang) * len))
        };
        orders.push({ id: i, p: p, d: d, miles: dist(p, d) });
      }
    }

    /* ---- 2. columns: randomised cheapest insertion --------------------- */
    /* A column is a feasible route: a stop sequence starting and ending at
       the depot, where every pickup precedes its delivery, the truck never
       holds more than CAPACITY orders, and the tour is within range. */

    function routeMiles(stops) {
      var total = dist(depot, stops[0].pt);
      for (var i = 1; i < stops.length; i++) total += dist(stops[i - 1].pt, stops[i].pt);
      return total + dist(stops[stops.length - 1].pt, depot);
    }

    function feasible(stops) {
      var load = 0, seen = {};
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        if (s.kind === "p") { load++; seen[s.order] = true; if (load > CAPACITY) return false; }
        else { if (!seen[s.order]) return false; load--; }
      }
      var m = routeMiles(stops);
      return m <= MAX_RANGE && m >= MIN_RANGE;
    }

    /* Seeded on a given order so that every order is covered by plenty of
       columns — otherwise the columns all overlap and no disjoint cover
       exists. Sizes are varied for the same reason. */
    function buildColumn(seedId, maxOrders) {
      var pool = [];
      for (var pi = 0; pi < orders.length; pi++) if (orders[pi].id !== seedId) pool.push(orders[pi]);

      var first = orders[seedId];
      var stops = [
        { kind: "p", order: first.id, pt: first.p },
        { kind: "d", order: first.id, pt: first.d }
      ];
      var members = [first.id];

      for (var attempt = 0; attempt < maxOrders - 1; attempt++) {
        if (!pool.length) break;
        var bestCost = Infinity, bestStops = null, bestIdx = -1;

        for (var oi = 0; oi < pool.length; oi++) {
          var o = pool[oi];
          // Try every ordered pair of insertion points for (pickup, delivery).
          for (var i = 0; i <= stops.length; i++) {
            for (var j = i; j <= stops.length; j++) {
              var cand = stops.slice();
              cand.splice(i, 0, { kind: "p", order: o.id, pt: o.p });
              cand.splice(j + 1, 0, { kind: "d", order: o.id, pt: o.d });
              if (!feasible(cand)) continue;
              var cost = routeMiles(cand);
              // A little noise so repeated columns are not all identical.
              cost *= 1 + (rng() - 0.5) * 0.06;
              if (cost < bestCost) { bestCost = cost; bestStops = cand; bestIdx = oi; }
            }
          }
        }
        if (!bestStops) break;
        stops = bestStops;
        members.push(pool[bestIdx].id);
        pool.splice(bestIdx, 1);
      }

      members.sort(function (a, b) { return a - b; });
      return { stops: stops, orders: members, miles: routeMiles(stops) };
    }

    /* ---- 3. set partitioning ------------------------------------------- */
    /* Cheapest cost-per-newly-covered-order, repeated until every order is
       served or the fleet runs out. Columns that overlap an already-served
       order are skipped, so the result is a true partition. */

    function selectColumns() {
      var covered = {}, picked = [], count = 0;

      while (picked.length < N_TRUCKS && count < N_ORDERS) {
        var best = null, bestRatio = Infinity;

        for (var i = 0; i < columns.length; i++) {
          var col = columns[i];
          var fresh = 0, clash = false;
          for (var k = 0; k < col.orders.length; k++) {
            if (covered[col.orders[k]]) { clash = true; break; }
            fresh++;
          }
          if (clash || !fresh) continue;
          var ratio = col.miles / fresh;
          if (ratio < bestRatio) { bestRatio = ratio; best = col; }
        }

        /* No disjoint column left but orders still unserved: build a route
           over what remains, so the fleet always leaves with a full cover. */
        if (!best) {
          var left = [];
          for (var oi = 0; oi < orders.length; oi++) if (!covered[orders[oi].id]) left.push(orders[oi]);
          if (!left.length) break;
          best = routeOver(left);
          if (!best) break;
        }

        for (var k2 = 0; k2 < best.orders.length; k2++) {
          if (!covered[best.orders[k2]]) { covered[best.orders[k2]] = true; count++; }
        }
        picked.push(best);
      }
      return picked;
    }

    /* Cheapest-insertion over a specific set of orders, dropping any that
       cannot be served within range. */
    function routeOver(list) {
      var stops = [
        { kind: "p", order: list[0].id, pt: list[0].p },
        { kind: "d", order: list[0].id, pt: list[0].d }
      ];
      if (!feasible(stops)) return null;
      var members = [list[0].id];

      for (var n = 1; n < list.length; n++) {
        var o = list[n], bestCost = Infinity, bestStops = null;
        for (var i = 0; i <= stops.length; i++) {
          for (var j = i; j <= stops.length; j++) {
            var cand = stops.slice();
            cand.splice(i, 0, { kind: "p", order: o.id, pt: o.p });
            cand.splice(j + 1, 0, { kind: "d", order: o.id, pt: o.d });
            if (!feasible(cand)) continue;
            var cost = routeMiles(cand);
            if (cost < bestCost) { bestCost = cost; bestStops = cand; }
          }
        }
        if (bestStops) { stops = bestStops; members.push(o.id); }
      }
      members.sort(function (a, b) { return a - b; });
      return { stops: stops, orders: members, miles: routeMiles(stops) };
    }

    function solve() {
      buildInstance();
      columns = [];
      for (var o = 0; o < N_ORDERS; o++) {
        for (var rep = 0; rep < COLS_PER_ORDER; rep++) {
          columns.push(buildColumn(o, 2 + ((rng() * 3) | 0)));
        }
      }
      chosen = selectColumns();

      // Pre-compute each chosen route's polyline and cumulative miles, so the
      // dispatch phase can place a truck at any distance along it.
      for (var c = 0; c < chosen.length; c++) {
        var r = chosen[c];
        var pts = [depot].concat(r.stops.map(function (s) { return s.pt; })).concat([depot]);
        var cum = [0];
        for (var k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));
        r.pts = pts;
        r.cum = cum;
      }
    }

    /* ---- drawing ------------------------------------------------------- */

    function marks(showLinks) {
      // Order pairs: pickup filled, delivery hollow, joined by a hairline.
      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        if (showLinks) {
          ctx.strokeStyle = rgba(C.faint, 0.4);
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx(o.p.x), sy(o.p.y));
          ctx.lineTo(sx(o.d.x), sy(o.d.y));
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = rgba(C.ink, 0.75);
        ctx.beginPath();
        ctx.arc(sx(o.p.x), sy(o.p.y), 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rgba(C.ink, 0.55);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sx(o.d.x), sy(o.d.y), 3.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Depot.
      var dx = sx(depot.x), dy = sy(depot.y);
      ctx.fillStyle = C.strong;
      ctx.strokeStyle = C.surface;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 7); ctx.lineTo(dx + 7, dy); ctx.lineTo(dx, dy + 7); ctx.lineTo(dx - 7, dy);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    function routePath(r) {
      ctx.beginPath();
      ctx.moveTo(sx(r.pts[0].x), sy(r.pts[0].y));
      for (var i = 1; i < r.pts.length; i++) ctx.lineTo(sx(r.pts[i].x), sy(r.pts[i].y));
    }

    /* Position along a route at `travelled` miles. */
    function at(r, travelled) {
      var total = r.cum[r.cum.length - 1];
      if (travelled >= total) return { x: r.pts[r.pts.length - 1].x, y: r.pts[r.pts.length - 1].y, leg: r.pts.length - 1 };
      for (var i = 1; i < r.cum.length; i++) {
        if (travelled <= r.cum[i]) {
          var seg = r.cum[i] - r.cum[i - 1] || 1;
          var f = (travelled - r.cum[i - 1]) / seg;
          return {
            x: r.pts[i - 1].x + (r.pts[i].x - r.pts[i - 1].x) * f,
            y: r.pts[i - 1].y + (r.pts[i].y - r.pts[i - 1].y) * f,
            leg: i
          };
        }
      }
      return { x: depot.x, y: depot.y, leg: 0 };
    }

    function truck(x, y, n) {
      var X = sx(x), Y = sy(y);
      ctx.fillStyle = C.strong;
      ctx.strokeStyle = C.surface;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(X, Y, 9, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = C.surface;
      ctx.font = "700 10px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), X, Y + 0.5);
    }

    /* ---- phases -------------------------------------------------------- */

    var T_DATA = 2.6, T_COLS = 6.4, T_PICK = 8.2, T_RUN = 20.5, T_END = 23.5;
    var clock = 0, phase = "";

    function setPhase(name) {
      if (phase === name) return;
      phase = name;
      stepEls.forEach(function (el) {
        el.setAttribute("aria-current", String(el.getAttribute("data-step") === name));
      });
    }
    function stat(key, value) {
      if (out[key]) out[key].textContent = value;
    }

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      var i, r;
      var totalMiles = 0, longest = 0, served = 0;
      for (i = 0; i < chosen.length; i++) {
        totalMiles += chosen[i].miles;
        longest = Math.max(longest, chosen[i].miles);
        served += chosen[i].orders.length;
      }

      if (t < T_DATA) {
        setPhase("data");
        // Orders arrive.
        var shown = Math.min(orders.length, Math.floor(t / T_DATA * orders.length) + 1);
        var keep = orders;
        orders = orders.slice(0, shown);
        marks(true);
        orders = keep;
        stat("orders", shown + " / " + N_ORDERS);
        stat("columns", "0");
        stat("routes", "—");
        stat("miles", "—");
        stat("longest", "—");

      } else if (t < T_COLS) {
        setPhase("columns");
        // Candidate routes flicker past, a window of them at a time.
        var f = (t - T_DATA) / (T_COLS - T_DATA);
        var upto = Math.max(1, Math.floor(f * columns.length));
        ctx.strokeStyle = rgba(C.brand, 0.16);
        ctx.lineWidth = 1;
        for (i = Math.max(0, upto - 7); i < upto; i++) {
          var col = columns[i];
          ctx.beginPath();
          ctx.moveTo(sx(depot.x), sy(depot.y));
          for (var k = 0; k < col.stops.length; k++) ctx.lineTo(sx(col.stops[k].pt.x), sy(col.stops[k].pt.y));
          ctx.lineTo(sx(depot.x), sy(depot.y));
          ctx.stroke();
        }
        marks(true);
        stat("orders", N_ORDERS + " / " + N_ORDERS);
        stat("columns", upto.toLocaleString("en-US"));
        stat("routes", "—");
        stat("miles", "—");
        stat("longest", "—");

      } else if (t < T_PICK) {
        setPhase("select");
        // The cover settles in, one route at a time.
        var g = (t - T_COLS) / (T_PICK - T_COLS);
        var live = Math.min(chosen.length, Math.floor(g * (chosen.length + 0.6)) + 1);
        for (i = 0; i < live; i++) {
          r = chosen[i];
          ctx.strokeStyle = rgba(C.brand, 0.55);
          ctx.lineWidth = 1.8;
          routePath(r);
          ctx.stroke();
        }
        marks(false);
        stat("columns", columns.length.toLocaleString("en-US"));
        stat("routes", live + " of " + chosen.length);
        stat("miles", "—");
        stat("longest", "—");

      } else if (t < T_RUN) {
        setPhase("dispatch");
        var prog = (t - T_PICK) / (T_RUN - T_PICK);
        var driven = 0;

        for (i = 0; i < chosen.length; i++) {
          r = chosen[i];
          var total = r.cum[r.cum.length - 1];
          var travelled = Math.min(total, total * prog);
          driven += travelled;

          // The whole route, faint; the part already driven, solid.
          ctx.strokeStyle = rgba(C.brand, 0.22);
          ctx.lineWidth = 1.6;
          routePath(r);
          ctx.stroke();

          var pos = at(r, travelled);
          ctx.strokeStyle = rgba(C.strong, 0.95);
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(sx(r.pts[0].x), sy(r.pts[0].y));
          for (var s = 1; s < pos.leg; s++) ctx.lineTo(sx(r.pts[s].x), sy(r.pts[s].y));
          ctx.lineTo(sx(pos.x), sy(pos.y));
          ctx.stroke();
        }

        marks(false);
        for (i = 0; i < chosen.length; i++) {
          r = chosen[i];
          var tot = r.cum[r.cum.length - 1];
          var p2 = at(r, Math.min(tot, tot * prog));
          truck(p2.x, p2.y, i + 1);
        }

        stat("routes", chosen.length + " of " + chosen.length);
        stat("miles", Math.round(driven).toLocaleString("en-US") + " mi");
        stat("longest", Math.round(longest).toLocaleString("en-US") + " mi");

      } else {
        setPhase("dispatch");
        for (i = 0; i < chosen.length; i++) {
          r = chosen[i];
          ctx.strokeStyle = rgba(C.strong, 0.8);
          ctx.lineWidth = 2.2;
          routePath(r);
          ctx.stroke();
        }
        marks(false);
        for (i = 0; i < chosen.length; i++) truck(depot.x, depot.y + (i - (chosen.length - 1) / 2) * 26, i + 1);
        stat("miles", Math.round(totalMiles).toLocaleString("en-US") + " mi");
        stat("longest", Math.round(longest).toLocaleString("en-US") + " mi");
      }

      if (t >= T_DATA) stat("served", served + " / " + N_ORDERS);
      else stat("served", "0 / " + N_ORDERS);
    }

    /* ---- loop ---------------------------------------------------------- */

    var running = false, last = 0, accum = 0;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000;
      if (clock > T_END) { seed++; solve(); clock = 0; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;
      render(clock);
    }

    function start() {
      if (running || prefersReduced()) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    if (replay) {
      replay.addEventListener("click", function () {
        seed++; solve(); clock = 0; render(clock);
      });
    }

    readColours();
    if (!resize()) return;
    solve();

    if (prefersReduced()) {
      clock = T_END - 1;      // hold on the finished solution
      render(clock);
    } else {
      render(clock);
      start();
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(root);
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (resize()) render(clock); }, 150);
    });

    new MutationObserver(function () {
      readColours();
      render(clock);
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
    initKnot();
    initFigure();
    initRouting();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
