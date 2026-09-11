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

  /* --- Figure panel ------------------------------------------------------ */
  /* Five scenes in one panel. Four are drawn on a canvas as real figures —
     a Bayesian forecast, an MCMC posterior, a loss surface, and a linear
     program — and the fifth is the ASCII torus. Each is an actual
     computation, not a canned animation.

     Colour follows the sequential rule: one hue, light to dark, with all text
     in ink tokens rather than the series colour. Values are read from the CSS
     custom properties so both themes stay in step. */

  function initFigure() {
    var panel = document.querySelector("[data-figure]");
    if (!panel) return;

    var canvas = panel.querySelector(".figure__canvas");
    var art = panel.querySelector(".figure__ascii");
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

      var path = fPaths.length < 26 ? [] : null;
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

    var F_PERIOD = 14;

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
        // Phase 2 — posterior predictive draws.
        if (phase < 8.4 && fDraws < 900) for (i = 0; i < 7; i++) drawFromPosterior();

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

      // Phase 3 — the credible band and the median.
      if (phase >= 8.4 && fDraws > 40) {
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
      if (phase >= 8.4 && fDraws > 40) {
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
    /* 4. A linear program                                                  */
    /* =================================================================== */

    var LPX = 5.4, LPY = 6.4;
    var LP_POLY = [[0, 0], [3.4, 0], [3.4, 1.2], [2, 4], [0, 5]];
    var LP_C1 = 3, LP_C2 = 2, lpBest = 0, lpBX = 0, lpBY = 0;
    (function () {
      for (var i = 0; i < LP_POLY.length; i++) {
        var val = LP_C1 * LP_POLY[i][0] + LP_C2 * LP_POLY[i][1];
        if (val > lpBest) { lpBest = val; lpBX = LP_POLY[i][0]; lpBY = LP_POLY[i][1]; }
      }
    })();
    var lpValue = 0;

    function sceneSimplex(t) {
      function lx(x) { return px(x / LPX); }
      function ly(y) { return py(1 - y / LPY); }

      // Feasible region.
      ctx.beginPath();
      ctx.moveTo(lx(LP_POLY[0][0]), ly(LP_POLY[0][1]));
      for (var i = 1; i < LP_POLY.length; i++) ctx.lineTo(lx(LP_POLY[i][0]), ly(LP_POLY[i][1]));
      ctx.closePath();
      ctx.fillStyle = rgba(C.brand, 0.13);
      ctx.fill();
      ctx.strokeStyle = rgba(C.brand, 0.55); ctx.lineWidth = 1.4;
      ctx.stroke();

      // Objective sweeping across it, pausing once it reaches the optimum.
      var cyc = (t % 10) / 10;
      var sweep = Math.min(1, cyc / 0.8);
      lpValue = sweep * lpBest;

      // 3x + 2y = k  =>  y = (k - 3x) / 2
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);
      ctx.clip();
      ctx.strokeStyle = rgba(C.brandStrong, 0.9); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx(0), ly(lpValue / LP_C2));
      ctx.lineTo(lx(LPX), ly((lpValue - LP_C1 * LPX) / LP_C2));
      ctx.stroke();
      ctx.restore();

      // Vertices, with the optimum called out once the line arrives.
      for (i = 0; i < LP_POLY.length; i++) {
        var isBest = LP_POLY[i][0] === lpBX && LP_POLY[i][1] === lpBY;
        var hit = isBest && sweep > 0.985;
        ctx.beginPath();
        ctx.arc(lx(LP_POLY[i][0]), ly(LP_POLY[i][1]), hit ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = hit ? C.brandStrong : rgba(C.brand, 0.65);
        ctx.fill();
        if (hit) { ctx.strokeStyle = C.surface; ctx.lineWidth = 2; ctx.stroke(); }
      }

      if (sweep > 0.985) {
        label("optimum", lx(lpBX) + 8, ly(lpBY) - 8, C.brandStrong, "left");
      }
      label("feasible region", PAD.l, PAD.t - 10, C.muted, "left");
    }

    /* =================================================================== */
    /* 5. ASCII torus (donut.c)                                             */
    /* =================================================================== */

    var RAMP = ".,-~:;=!*#$@", RL = RAMP.length - 1;
    var ACOLS = 54, AROWS = 24;
    var abuf = new Array(ACOLS * AROWS), azb = new Float64Array(ACOLS * AROWS);
    var alines = new Array(AROWS);
    var aRatio = 0.5;
    var TH = 90, PH = 200;
    var sinT = new Float64Array(TH), cosT = new Float64Array(TH);
    var sinP = new Float64Array(PH), cosP = new Float64Array(PH);
    (function () {
      var i, a;
      for (i = 0; i < TH; i++) { a = i * 2 * Math.PI / TH; sinT[i] = Math.sin(a); cosT[i] = Math.cos(a); }
      for (i = 0; i < PH; i++) { a = i * 2 * Math.PI / PH; sinP[i] = Math.sin(a); cosP[i] = Math.cos(a); }
    })();

    function fitAscii() {
      if (!art) return;
      var width = art.parentElement.clientWidth;
      if (!width) return;
      var cs = getComputedStyle(art);
      var probe = document.createElement("canvas").getContext("2d");
      probe.font = "100px " + cs.fontFamily;
      var adv = (probe.measureText("M").width / 100) || 0.6;
      var fs = width / (ACOLS * adv);
      art.style.fontSize = fs + "px";
      var lh = parseFloat(cs.lineHeight);
      aRatio = adv / (lh ? lh / fs : 1.05);
    }

    function sceneTorus(t) {
      if (!art) return;
      abuf.fill(" "); azb.fill(0);
      var A = t * 0.7, B = t * 0.3;
      var cosA = Math.cos(A), sinA = Math.sin(A);
      var cosB = Math.cos(B), sinB = Math.sin(B);
      var R1 = 1, R2 = 2, K2 = 5;
      var K1 = ACOLS * K2 * 3 / (8 * (R1 + R2));

      for (var j = 0; j < PH; j++) {
        var cp = cosP[j], sp = sinP[j];
        for (var k = 0; k < TH; k++) {
          var ct = cosT[k], st = sinT[k];
          var ccx = R2 + R1 * ct, ccy = R1 * st;
          var x = ccx * (cosB * cp + sinA * sinB * sp) - ccy * cosA * sinB;
          var y = ccx * (sinB * cp - sinA * cosB * sp) + ccy * cosA * cosB;
          var z = K2 + cosA * ccx * sp + ccy * sinA;
          var ooz = 1 / z;
          var L = cp * ct * sinB - cosA * ct * sp - sinA * st +
                  cosB * (cosA * st - ct * sinA * sp);
          if (L <= 0) continue;

          var col = (ACOLS / 2 + K1 * ooz * x) | 0;
          var row = (AROWS / 2 - K1 * aRatio * ooz * y) | 0;
          if (col < 0 || col >= ACOLS || row < 0 || row >= AROWS) continue;
          var idx = col + ACOLS * row;
          if (ooz <= azb[idx]) continue;
          azb[idx] = ooz;
          var ki = (L / 1.42 * RL) | 0;
          abuf[idx] = RAMP[ki < 0 ? 0 : ki > RL ? RL : ki];
        }
      }
      for (var r = 0; r < AROWS; r++) alines[r] = abuf.slice(r * ACOLS, r * ACOLS + ACOLS).join("");
      art.textContent = alines.join("\n");
    }

    /* =================================================================== */

    var SCENES = {
      forecast: {
        ascii: false,
        draw: function (t) { begin(); sceneForecast(t); },
        caption: function () {
          return "Conjugate Normal posterior over trend and variance, then " +
                 fDraws.toLocaleString("en-US") +
                 " draws from the posterior predictive and a 95% credible band.";
        }
      },
      posterior: {
        ascii: false,
        draw: function () { begin(); scenePosterior(); },
        caption: function () {
          return "Random-walk Metropolis on a banana-shaped posterior &mdash; " +
                 mDraws.toLocaleString("en-US") + " draws, " +
                 Math.round(mAcc / Math.max(mDraws, 1) * 100) + "% accepted.";
        }
      },
      descent: {
        ascii: false,
        draw: function () { begin(); sceneDescent(); },
        caption: function () {
          return "Gradient descent with momentum down a Rosenbrock valley &mdash; step " +
                 gStep.toLocaleString("en-US") + ", loss " + gLoss.toFixed(3) + ".";
        }
      },
      simplex: {
        ascii: false,
        draw: function (t) { begin(); sceneSimplex(t); },
        caption: function () {
          return "A linear program. The objective 3x+2y sweeps the feasible region &mdash; " +
                 "currently " + lpValue.toFixed(1) + " of an optimal " + lpBest.toFixed(1) +
                 ", reached at a vertex.";
        }
      },
      torus: {
        ascii: true,
        draw: function (t) { sceneTorus(t); },
        caption: "A torus shaded by its surface normal &mdash; Andy Sloane&rsquo;s <code>donut.c</code>, rewritten to run here."
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

      var isAscii = SCENES[name].ascii;
      canvas.hidden = isAscii;
      if (art) art.hidden = !isAscii;

      tabs.forEach(function (b) {
        var on = b.getAttribute("data-scene") === name;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });

      if (isAscii) fitAscii();
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
        if (resize()) { fitAscii(); SCENES[current].draw(clock); }
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
    initFigure();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
