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

  /* --- Palette picker ---------------------------------------------------- */
  /* Switches the whole token set. The attribute is applied by the inline head
     script before first paint; this only wires the menu up. */

  function initPalette() {
    var root = document.querySelector("[data-palette-picker]");
    if (!root) return;

    var toggle = root.querySelector("[data-palette-toggle]");
    var menu = root.querySelector(".palette__menu");
    var opts = Array.prototype.slice.call(root.querySelectorAll("[data-palette-set]"));
    if (!toggle || !menu) return;

    function close() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
    }

    function mark() {
      var current = document.documentElement.getAttribute("data-palette") || "blue";
      opts.forEach(function (b) {
        b.setAttribute("aria-checked", String(b.getAttribute("data-palette-set") === current));
      });
    }

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });

    opts.forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-palette-set");
        document.documentElement.setAttribute("data-palette", name);
        try { localStorage.setItem("palette", name); } catch (err) { /* private mode */ }
        mark();
        close();
      });
    });

    document.addEventListener("click", function (e) {
      if (!menu.hidden && !root.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    mark();
  }

  /* --- Hero backdrop: a (3,5) torus knot --------------------------------- */
  /* A closed curve winding 3 times around the axis of a torus and 5 times
     around its core. Because 3 and 5 share no factor it closes into a single
     strand that cannot be pulled apart into a circle: a genuine knot.

       x = (R + r·cos(q t))·cos(p t)
       y = (R + r·cos(q t))·sin(p t)
       z =        r·sin(q t)

     It sits behind the hero at low contrast rather than ringed around the
     portrait. Encircling the photo meant either drawing lines across a face
     or clipping the strand where it crossed, and clipping breaks the curve
     into arcs, which is what made it read as bumpy circles instead of a knot.
     Drawn whole and large, the over-and-under is legible. */

  function initKnot() {
    var host = document.querySelector("[data-knot]");
    if (!host) return;

    var cv = host.querySelector("canvas");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");

    var P = 3, Q = 5;
    var R = 1, TUBE = 0.36;
    var STEPS = 620;
    var TILT = 0.46;
    var FOCAL = 6.5;
    var BUCKETS = 7;

    /* Where the knot's centre sits inside the hero box, and how much of the
       shorter side it spans. */
    var CX = 0.74, CY = 0.47, SPAN = 0.60;

    var W = 0, H = 0, dpr = 1, lineRGB = "43,127,212";

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
       instead would swing the knot edge-on twice a turn. */
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
      if (!rect.width || !rect.height) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = rect.width; H = rect.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      return true;
    }

    function render(angle) {
      var reach = maxR * (FOCAL / (FOCAL - maxR));
      var scale = (Math.min(W, H) * SPAN) / reach;
      var ox = W * CX, oy = H * CY;
      var cosA = Math.cos(angle), sinA = Math.sin(angle);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";

      var paths = [];
      for (var i = 0; i < BUCKETS; i++) paths.push(new Path2D());

      var lx = 0, ly = 0, lz = 0, have = false;
      for (var k = 0; k <= STEPS; k++) {
        var j = (k % STEPS) * 3;
        project(pts[j], pts[j + 1], pts[j + 2], cosA, sinA);

        if (have) {
          var z = (lz + pz) / 2;
          var t = (z + maxR) / (2 * maxR);
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var bi = Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));
          paths[bi].moveTo(ox + lx * scale, oy + ly * scale);
          paths[bi].lineTo(ox + px * scale, oy + py * scale);
        }
        lx = px; ly = py; lz = pz; have = true;
      }

      for (var b = 0; b < BUCKETS; b++) {
        var level = b / (BUCKETS - 1);
        ctx.strokeStyle = "rgba(" + lineRGB + "," + (0.10 + level * 0.34).toFixed(3) + ")";
        ctx.lineWidth = 1.0 + level * 1.1;
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
      angle += dt * 0.00012;
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
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "data-palette"]
    });

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

    var assignCanvas = root.querySelector(".routing__assign");
    var actx = assignCanvas && assignCanvas.getContext ? assignCanvas.getContext("2d") : null;
    var AW = 0, AH = 0, adpr = 1;

    var views = Array.prototype.slice.call(root.querySelectorAll("[data-view]"));
    var panes = {
      map: root.querySelector('[data-pane="map"]'),
      data: root.querySelector('[data-pane="data"]'),
      assign: root.querySelector('[data-pane="assign"]')
    };
    var view = "map";
    var tableBody = root.querySelector("[data-driver-rows]");
    var orderBody = root.querySelector("[data-order-rows]");

    var stepEls = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });
    var replay = root.querySelector("[data-routing-replay]");

    /* Board is 1,600 x 900 miles; every distance below is in miles. */
    var MILES_W = 1200, MILES_H = 680;
    var MAX_RANGE = 2500, MIN_RANGE = 20;
    var CAPACITY = 3;              // orders on board at once
    var N_ORDERS = 11, N_TRUCKS = 4;
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

    /* Each canvas is measured on its own: a hidden pane reports zero width, and
       bailing on the first one used to leave the other sized 0 and everything
       drawn crushed into the corner. */
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var any = false;

      var rect = canvas.getBoundingClientRect();
      if (rect.width) {
        W = rect.width; H = rect.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        any = true;
      }

      if (assignCanvas) {
        var ar = assignCanvas.getBoundingClientRect();
        if (ar.width) {
          adpr = dpr;
          AW = ar.width; AH = ar.height;
          assignCanvas.width = Math.round(AW * adpr);
          assignCanvas.height = Math.round(AH * adpr);
          any = true;
        }
      }
      return any || W > 0;
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

    var depot, orders, drivers, columns, chosen, rng, seed = 1;

    function dist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /* Service times are the real constraint operators think in: a drop is
       quick, a live-load pickup is not. Hours of service are what actually
       caps a driver's day. */
    var AVG_MPH = 52;

    function hhmm(mins) {
      var h = Math.floor(mins / 60) % 24, m = Math.round(mins) % 60;
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    }

    function buildInstance() {
      rng = mulberry32(seed);
      depot = { x: MILES_W * 0.5, y: MILES_H * 0.5, depot: true };
      orders = [];
      drivers = [];

      for (var d0 = 0; d0 < N_TRUCKS; d0++) {
        drivers.push({
          id: d0,
          name: "D-" + (1400 + Math.floor(rng() * 500)),
          hos: Math.round((7.5 + rng() * 3.5) * 10) / 10,   // hours of service left
          x: Math.round(depot.x + (rng() - 0.5) * 120),
          y: Math.round(depot.y + (rng() - 0.5) * 120),
          route: null
        });
      }

      for (var i = 0; i < N_ORDERS; i++) {
        // Pickups spread over the board; each delivery is a plausible haul away.
        var p = {
          x: 90 + rng() * (MILES_W - 180),
          y: 70 + rng() * (MILES_H - 140)
        };
        var ang = rng() * Math.PI * 2;
        var len = 140 + rng() * 420;
        var dd = {
          x: Math.min(MILES_W - 70, Math.max(70, p.x + Math.cos(ang) * len)),
          y: Math.min(MILES_H - 60, Math.max(60, p.y + Math.sin(ang) * len))
        };
        // Live loads take about 100 minutes, drop-and-hooks about 30.
        var live = rng() < 0.45;
        var readyAt = 360 + Math.floor(rng() * 300);          // 06:00 to 11:00
        var miles = dist(p, dd);
        orders.push({
          id: i, p: p, d: dd, miles: miles,
          live: live,
          pickMins: live ? 100 : 30,
          dropMins: live ? 45 : 30,
          readyAt: readyAt,
          dueBy: readyAt + Math.round(miles / AVG_MPH * 60) + 240,
          driver: null
        });
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

        /* On the last truck, take everything still unserved rather than the
           cheapest disjoint column, otherwise the fleet can leave orders on
           the dock while a truck sits idle. */
        if (picked.length === N_TRUCKS - 1 && count < N_ORDERS) best = null;

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

      // Hand the routes to drivers, longest first to the driver with most
      // hours left, and record it both ways for the table and the matcher.
      chosen.sort(function (a, b) { return b.miles - a.miles; });
      drivers.sort(function (a, b) { return b.hos - a.hos; });
      for (var q = 0; q < chosen.length && q < drivers.length; q++) {
        chosen[q].driver = drivers[q];
        drivers[q].route = chosen[q];
        for (var m2 = 0; m2 < chosen[q].orders.length; m2++) {
          orders[chosen[q].orders[m2]].driver = drivers[q];
        }
      }
      drivers.sort(function (a, b) { return a.id - b.id; });

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



    /* ---- data view ------------------------------------------------------ */
    /* The instance as an operator would receive it, before anything is solved. */

    function esc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

    function fillTables() {
      if (tableBody) {
        var rows = [];
        for (var i = 0; i < drivers.length; i++) {
          var d = drivers[i];
          var r = d.route;
          rows.push(
            "<tr><td>" + (i + 1) + "</td><td>" + esc(d.name) + "</td>" +
            "<td>" + d.hos.toFixed(1) + " h</td>" +
            "<td>" + d.x + ", " + d.y + "</td>" +
            "<td>" + (r ? r.orders.length + " orders" : "unassigned") + "</td>" +
            "<td>" + (r ? Math.round(r.miles).toLocaleString("en-US") + " mi" : "&ndash;") + "</td></tr>"
          );
        }
        tableBody.innerHTML = rows.join("");
      }

      if (orderBody) {
        var orows = [];
        for (var j = 0; j < orders.length; j++) {
          var o = orders[j];
          orows.push(
            "<tr><td>#" + (j + 1) + "</td>" +
            "<td>" + Math.round(o.miles).toLocaleString("en-US") + " mi</td>" +
            "<td>" + hhmm(o.readyAt) + "</td>" +
            "<td>" + hhmm(o.dueBy) + "</td>" +
            "<td>" + o.pickMins + " / " + o.dropMins + " min</td>" +
            "<td>" + (o.live ? "live" : "drop") + "</td>" +
            "<td>" + (o.driver ? "D" + (drivers.indexOf(o.driver) + 1) : "&ndash;") + "</td></tr>"
          );
        }
        orderBody.innerHTML = orows.join("");
      }
    }

    /* ---- assignment view ------------------------------------------------ */
    /* Drivers down the left, orders down the right. A driver's first order is
       a straight line; each subsequent order on the same route arcs down from
       the previous one, so a route reads as a chain rather than a fan. */

    function drawAssignment(t) {
      var acx = actx;
      acx.setTransform(adpr, 0, 0, adpr, 0, 0);
      acx.clearRect(0, 0, AW, AH);
      acx.lineJoin = "round";
      acx.lineCap = "round";

      var padT = 34, padB = 18;
      var leftX = Math.max(78, AW * 0.17);
      /* The order column sits well left of the edge: the chain arcs bulge out
         to its right, and the labels have to clear them. */
      var rightX = Math.min(AW - 210, AW * 0.68);
      var labelX = rightX + 112;
      var dStep = (AH - padT - padB) / Math.max(1, drivers.length);
      var oStep = (AH - padT - padB) / Math.max(1, orders.length);

      function dy(i) { return padT + dStep * (i + 0.5); }
      function oy(i) { return padT + oStep * (i + 0.5); }

      acx.font = "500 11px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
      acx.textBaseline = "middle";

      acx.fillStyle = C.faint;
      acx.textAlign = "left";
      acx.fillText("DRIVERS", leftX - 30, 16);
      acx.textAlign = "right";
      acx.fillText("ORDERS", rightX + 30, 16);

      // Orders land one by one first, exactly as they do on the map.
      var arrived = t < T_DATA
        ? Math.min(orders.length, Math.floor(t / T_DATA * orders.length) + 1)
        : orders.length;

      // Then routes settle one after another.
      var reveal = Math.max(0, Math.min(chosen.length, (t - T_COLS) / 1.5));

      for (var c = 0; c < chosen.length; c++) {
        var r = chosen[c];
        if (!r.driver) continue;
        var di = drivers.indexOf(r.driver);
        var done = Math.min(1, Math.max(0, reveal - c));
        if (done <= 0) continue;

        // Stop order as the solver sequenced it, de-duplicated to first touch.
        var seq = [], seen = {};
        for (var k = 0; k < r.stops.length; k++) {
          var oid = r.stops[k].order;
          if (!seen[oid]) { seen[oid] = true; seq.push(oid); }
        }

        var prevX = leftX, prevY = dy(di);
        for (var m = 0; m < seq.length; m++) {
          var oi = seq[m];
          var tx = rightX, ty = oy(oi);
          var leg = Math.min(1, Math.max(0, done * seq.length - m));
          if (leg <= 0) break;

          acx.strokeStyle = rgba(C.brand, 0.16 + 0.5 * leg);
          acx.lineWidth = 1.6;
          acx.beginPath();
          acx.moveTo(prevX, prevY);

          if (m === 0) {
            // Straight across to the first order.
            var mx = prevX + (tx - prevX) * leg;
            var my = prevY + (ty - prevY) * leg;
            acx.lineTo(mx, my);
          } else {
            // Arc out to the right and down to the next order in the chain.
            var bulge = 46 + 16 * m;
            var c1x = prevX + bulge, c1y = prevY;
            var c2x = tx + bulge, c2y = ty;
            if (leg >= 1) {
              acx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
            } else {
              // Partial arc: subdivide the cubic at `leg`.
              var u = leg;
              var p0x = prevX, p0y = prevY;
              var ax1 = p0x + (c1x - p0x) * u, ay1 = p0y + (c1y - p0y) * u;
              var bx1 = c1x + (c2x - c1x) * u, by1 = c1y + (c2y - c1y) * u;
              var cx1 = c2x + (tx - c2x) * u, cy1 = c2y + (ty - c2y) * u;
              var ax2 = ax1 + (bx1 - ax1) * u, ay2 = ay1 + (by1 - ay1) * u;
              var bx2 = bx1 + (cx1 - bx1) * u, by2 = by1 + (cy1 - by1) * u;
              var ex = ax2 + (bx2 - ax2) * u, ey = ay2 + (by2 - ay2) * u;
              acx.bezierCurveTo(ax1, ay1, ax2, ay2, ex, ey);
            }
          }
          acx.stroke();
          if (leg >= 1) { prevX = tx; prevY = ty; }
        }
      }

      // Driver chips.
      for (var i = 0; i < drivers.length; i++) {
        var dv = drivers[i], y = dy(i);
        acx.fillStyle = C.strong;
        acx.beginPath();
        acx.arc(leftX, y, 11, 0, Math.PI * 2);
        acx.fill();
        acx.fillStyle = C.surface;
        acx.textAlign = "center";
        acx.font = "700 10px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
        acx.fillText(String(i + 1), leftX, y + 0.5);

        acx.fillStyle = C.muted;
        acx.textAlign = "right";
        acx.font = "500 10.5px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
        acx.fillText(dv.name + "  " + dv.hos.toFixed(1) + "h", leftX - 17, y);
      }

      // Order chips.
      for (var j = 0; j < arrived; j++) {
        var o = orders[j], oyy = oy(j);
        var assigned = !!o.driver && reveal > 0;
        acx.beginPath();
        acx.arc(rightX, oyy, 6, 0, Math.PI * 2);
        if (assigned) { acx.fillStyle = rgba(C.brand, 0.85); acx.fill(); }
        else { acx.strokeStyle = rgba(C.ink, 0.4); acx.lineWidth = 1.4; acx.stroke(); }

        acx.fillStyle = C.muted;
        acx.textAlign = "left";
        acx.font = "500 10.5px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
        acx.fillText("#" + (j + 1) + "  " + Math.round(o.miles) + " mi", labelX, oyy);
      }
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

    /* Phase and readout, independent of which view is showing. */
    function readouts(t) {
      var i, total = 0, longest = 0, served = 0;
      for (i = 0; i < chosen.length; i++) {
        total += chosen[i].miles;
        longest = Math.max(longest, chosen[i].miles);
        served += chosen[i].orders.length;
      }

      if (t < T_DATA) {
        setPhase("data");
        var shown = Math.min(orders.length, Math.floor(t / T_DATA * orders.length) + 1);
        stat("orders", shown + " / " + N_ORDERS);
        stat("served", "0 / " + N_ORDERS);
        stat("columns", "0");
        stat("routes", "\u2014");
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      stat("orders", N_ORDERS + " / " + N_ORDERS);

      if (t < T_COLS) {
        setPhase("columns");
        var f = (t - T_DATA) / (T_COLS - T_DATA);
        stat("columns", Math.max(1, Math.floor(f * columns.length)).toLocaleString("en-US"));
        stat("served", "0 / " + N_ORDERS);
        stat("routes", "\u2014");
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      stat("columns", columns.length.toLocaleString("en-US"));

      if (t < T_PICK) {
        setPhase("select");
        var g = (t - T_COLS) / (T_PICK - T_COLS);
        var live = Math.min(chosen.length, Math.floor(g * (chosen.length + 0.6)) + 1);
        var sv = 0;
        for (i = 0; i < live; i++) sv += chosen[i].orders.length;
        stat("routes", live + " of " + chosen.length);
        stat("served", sv + " / " + N_ORDERS);
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      setPhase("dispatch");
      stat("routes", chosen.length + " of " + chosen.length);
      stat("served", served + " / " + N_ORDERS);
      stat("longest", Math.round(longest).toLocaleString("en-US") + " mi");

      if (t < T_RUN) {
        var prog = (t - T_PICK) / (T_RUN - T_PICK);
        var driven = 0;
        for (i = 0; i < chosen.length; i++) {
          driven += Math.min(chosen[i].miles, chosen[i].miles * prog);
        }
        stat("miles", Math.round(driven).toLocaleString("en-US") + " mi");
      } else {
        stat("miles", Math.round(total).toLocaleString("en-US") + " mi");
      }
    }

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      var i, r;

      if (t < T_DATA) {
        // Orders arrive.
        var shown = Math.min(orders.length, Math.floor(t / T_DATA * orders.length) + 1);
        var keep = orders;
        orders = orders.slice(0, shown);
        marks(true);
        orders = keep;

      } else if (t < T_COLS) {
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

      } else if (t < T_PICK) {
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

      } else if (t < T_RUN) {
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

      } else {
        for (i = 0; i < chosen.length; i++) {
          r = chosen[i];
          ctx.strokeStyle = rgba(C.strong, 0.8);
          ctx.lineWidth = 2.2;
          routePath(r);
          ctx.stroke();
        }
        marks(false);
        for (i = 0; i < chosen.length; i++) truck(depot.x, depot.y + (i - (chosen.length - 1) / 2) * 26, i + 1);
      }

    }

    /* ---- loop ---------------------------------------------------------- */

    var running = false, last = 0, accum = 0;
    var FRAME_MS = 1000 / 30;

    function draw(t) {
      readouts(t);
      if (view === "assign" && actx) drawAssignment(t);
      else if (view === "map") render(t);
      // The data view is a table; the readout pass above keeps it current.
    }

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000;
      if (clock > T_END) { seed++; solve(); fillTables(); clock = 0; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;
      draw(clock);
    }

    function start() {
      if (running || prefersReduced()) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    function setView(name) {
      if (!panes[name]) return;
      view = name;
      Object.keys(panes).forEach(function (k) {
        if (panes[k]) panes[k].hidden = k !== name;
      });
      views.forEach(function (b) {
        b.setAttribute("aria-selected", String(b.getAttribute("data-view") === name));
        b.tabIndex = b.getAttribute("data-view") === name ? 0 : -1;
      });
      // The canvases have no size while hidden, so measure on the way in.
      resize();
      draw(clock);
    }

    views.forEach(function (b) {
      b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
    });

    if (replay) {
      replay.addEventListener("click", function () {
        seed++; solve(); fillTables(); clock = 0; last = 0; accum = FRAME_MS; draw(clock);
      });
    }

    readColours();
    if (!resize()) return;
    solve();
    fillTables();

    if (prefersReduced()) {
      clock = T_END - 1;      // hold on the finished solution
      draw(clock);
    } else {
      draw(clock);
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
      resizeTimer = setTimeout(function () { if (resize()) draw(clock); }, 150);
    });

    new MutationObserver(function () {
      readColours();
      render(clock);
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "data-palette"]
    });

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Pricing: a bid-response model, fitted live ------------------------ */
  /* A quoting desk's actual question: what price per mile should we put on
     this load? Quoting high wins more per booked mile but loses more loads,
     so the answer is not a point estimate of anything — it is an expectation.

       1. 140 past quotes, each a price per mile and a win/loss, generated
          from a known logistic bid-response curve;
       2. a Bayesian logistic regression fitted by random-walk Metropolis —
          Normal(0, 5²) priors, burn-in discarded, the chain thinned;
       3. the kept draws pushed through a grid of candidate prices to give a
          posterior mean acceptance curve and a 90% credible band;
       4. expected revenue per mile, x·p(x), maximised over that grid.

     The curve the visitor sees is the posterior, not a drawn arc: every faint
     line in the sampling phase is one kept draw of (a, b). */

  function initPricing() {
    var root = document.querySelector("[data-pricing]");
    if (!root) return;

    var canvas = root.querySelector(".pricing__canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var caption = root.querySelector("[data-pricing-caption]");
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });

    /* ---- model constants ---------------------------------------------- */

    var N = 140;                        // past quotes
    var X0 = 1.20, X1 = 3.20;           // dollars per mile
    var A_TRUE = 7.5, B_TRUE = -3.2;    // the curve the history came from
    var PRIOR_SD = 5;                   // weakly informative on both coefficients
    var ITERS = 6000, BURN = 2000, THIN = 10;
    var KEEP = (ITERS - BURN) / THIN;   // 400 posterior draws
    var GRID = 65;                      // candidate prices
    var CSTEP = 2;                      // sub-sampling for the spaghetti only

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
      C.family = getComputedStyle(document.body).fontFamily || "sans-serif";
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

    /* ---- layout: two stacked plots on one shared price axis ------------ */

    var PAD = { l: 36, r: 14, t: 26, b: 26 };
    var GAP = 30;

    function upTop() { return PAD.t; }
    function upBot() { return PAD.t + (H - PAD.t - PAD.b - GAP) * 0.58; }
    function loTop() { return upBot() + GAP; }
    function loBot() { return H - PAD.b; }

    function gx(x) { return PAD.l + (x - X0) / (X1 - X0) * (W - PAD.l - PAD.r); }
    function gp(p) { var a = upTop(), b = upBot(); return b - p * (b - a); }
    function gr(r) { var a = loTop(), b = loBot(); return b - (r / rMax) * (b - a); }

    function label(text, x, y, colour, align, font) {
      ctx.font = (font || "500 10.5px ") + C.family;
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colour;
      ctx.fillText(text, x, y);
    }

    /* ---- seeded randomness --------------------------------------------- */

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

    function logistic(z) { return 1 / (1 + Math.exp(-z)); }

    /* log(1 + e^z) without overflowing either tail. */
    function softplus(z) {
      if (z > 30) return z;
      if (z < -30) return Math.exp(z);
      return Math.log(1 + Math.exp(z));
    }

    /* ---- data, fit, and the summaries the figure draws ------------------ */

    var dataX = new Float64Array(N), dataY = new Uint8Array(N), jit = new Float64Array(N);
    var grid = new Float64Array(GRID);
    var pDraw = new Float64Array(KEEP * GRID);      // p(x) for every kept draw
    var pMean = new Float64Array(GRID), pLo = new Float64Array(GRID), pHi = new Float64Array(GRID);
    var rMean = new Float64Array(GRID), rLo = new Float64Array(GRID), rHi = new Float64Array(GRID);
    var won = 0, accRate = 0, optIdx = 0, optX = 0, optRev = 0, rMax = 1;

    /* The whole fit runs once, at start-up: it is seeded, so the history and
       the posterior are identical on every cycle of the animation and the
       phases only reveal work that has already been done. */
    (function fit() {
      var rand = mulberry32(20260911), i, k;

      var xbar = 0;
      for (i = 0; i < N; i++) {
        dataX[i] = X0 + rand() * (X1 - X0);
        dataY[i] = rand() < logistic(A_TRUE + B_TRUE * dataX[i]) ? 1 : 0;
        jit[i] = rand() - 0.5;
        xbar += dataX[i];
        if (dataY[i]) won++;
      }
      xbar /= N;

      for (k = 0; k < GRID; k++) grid[k] = X0 + k / (GRID - 1) * (X1 - X0);

      /* Sampling in the centred parameterisation. The intercept and slope of a
         logistic fit are almost perfectly anti-correlated on the raw scale, and
         a random walk crawls along that ridge; centring x breaks the
         correlation. The prior stays on the raw (a, b) that the chart uses. */
      function logPost(alpha, beta) {
        var a = alpha - beta * xbar;
        var lp = -(a * a + beta * beta) / (2 * PRIOR_SD * PRIOR_SD);
        for (var j = 0; j < N; j++) {
          var eta = alpha + beta * (dataX[j] - xbar);
          lp += (dataY[j] ? eta : 0) - softplus(eta);
        }
        return lp;
      }

      var alpha = 0, beta = 0, cur = logPost(alpha, beta);
      var sa = 0.40, sb = 0.70;
      var accepts = 0, winAcc = 0, kept = 0;

      for (i = 0; i < ITERS; i++) {
        var qa = alpha + gauss(rand) * sa;
        var qb = beta + gauss(rand) * sb;
        var lp2 = logPost(qa, qb);
        if (Math.log(rand()) < lp2 - cur) {
          alpha = qa; beta = qb; cur = lp2; accepts++; winAcc++;
        }

        /* Step sizes are tuned towards a ~30% acceptance rate during burn-in
           only — the kept draws must come from a chain whose transition kernel
           is no longer changing, or they are not draws from the posterior. */
        if (i < BURN && (i + 1) % 100 === 0) {
          var f = Math.exp((winAcc / 100 - 0.3) * 0.8);
          sa *= f; sb *= f; winAcc = 0;
        }

        if (i >= BURN && (i - BURN) % THIN === 0 && kept < KEEP) {
          var a = alpha - beta * xbar;
          for (k = 0; k < GRID; k++) pDraw[kept * GRID + k] = logistic(a + beta * grid[k]);
          kept++;
        }
      }
      accRate = accepts / ITERS;

      var col = new Array(KEEP);
      for (k = 0; k < GRID; k++) {
        var s = 0;
        for (i = 0; i < KEEP; i++) { col[i] = pDraw[i * GRID + k]; s += col[i]; }
        col.sort(function (p, q) { return p - q; });

        pMean[k] = s / KEEP;
        pLo[k] = col[Math.floor(KEEP * 0.05)];
        pHi[k] = col[Math.min(KEEP - 1, Math.floor(KEEP * 0.95))];

        /* At a fixed candidate price x·p is a monotone transform of p, so the
           revenue band is the price times the probability band — no second
           pass over the draws is needed. */
        rMean[k] = grid[k] * pMean[k];
        rLo[k] = grid[k] * pLo[k];
        rHi[k] = grid[k] * pHi[k];

        if (rMean[k] > optRev) { optRev = rMean[k]; optIdx = k; }
        if (rHi[k] > rMax) rMax = rHi[k];
      }
      optX = grid[optIdx];
      rMax = Math.ceil(rMax * 1.12 * 10) / 10;   // headroom, on a round tick
    })();

    /* ---- phases --------------------------------------------------------- */

    var T_DATA = 3, T_SAMP = 9, T_POST = 13, T_MARK = 16, T_TAG = 17.3, T_END = 21;
    var clock = 0;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function shownPoints(t) {
      return t >= T_DATA ? N : Math.min(N, Math.floor(t / T_DATA * N) + 1);
    }
    function shownDraws(t) {
      if (t < T_DATA) return 0;
      if (t >= T_SAMP) return KEEP;
      return Math.min(KEEP, Math.floor(KEEP * (t - T_DATA) / (T_SAMP - T_DATA)));
    }

    function axes() {
      var uT = upTop(), uB = upBot(), lT = loTop(), lB = loBot();
      var L = gx(X0), R = gx(X1);

      ctx.strokeStyle = rgba(C.line, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, uB + 0.5); ctx.lineTo(R, uB + 0.5);
      ctx.moveTo(L, lB + 0.5); ctx.lineTo(R, lB + 0.5);
      ctx.stroke();

      // Coin-flip reference: the price at which the shipper is indifferent.
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(C.faint, 0.45);
      ctx.beginPath();
      ctx.moveTo(L, gp(0.5)); ctx.lineTo(R, gp(0.5));
      ctx.stroke();
      ctx.restore();

      label("1", L - 6, uT, C.faint, "right");
      label("0", L - 6, uB, C.faint, "right");
      label("$" + rMax.toFixed(2), L - 6, lT, C.faint, "right");
      label("0", L - 6, lB, C.faint, "right");

      label("P(accept)", L, uT - 11, C.muted, "left");
      label("E[revenue] per mile", L, lT - 11, C.muted, "left");
      label("quoted $/mile", R, uT - 11, C.faint, "right");

      var ticks = [1.2, 1.7, 2.2, 2.7, 3.2];
      for (var i = 0; i < ticks.length; i++) {
        label("$" + ticks[i].toFixed(2), gx(ticks[i]), lB + 12, C.faint, "center");
      }
    }

    /* Phase and readout, independent of which view is showing. */
    function readouts(t) {
      var i, total = 0, longest = 0, served = 0;
      for (i = 0; i < chosen.length; i++) {
        total += chosen[i].miles;
        longest = Math.max(longest, chosen[i].miles);
        served += chosen[i].orders.length;
      }

      if (t < T_DATA) {
        setPhase("data");
        var shown = Math.min(orders.length, Math.floor(t / T_DATA * orders.length) + 1);
        stat("orders", shown + " / " + N_ORDERS);
        stat("served", "0 / " + N_ORDERS);
        stat("columns", "0");
        stat("routes", "\u2014");
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      stat("orders", N_ORDERS + " / " + N_ORDERS);

      if (t < T_COLS) {
        setPhase("columns");
        var f = (t - T_DATA) / (T_COLS - T_DATA);
        stat("columns", Math.max(1, Math.floor(f * columns.length)).toLocaleString("en-US"));
        stat("served", "0 / " + N_ORDERS);
        stat("routes", "\u2014");
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      stat("columns", columns.length.toLocaleString("en-US"));

      if (t < T_PICK) {
        setPhase("select");
        var g = (t - T_COLS) / (T_PICK - T_COLS);
        var live = Math.min(chosen.length, Math.floor(g * (chosen.length + 0.6)) + 1);
        var sv = 0;
        for (i = 0; i < live; i++) sv += chosen[i].orders.length;
        stat("routes", live + " of " + chosen.length);
        stat("served", sv + " / " + N_ORDERS);
        stat("miles", "\u2014");
        stat("longest", "\u2014");
        return;
      }

      setPhase("dispatch");
      stat("routes", chosen.length + " of " + chosen.length);
      stat("served", served + " / " + N_ORDERS);
      stat("longest", Math.round(longest).toLocaleString("en-US") + " mi");

      if (t < T_RUN) {
        var prog = (t - T_PICK) / (T_RUN - T_PICK);
        var driven = 0;
        for (i = 0; i < chosen.length; i++) {
          driven += Math.min(chosen[i].miles, chosen[i].miles * prog);
        }
        stat("miles", Math.round(driven).toLocaleString("en-US") + " mi");
      } else {
        stat("miles", Math.round(total).toLocaleString("en-US") + " mi");
      }
    }

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      axes();

      var i, k, d, X, Y;
      var nd = shownDraws(t);

      /* The spaghetti hands over to the summary rather than cutting: the point
         is that the band *is* those curves, so they overlap for a moment. */
      var fade = 1 - clamp01((t - T_SAMP - 0.4) / 1.8);
      var band = clamp01((t - T_SAMP - 0.3) / 1.8);
      var meanIn = clamp01((t - T_SAMP - 0.8) / 1.8);

      if (nd > 0 && fade > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(C.brand, 0.05 * fade);
        for (d = 0; d < nd; d++) {
          ctx.beginPath();
          for (k = 0; k < GRID; k += CSTEP) {
            X = gx(grid[k]); Y = gp(pDraw[d * GRID + k]);
            k === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
          }
          ctx.stroke();
        }
      }

      if (band > 0) {
        ctx.fillStyle = rgba(C.brand, 0.22 * band);
        ctx.beginPath();
        ctx.moveTo(gx(grid[0]), gp(pHi[0]));
        for (k = 1; k < GRID; k++) ctx.lineTo(gx(grid[k]), gp(pHi[k]));
        for (k = GRID - 1; k >= 0; k--) ctx.lineTo(gx(grid[k]), gp(pLo[k]));
        ctx.closePath();
        ctx.fill();
      }

      if (meanIn > 0) {
        var upto = Math.max(1, Math.round(meanIn * (GRID - 1)));
        ctx.strokeStyle = C.strong;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx(grid[0]), gp(pMean[0]));
        for (k = 1; k <= upto; k++) ctx.lineTo(gx(grid[k]), gp(pMean[k]));
        ctx.stroke();
      }

      // The history sits on top: won on the upper rule, lost on the lower.
      var pts = shownPoints(t);
      for (i = 0; i < pts; i++) {
        X = gx(dataX[i]);
        Y = dataY[i] ? upTop() + 3 + jit[i] * 9 : upBot() - 3 + jit[i] * 9;
        ctx.beginPath();
        ctx.arc(X, Y, 2.6, 0, Math.PI * 2);
        if (dataY[i]) {
          ctx.fillStyle = rgba(C.ink, 0.55);
          ctx.fill();
        } else {
          ctx.strokeStyle = rgba(C.ink, 0.45);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      if (t >= T_POST) {
        var rf = clamp01((t - T_POST) / 2.6);
        var uptoR = Math.max(1, Math.round(rf * (GRID - 1)));

        ctx.fillStyle = rgba(C.brand, 0.2);
        ctx.beginPath();
        ctx.moveTo(gx(grid[0]), gr(rHi[0]));
        for (k = 1; k <= uptoR; k++) ctx.lineTo(gx(grid[k]), gr(rHi[k]));
        for (k = uptoR; k >= 0; k--) ctx.lineTo(gx(grid[k]), gr(rLo[k]));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = C.strong;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx(grid[0]), gr(rMean[0]));
        for (k = 1; k <= uptoR; k++) ctx.lineTo(gx(grid[k]), gr(rMean[k]));
        ctx.stroke();
      }

      var drop = clamp01((t - T_MARK) / 1.1);
      if (drop > 0) {
        var mx = gx(optX);
        var y0 = upTop() - 6, y1 = loBot();
        var eased = 1 - Math.pow(1 - drop, 3); /* easeOutCubic */

        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = rgba(C.strong, 0.85);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(mx, y0);
        ctx.lineTo(mx, y0 + eased * (y1 - y0));
        ctx.stroke();
        ctx.restore();

        if (drop >= 1) {
          ctx.fillStyle = C.strong;
          ctx.strokeStyle = C.surface;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mx, gp(pMean[optIdx]), 4, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.arc(mx, gr(optRev), 4, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }

        // The tag goes on whichever side has room, on a plate so the dashed
        // marker does not run through the words.
        if (t >= T_TAG) {
          var side = mx < (gx(X0) + gx(X1)) / 2 ? 1 : -1;
          var al = side > 0 ? "left" : "right";
          var tx = mx + side * 14;
          var ty = loTop() + 15;

          var l1 = "quote $" + optX.toFixed(2) + " / mi";
          var l2 = "$" + optRev.toFixed(2) + " expected / mi";

          ctx.font = "600 11.5px " + C.family;
          var w1 = ctx.measureText(l1).width;
          ctx.font = "500 10.5px " + C.family;
          var w2 = ctx.measureText(l2).width;
          var pw = Math.max(w1, w2) + 14;
          var pxx = side > 0 ? tx - 7 : tx - pw + 7;

          ctx.fillStyle = rgba(C.surface, 0.94);
          ctx.fillRect(pxx, ty - 13, pw, 34);

          label(l1, tx, ty, C.ink, al, "600 11.5px ");
          label(l2, tx, ty + 15, C.muted, al);
        }
      }
    }

    /* ---- readouts ------------------------------------------------------- */

    function stat(key, value) {
      if (out[key]) out[key].textContent = value;
    }

    function readouts(t) {
      var nd = shownDraws(t);
      stat("quotes", t < T_DATA ? shownPoints(t) + " / " + N : String(N));
      stat("accepted", t < T_DATA ? "—" : won + " / " + N);
      stat("draws", nd ? nd.toLocaleString("en-US") : "—");
      stat("optimal", t >= T_MARK ? "$" + optX.toFixed(2) : "—");
      stat("revenue", t >= T_TAG ? "$" + optRev.toFixed(2) : "—");
    }

    function setCaption(t) {
      if (!caption) return;
      var text;
      if (t < T_DATA) {
        text = N + " past quotes. Price per mile against whether the shipper took it, " +
               "won on the upper rule and lost on the lower.";
      } else if (t < T_SAMP) {
        text = "Random-walk Metropolis over the two logistic coefficients, Normal(0,&nbsp;5&sup2;) priors " +
               ". " + shownDraws(t).toLocaleString("en-US") + " of " +
               KEEP.toLocaleString("en-US") + " kept draws, " +
               Math.round(accRate * 100) + "% of proposals accepted.";
      } else if (t < T_POST) {
        text = KEEP.toLocaleString("en-US") + " draws kept after " + BURN.toLocaleString("en-US") +
               " burn-in and thinning by " + THIN +
               ". The band is the middle 90% of the acceptance curve.";
      } else {
        text = "Expected revenue is price &times; P(accept). It peaks at $" + optX.toFixed(2) +
               " per mile, worth $" + optRev.toFixed(2) + " expected on every mile quoted.";
      }
      caption.innerHTML = text;
    }

    function paint(t) {
      render(t);
      readouts(t);
    }

    /* ---- loop ----------------------------------------------------------- */

    var running = false, last = 0, accum = 0, tick = 0, ready = false;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000;
      if (clock > T_END) clock = 0;

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      paint(clock);
      if (++tick % 6 === 0) setCaption(clock);
    }

    function start() {
      if (running || prefersReduced() || !ready) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    readColours();

    /* This panel can start inside a closed tab, where it measures zero. Bailing
       out there would mean it never initialises at all, so first paint is
       deferred until it has a real size. */
    function firstPaint() {
      if (ready || !resize()) return;
      ready = true;
      if (prefersReduced()) {
        clock = T_END - 1;    // hold on the settled posterior and the decision
        paint(clock);
        setCaption(clock);
      } else {
        paint(clock);
        setCaption(clock);
        start();
      }
    }
    firstPaint();
    if (!ready) window.addEventListener("resize", firstPaint);

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
      resizeTimer = setTimeout(function () { if (resize()) paint(clock); }, 150);
    });

    new MutationObserver(function () {
      readColours();
      paint(clock);
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "data-palette"]
    });

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Contracts: one agreement, followed end to end --------------------- */
  /* A scatter of hundreds of chunks reads as decoration. One document, six
     beats, is something a visitor can actually follow: it arrives, a model
     reads it, it lands in the lake, it is chunked into a vector index, an
     agent pulls back only the rows it needs, and the rebate owed falls out.
     Every figure on the canvas is derived from the constants below, so the
     arithmetic holds up if anyone checks it. */

  function initContracts() {
    var root = document.querySelector("[data-contracts]");
    if (!root) return;

    var canvas = root.querySelector(".contracts__canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var caption = root.querySelector("[data-contracts-caption]");
    var stepEls = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });

    /* ---- the numbers ---------------------------------------------------- */

    var PAGES = 14;
    var CLAUSES = 6;
    var CHUNKS = 38;
    var TOK_FULL = 48200;              // whole contract pasted into the prompt
    var TOK_RAG = 1840;                // only the retrieved chunks
    var SAVED_PCT = (1 - TOK_RAG / TOK_FULL) * 100;
    var REVENUE = 4812400;             // customer eligible revenue, year to date
    var TIER_NO = 3;
    var TIER_MIN = 4000000;
    var TIER_RATE = 0.126;
    var OWED = REVENUE * TIER_RATE;
    var CUSTOMER = "Northstar Surgical";
    var TITLE = "Master Distribution Agreement";
    var KEY_LINE = "Tier " + TIER_NO + ": " + (TIER_RATE * 100).toFixed(1) +
                   "% on eligible revenue above $" + TIER_MIN.toLocaleString("en-US");
    var RETRIEVED = [28, 32, 36];      // the index rows carrying the rebate clause
    var NOVALUE = "\u2014";            // the placeholder the markup ships with

    /* ---- phases, in seconds --------------------------------------------- */

    var T_ARRIVE = 3.4;
    var T_READ = 10.0;
    var T_STORE = 13.2;
    var T_INDEX = 19.4;
    var T_RETRIEVE = 25.0;
    var T_HOLD = 32.0;                 // dashboard finished, holding
    var T_END = 34.0;

    /* The payoff gets the room: five dashboard elements, a beat between each,
       then a hold before the loop starts over. */
    var D_REV = T_RETRIEVE + 1.3;
    var D_TIER = T_RETRIEVE + 3.2;
    var D_MULT = T_RETRIEVE + 4.5;
    var D_OWED = T_RETRIEVE + 5.6;
    var COUNT_DUR = 1.4;

    /* ---- the document --------------------------------------------------- */
    /* Fractions of the page box. Four lines are set as real text, the rest as
       rules, which is what a page looks like from reading distance. */

    var PAGE_W = 292, PAGE_H = 330;

    var SECTIONS = [
      { label: "pricing", top: 0.140, bottom: 0.278, rows: [
        { y: 0.163, w: 0.30, head: true },
        { y: 0.201, w: 0.92 },
        { y: 0.231, w: 0.86 },
        { y: 0.261, w: 0.55 }
      ] },
      { label: "term", top: 0.300, bottom: 0.404, rows: [
        { y: 0.328, text: "Term: 36 months from the effective date." },
        { y: 0.362, w: 0.80 },
        { y: 0.390, w: 0.46 }
      ] },
      { label: "delivery", top: 0.424, bottom: 0.528, rows: [
        { y: 0.449, w: 0.26, head: true },
        { y: 0.486, w: 0.90 },
        { y: 0.514, w: 0.62 }
      ] },
      { label: "rebate tiers", top: 0.548, bottom: 0.684, rows: [
        { y: 0.575, text: "3.4 Rebate tiers", bold: true },
        { y: 0.612, text: KEY_LINE, key: true },
        { y: 0.648, text: "Applies to all eligible revenue once a tier is cleared." }
      ] },
      { label: "indemnity", top: 0.704, bottom: 0.808, rows: [
        { y: 0.729, w: 0.29, head: true },
        { y: 0.766, w: 0.88 },
        { y: 0.794, w: 0.70 }
      ] },
      { label: "warranty", top: 0.828, bottom: 0.932, rows: [
        { y: 0.853, w: 0.27, head: true },
        { y: 0.890, w: 0.84 },
        { y: 0.918, w: 0.58 }
      ] }
    ];
    var REBATE = 3;                    // index of the rebate section above

    /* ---- canvas plumbing ------------------------------------------------ */

    var W = 0, H = 0, dpr = 1, C = {}, sized = false, booted = false;

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
      C.family = getComputedStyle(document.body).fontFamily || "sans-serif";
    }
    function rgba(hex, a) {
      hex = (hex || "").replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (isNaN(n)) return "rgba(43,127,212," + a + ")";
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
    }

    /* This panel is laid out inside a tab that starts closed, so the first
       measurement is zero. Report failure instead of latching: the resize
       event fired when the tab opens brings the canvas up for real. */
    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      sized = true;
      return true;
    }

    /* ---- small helpers --------------------------------------------------- */

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
    function ease(v) { var u = 1 - clamp01(v); return 1 - u * u * u; }
    function lerp(a, b, f) { return a + (b - a) * f; }
    function num(v) { return Math.round(v).toLocaleString("en-US"); }
    function money(v) { return "$" + num(v); }
    function setFont(px, weight) { ctx.font = (weight || 500) + " " + px + "px " + C.family; }

    function fitFont(text, maxW, px, weight) {
      setFont(px, weight);
      while (px > 6.5 && ctx.measureText(text).width > maxW) {
        px -= 0.4;
        setFont(px, weight);
      }
      return px;
    }

    function rrect(x, y, w, h, r) {
      var m = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + m, y);
      ctx.lineTo(x + w - m, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + m);
      ctx.lineTo(x + w, y + h - m);
      ctx.quadraticCurveTo(x + w, y + h, x + w - m, y + h);
      ctx.lineTo(x + m, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - m);
      ctx.lineTo(x, y + m);
      ctx.quadraticCurveTo(x, y, x + m, y);
      ctx.closePath();
    }

    function wrapLines(text, maxW) {
      var words = text.split(" "), lines = [], cur = "";
      for (var i = 0; i < words.length; i++) {
        var test = cur ? cur + " " + words[i] : words[i];
        if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = words[i]; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    /* A settled hash so every vector glyph is stable across frames without
       carrying a random generator around. */
    function barAt(i, k) {
      var s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return 0.22 + (s - Math.floor(s)) * 0.78;
    }
    function chunkTag(i) {
      for (var r = 0; r < RETRIEVED.length; r++) if (RETRIEVED[r] === i) return "rebate tiers";
      return SECTIONS[(i * 7 + 1) % SECTIONS.length].label;
    }

    /* ---- the page -------------------------------------------------------- */

    function drawPage(box, opts) {
      var s = box.w / PAGE_W;
      var detail = opts.detail === undefined ? 1 : opts.detail;
      ctx.save();
      ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
      ctx.translate(box.x, box.y);
      ctx.scale(s, s);
      ctx.lineWidth = 1 / s;

      // A short stack behind the front sheet: this is 14 pages, not one.
      ctx.strokeStyle = C.line;
      ctx.fillStyle = C.surface;
      var o;
      for (o = 2; o >= 1; o--) {
        rrect(o * 5, o * 5, PAGE_W, PAGE_H, 6);
        ctx.fill();
        ctx.stroke();
      }
      rrect(0, 0, PAGE_W, PAGE_H, 6);
      ctx.fill();
      ctx.stroke();

      if (s > 0.34 && detail > 0.02) {
        ctx.save();
        ctx.globalAlpha *= detail;
        ctx.textAlign = "left";
        ctx.fillStyle = C.ink;
        fitFont(TITLE, PAGE_W - 90, 13, 700);
        ctx.fillText(TITLE, 14, 26);
        ctx.textAlign = "right";
        setFont(8.4, 600);
        ctx.fillStyle = C.faint;
        ctx.fillText(PAGES + " pages", PAGE_W - 14, 26);
        ctx.fillStyle = C.line;
        ctx.fillRect(14, 34, PAGE_W - 28, 1);

        ctx.textAlign = "left";
        var i, j;
        for (i = 0; i < SECTIONS.length; i++) {
          var rows = SECTIONS[i].rows;
          for (j = 0; j < rows.length; j++) {
            var r = rows[j], ry = r.y * PAGE_H;
            if (r.text) {
              ctx.fillStyle = r.key ? C.ink : C.muted;
              fitFont(r.text, PAGE_W - 28, r.key || r.bold ? 9.2 : 8.8, r.key || r.bold ? 700 : 500);
              ctx.fillText(r.text, 14, ry);
            } else {
              ctx.fillStyle = r.head ? rgba(C.ink, 0.45) : rgba(C.faint, 0.55);
              rrect(14, ry - (r.head ? 5 : 3.4), r.w * (PAGE_W - 28), r.head ? 5 : 3.4, 1.8);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }

      // Clause outlines, each one fading in behind the sweep that found it.
      if (opts.clauses) {
        for (var k = 0; k < SECTIONS.length; k++) {
          var a = opts.clauses[k];
          if (a <= 0.01) continue;
          var sec = SECTIONS[k];
          var y0 = sec.top * PAGE_H, hgt = (sec.bottom - sec.top) * PAGE_H;
          var key = k === REBATE;
          if (key) {
            ctx.fillStyle = rgba(C.strong, 0.09 * a);
            rrect(8, y0, PAGE_W - 16, hgt, 5);
            ctx.fill();
          }
          ctx.strokeStyle = key ? rgba(C.strong, 0.95 * a) : rgba(C.brand, 0.45 * a);
          ctx.lineWidth = (key ? 1.8 : 1.1) / s;
          rrect(8, y0, PAGE_W - 16, hgt, 5);
          ctx.stroke();
        }
      }

      // The sweep itself: a band trailing the line that is doing the reading.
      if (opts.scan >= 0) {
        var sy = opts.scan * PAGE_H;
        var g = ctx.createLinearGradient(0, sy - 46, 0, sy);
        g.addColorStop(0, rgba(C.brand, 0));
        g.addColorStop(1, rgba(C.brand, 0.18));
        ctx.fillStyle = g;
        ctx.fillRect(2, Math.max(0, sy - 46), PAGE_W - 4, Math.min(46, sy));
        ctx.fillStyle = rgba(C.brand, 0.9);
        ctx.fillRect(2, sy, PAGE_W - 4, 1.6 / s);
      }

      ctx.restore();
    }

    function drawChips(box, amounts, alpha) {
      var cx = box.x + PAGE_W + 18;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (var i = 0; i < SECTIONS.length; i++) {
        var a = amounts[i];
        if (a <= 0.01) continue;
        var sec = SECTIONS[i];
        var cy = box.y + (sec.top + sec.bottom) / 2 * PAGE_H;
        var key = i === REBATE;
        setFont(9.4, key ? 700 : 600);
        var tw = ctx.measureText(sec.label).width;
        ctx.globalAlpha = alpha * a;

        ctx.strokeStyle = rgba(key ? C.strong : C.brand, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(box.x + PAGE_W - 6, cy);
        ctx.lineTo(cx - 6, cy);
        ctx.stroke();

        ctx.fillStyle = rgba(key ? C.strong : C.brand, key ? 0.16 : 0.08);
        rrect(cx, cy - 9, tw + 18, 18, 9);
        ctx.fill();
        ctx.strokeStyle = rgba(key ? C.strong : C.brand, key ? 0.7 : 0.28);
        ctx.stroke();

        ctx.fillStyle = key ? C.strong : C.muted;
        ctx.textAlign = "left";
        ctx.fillText(sec.label, cx + 9, cy + 3.4);
      }
      ctx.restore();
    }

    function drawClauseCounter(n, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "right";
      setFont(17, 800);
      ctx.fillStyle = C.ink;
      ctx.fillText(n + " of " + CLAUSES, W - 24, 56);
      setFont(9, 600);
      ctx.fillStyle = C.muted;
      ctx.fillText("clauses detected", W - 24, 72);
      ctx.restore();
    }

    /* ---- the data lake ---------------------------------------------------- */

    function drawBucket(cx, cy, s, alpha, labelled) {
      var rx = 56 * s, ry = 15 * s, body = 70 * s;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.4;

      ctx.fillStyle = rgba(C.brand, 0.10);
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.lineTo(cx - rx, cy + body);
      ctx.ellipse(cx, cy + body, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, cy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgba(C.brand, 0.75);
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.lineTo(cx - rx, cy + body);
      ctx.moveTo(cx + rx, cy);
      ctx.lineTo(cx + rx, cy + body);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy + body, rx, ry, 0, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = C.surface;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Two ribs, the usual shorthand for a store rather than a jar.
      ctx.strokeStyle = rgba(C.brand, 0.32);
      ctx.lineWidth = 1;
      for (var i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy + body * i / 3, rx, ry, 0, 0.12, Math.PI - 0.12);
        ctx.stroke();
      }

      if (labelled) {
        ctx.textAlign = "center";
        setFont(11 * Math.max(0.72, s), 700);
        ctx.fillStyle = C.ink;
        ctx.fillText("Azure Data Lake", cx, cy + body + ry + 22 * Math.max(0.72, s));
      }
      ctx.restore();
    }

    /* ---- the index -------------------------------------------------------- */

    var ROW_H = 17, HEAD_H = 30;

    function drawIndexRow(bx, ry, bw, i, glow) {
      var id = "c" + (i < 9 ? "0" : "") + (i + 1);
      if (glow > 0.01) {
        ctx.fillStyle = rgba(C.strong, 0.16 * glow);
        rrect(bx + 8, ry + 1, bw - 16, ROW_H - 3, 4);
        ctx.fill();
      }
      ctx.textAlign = "left";
      setFont(8.6, 700);
      ctx.fillStyle = glow > 0.4 ? C.strong : C.muted;
      ctx.fillText(id, bx + 14, ry + 12);
      setFont(8.6, 500);
      ctx.fillStyle = glow > 0.4 ? C.strong : C.faint;
      ctx.fillText(chunkTag(i), bx + 44, ry + 12);

      var gw = 33, gx = bx + bw - 14 - gw;
      ctx.fillStyle = glow > 0.4 ? rgba(C.strong, 0.9) : rgba(C.brand, 0.5);
      for (var k = 0; k < 7; k++) {
        var h = 2.5 + barAt(i, k) * 8;
        ctx.fillRect(gx + k * 5, ry + ROW_H - 4 - h, 3, h);
      }
    }

    function visibleRows(bh) { return Math.max(1, Math.floor((bh - HEAD_H - 4) / ROW_H)); }
    function rowScroll(bh, landed) {
      return Math.max(0, landed - visibleRows(bh)) * ROW_H;
    }

    function drawIndexBox(bx, by, bw, bh, landed, hi, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      rrect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      setFont(10.5, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText("Vector search index", bx + 14, by + 19);
      ctx.textAlign = "right";
      setFont(9.2, 600);
      ctx.fillStyle = C.muted;
      ctx.fillText(Math.floor(landed) + " of " + CHUNKS, bx + bw - 14, by + 19);
      ctx.strokeStyle = C.line;
      ctx.beginPath();
      ctx.moveTo(bx + 10, by + HEAD_H - 5);
      ctx.lineTo(bx + bw - 10, by + HEAD_H - 5);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 1, by + HEAD_H - 4, bw - 2, bh - HEAD_H + 2);
      ctx.clip();
      var scroll = rowScroll(bh, landed);
      var n = Math.floor(landed);
      for (var i = 0; i < n; i++) {
        var ry = by + HEAD_H + i * ROW_H - scroll;
        if (ry < by - ROW_H || ry > by + bh) continue;
        drawIndexRow(bx, ry, bw, i, hi && hi[i] ? hi[i] : 0);
      }
      ctx.restore();
      ctx.restore();
    }

    function rowY(by, bh, landed, i) {
      return by + HEAD_H + i * ROW_H - rowScroll(bh, landed);
    }

    /* ---- the agent and the token comparison -------------------------------- */

    function drawAgent(cx, cy, r, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var ang = Math.PI / 6 + i * Math.PI / 3;
        var px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(C.strong, 0.12);
      ctx.fill();
      ctx.strokeStyle = C.strong;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.textAlign = "center";
      setFont(10, 700);
      ctx.fillStyle = C.strong;
      ctx.fillText("Agent", cx, cy + 3.6);
      ctx.restore();
    }

    function drawTokenBars(x, y, maxW, f1, f2, pct) {
      var narrow = maxW < 210;
      var barH = 21;
      ctx.save();
      ctx.textAlign = "left";

      setFont(11, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText("Tokens sent to the model", x, y + 12);

      setFont(9.4, 600);
      ctx.fillStyle = C.muted;
      ctx.fillText("Whole contract in the prompt", x, y + 40);
      ctx.fillStyle = rgba(C.line, 1);
      rrect(x, y + 48, maxW, barH, 4); ctx.fill();
      ctx.fillStyle = rgba(C.ink, 0.26);
      rrect(x, y + 48, Math.max(2, maxW * f1), barH, 4); ctx.fill();
      if (f1 > 0.02) {
        setFont(10, 700);
        ctx.fillStyle = C.ink;
        ctx.fillText(num(TOK_FULL), x + maxW * f1 + 8, y + 48 + barH / 2 + 3.6);
      }

      setFont(9.4, 600);
      ctx.fillStyle = C.muted;
      ctx.fillText("Retrieved chunks only", x, y + 96);
      ctx.fillStyle = rgba(C.line, 1);
      rrect(x, y + 104, maxW, barH, 4); ctx.fill();
      var w2 = maxW * (TOK_RAG / TOK_FULL) * f2;
      ctx.fillStyle = rgba(C.brand, 0.95);
      rrect(x, y + 104, Math.max(2, w2), barH, 4); ctx.fill();
      if (f2 > 0.02) {
        setFont(10, 700);
        ctx.fillStyle = C.ink;
        ctx.fillText(num(TOK_RAG), x + w2 + 8, y + 104 + barH / 2 + 3.6);
      }

      if (pct > 0.01) {
        ctx.save();
        ctx.globalAlpha = pct;
        var big = SAVED_PCT.toFixed(1) + "%";
        setFont(27, 800);
        ctx.fillStyle = C.brand;
        ctx.fillText(big, x, y + 172);
        var bw = ctx.measureText(big).width;
        setFont(10.5, 600);
        ctx.fillStyle = C.muted;
        if (narrow) ctx.fillText("fewer tokens in the prompt", x, y + 190);
        else ctx.fillText("fewer tokens in the prompt", x + bw + 10, y + 172);
        setFont(9, 500);
        ctx.fillStyle = C.faint;
        ctx.fillText(num(TOK_RAG) + " tokens instead of " + num(TOK_FULL) + ".",
                     x, y + (narrow ? 210 : 196));
        ctx.restore();
      }
      ctx.restore();
    }

    /* ---- the dashboard ----------------------------------------------------- */
    /* Built one element at a time, because the point is that a reader can see
       where each number came from. */

    function drawDashboard(x, y, w, h, b) {
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.globalAlpha = b.frame;
      rrect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      fitFont(CUSTOMER, w * 0.55, 15, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText(CUSTOMER, x + 18, y + 28);
      ctx.textAlign = "right";
      setFont(9, 600);
      ctx.fillStyle = C.faint;
      ctx.fillText("Rebate statement, year to date", x + w - 18, y + 28);
      ctx.fillStyle = C.line;
      ctx.fillRect(x + 14, y + 44, w - 28, 1);

      var colB = x + w / 2 + 6;

      if (b.rev > 0.01) {
        ctx.save();
        ctx.globalAlpha = b.rev;
        ctx.textAlign = "left";
        setFont(9.4, 600);
        ctx.fillStyle = C.muted;
        ctx.fillText("Eligible revenue YTD", x + 18, y + 68);
        fitFont(money(REVENUE), w / 2 - 30, 19, 800);
        ctx.fillStyle = C.ink;
        ctx.fillText(money(REVENUE * b.revAmt), x + 18, y + 92);
        ctx.restore();
      }

      if (b.tier > 0.01) {
        ctx.save();
        ctx.globalAlpha = b.tier;
        ctx.textAlign = "left";
        setFont(9.4, 600);
        ctx.fillStyle = C.muted;
        ctx.fillText("Rebate tier", colB, y + 68);
        fitFont("Tier " + TIER_NO + " at " + (TIER_RATE * 100).toFixed(1) + "%", w / 2 - 30, 19, 800);
        ctx.fillStyle = C.ink;
        ctx.fillText("Tier " + TIER_NO + " at " + (TIER_RATE * 100).toFixed(1) + "%", colB, y + 92);
        setFont(8.4, 500);
        ctx.fillStyle = C.faint;
        ctx.fillText("threshold " + money(TIER_MIN) + " cleared", colB, y + 108);
        ctx.restore();
      }

      if (b.mult > 0.01) {
        ctx.save();
        ctx.globalAlpha = b.mult;
        ctx.fillStyle = C.line;
        ctx.fillRect(x + 14, y + 124, w - 28, 1);
        ctx.textAlign = "center";
        var line = money(REVENUE) + "   \u00d7   " + (TIER_RATE * 100).toFixed(1) + "%";
        fitFont(line, w - 60, 14, 600);
        ctx.fillStyle = C.ink;
        ctx.fillText(line, x + w / 2, y + 154);
        ctx.strokeStyle = rgba(C.ink, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 92, y + 166);
        ctx.lineTo(x + w / 2 + 92, y + 166);
        ctx.stroke();
        ctx.restore();
      }

      if (b.owed > 0.01) {
        ctx.save();
        ctx.globalAlpha = b.owed;
        ctx.textAlign = "center";
        setFont(10, 700);
        ctx.fillStyle = C.muted;
        ctx.fillText("Rebate owed", x + w / 2, y + 192);
        fitFont(money(OWED), w - 60, 31, 800);
        ctx.fillStyle = C.strong;
        ctx.fillText(money(OWED * b.owedAmt), x + w / 2, y + 228);

        setFont(8.6, 500);
        ctx.fillStyle = C.faint;
        var note = "The tier " + TIER_NO + " rate applies to all eligible revenue once the " +
                   money(TIER_MIN) + " threshold is cleared, not only the part above it.";
        var lines = wrapLines(note, w - 44);
        for (var i = 0; i < lines.length && i < 3; i++) {
          ctx.fillText(lines[i], x + w / 2, y + 254 + i * 13);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    function drawChip(x, y, label, value, alpha, fromRight) {
      ctx.save();
      ctx.globalAlpha = alpha;
      setFont(9.4, 700);
      var vw = ctx.measureText(value).width;
      setFont(9.4, 500);
      var lw = ctx.measureText(label).width;
      var w = vw + lw + 26;
      if (fromRight) x -= w;
      ctx.fillStyle = rgba(C.brand, 0.07);
      ctx.strokeStyle = rgba(C.brand, 0.25);
      ctx.lineWidth = 1;
      rrect(x, y, w, 24, 12);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      setFont(9.4, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText(value, x + 12, y + 15.5);
      setFont(9.4, 500);
      ctx.fillStyle = C.muted;
      ctx.fillText(label, x + 12 + vw + 6, y + 15.5);
      ctx.restore();
      return w;
    }

    /* ---- beat maths shared by the drawing and the readouts ------------------ */

    function sweepAt(t) { return seg(t, T_ARRIVE + 0.9, T_ARRIVE + 5.3); }
    function clauseAmts(t) {
      var s = sweepAt(t), a = [];
      for (var i = 0; i < SECTIONS.length; i++) a.push(seg(s, SECTIONS[i].bottom, SECTIONS[i].bottom + 0.09));
      return a;
    }
    function detectedAt(t) {
      var a = clauseAmts(t), n = 0;
      for (var i = 0; i < a.length; i++) if (a[i] >= 1) n++;
      return n;
    }

    var CH_T0 = 1.0, CH_GAP = 0.113, CH_FL = 0.8;
    function landedAt(u) {
      var v = (u - CH_T0 - CH_FL) / CH_GAP + 1;
      return v < 0 ? 0 : v > CHUNKS ? CHUNKS : v;
    }

    var IDX_A = { x: 296, y: 118, w: 396, h: 254 };
    var IDX_B = { x: 24, y: 140, w: 226, h: 232 };
    var LAKE_X = 520, LAKE_Y = 140;
    var PIPE_X = 78, PIPE_Y = 76, ELBOW_Y = 300;

    /* ---- the beats --------------------------------------------------------- */

    function drawArrive(t) {
      var e = ease(seg(t, 0, 1.6));
      var cx = (W - PAGE_W) / 2;
      drawPage(
        { x: lerp(-PAGE_W - 40, cx, e), y: (H - PAGE_H) / 2 - 4, w: PAGE_W },
        { detail: seg(t, 0.9, 1.8), scan: -1 }
      );
    }

    function drawRead(t) {
      var slide = ease(seg(t, T_ARRIVE, T_ARRIVE + 0.9));
      var box = {
        x: lerp((W - PAGE_W) / 2, 46, slide),
        y: (H - PAGE_H) / 2 - 4,
        w: PAGE_W
      };
      var s = sweepAt(t);
      var amts = clauseAmts(t);
      drawPage(box, { detail: 1, clauses: amts, scan: s > 0 && s < 1 ? s : -1 });
      drawChips(box, amts, 1);
      drawClauseCounter(detectedAt(t), seg(t, T_ARRIVE + 0.6, T_ARRIVE + 1.2));
    }

    function drawStore(t) {
      var u = t - T_READ;
      var box = { x: 46, y: (H - PAGE_H) / 2 - 4, w: PAGE_W };
      var amts = clauseAmts(t);

      drawBucket(LAKE_X, LAKE_Y, 1, seg(u, 0, 0.7), true);
      ctx.save();
      ctx.globalAlpha = seg(u, 0.3, 0.9);
      ctx.textAlign = "center";
      setFont(9, 500);
      ctx.fillStyle = C.faint;
      ctx.fillText(PAGES + " pages, " + CLAUSES + " clauses, one system of record",
                   LAKE_X, LAKE_Y + 70 + 15 + 40);
      ctx.restore();

      var fly = ease(seg(u, 0.6, 2.3));
      var fade = 1 - seg(u, 1.9, 2.4);
      drawChips(box, amts, (1 - seg(u, 0, 0.5)) * 0.9);
      drawPage(
        {
          x: lerp(box.x, LAKE_X - 9, fly),
          y: lerp(box.y, LAKE_Y + 6, fly),
          w: lerp(PAGE_W, 18, fly)
        },
        { alpha: fade, detail: 1 - fly, clauses: amts, scan: -1 }
      );

      // A ring when it lands, so the arrival reads as an event.
      var land = seg(u, 2.2, 3.0);
      if (land > 0 && land < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - land;
        ctx.strokeStyle = C.brand;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(LAKE_X, LAKE_Y, 56 + land * 26, 15 + land * 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawIndexPhase(t) {
      var u = t - T_STORE;
      var mv = ease(seg(u, 0, 0.8));
      var bx = lerp(LAKE_X, PIPE_X, mv), by = lerp(LAKE_Y, PIPE_Y, mv), bs = lerp(1, 0.55, mv);
      drawBucket(bx, by, bs, 1, mv < 0.35);

      var landed = landedAt(u);
      var pipe = seg(u, 0.6, 1.1);

      // The pipe: down out of the lake, then across into the index.
      ctx.save();
      ctx.globalAlpha = pipe;
      ctx.strokeStyle = rgba(C.brand, 0.55);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -(u * 34) % 8;
      ctx.beginPath();
      ctx.moveTo(PIPE_X, by + 70 * bs + 15 * bs);
      ctx.lineTo(PIPE_X, ELBOW_Y);
      ctx.lineTo(IDX_A.x, ELBOW_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      drawIndexBox(IDX_A.x, IDX_A.y, IDX_A.w, IDX_A.h, landed, null, seg(u, 0.5, 1.0));

      // The document comes back small and comes apart into blocks.
      var mp = seg(u, 0.5, 1.0);
      if (mp > 0.01) {
        ctx.save();
        ctx.globalAlpha = mp;
        var px = PIPE_X - 26, py = 178, pw = 52, ph = 66;
        ctx.fillStyle = C.surface;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        rrect(px, py, pw, ph, 3);
        ctx.fill();
        ctx.stroke();
        var left = 1 - landed / CHUNKS;
        for (var b = 0; b < 5; b++) {
          var bt = py + 5 + b * 12;
          ctx.globalAlpha = mp * (b / 5 < left ? 0.9 : 0.12);
          ctx.fillStyle = rgba(C.brand, 0.5);
          rrect(px + 5, bt, pw - 10, 9, 2);
          ctx.fill();
        }
        ctx.globalAlpha = mp;
        ctx.textAlign = "center";
        setFont(8.6, 600);
        ctx.fillStyle = C.faint;
        ctx.fillText("split into chunks", PIPE_X, py + ph + 14);
        ctx.restore();
      }

      // Chunks in flight, each one bound for the row it will occupy.
      for (var i = 0; i < CHUNKS; i++) {
        var dep = CH_T0 + i * CH_GAP;
        if (u < dep || u > dep + CH_FL) continue;
        var f = (u - dep) / CH_FL;
        var tx, ty;
        if (f < 0.42) {
          var f1 = f / 0.42;
          tx = PIPE_X;
          ty = lerp(210, ELBOW_Y, f1);
        } else {
          var f2 = (f - 0.42) / 0.58;
          var target = rowY(IDX_A.y, IDX_A.h, landed, i) + ROW_H / 2;
          tx = lerp(PIPE_X, IDX_A.x + 40, ease(f2));
          ty = lerp(ELBOW_Y, target, ease(f2));
        }
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = rgba(C.brand, 0.18);
        ctx.strokeStyle = rgba(C.brand, 0.8);
        ctx.lineWidth = 1;
        rrect(tx - 12, ty - 5, 24, 10, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba(C.brand, 0.85);
        for (var k = 0; k < 4; k++) {
          var hh = 1.5 + barAt(i, k) * 5;
          ctx.fillRect(tx - 8 + k * 4, ty + 3 - hh, 2, hh);
        }
        ctx.restore();
      }
    }

    function drawRetrieve(t) {
      var u = t - T_INDEX;
      var f = ease(seg(u, 0, 0.7));
      var bx = lerp(IDX_A.x, IDX_B.x, f), by = lerp(IDX_A.y, IDX_B.y, f);
      var bw = lerp(IDX_A.w, IDX_B.w, f), bh = lerp(IDX_A.h, IDX_B.h, f);

      var glow = seg(u, 1.0, 1.6);
      var hi = {};
      for (var r = 0; r < RETRIEVED.length; r++) hi[RETRIEVED[r]] = glow;
      drawIndexBox(bx, by, bw, bh, CHUNKS, hi, 1);

      var ax = 137, ay = 74;
      drawAgent(ax, ay, 27, seg(u, 0.15, 0.7));

      ctx.save();
      ctx.globalAlpha = seg(u, 0.6, 1.1);
      ctx.textAlign = "left";
      setFont(8.8, 600);
      ctx.fillStyle = C.muted;
      ctx.fillText("Query: rebate terms for " + CUSTOMER, IDX_B.x, IDX_B.y - 12);
      ctx.restore();

      // The retrieved rows leave the index and go to the agent.
      for (r = 0; r < RETRIEVED.length; r++) {
        var i = RETRIEVED[r];
        var start = 1.5 + r * 0.16;
        var fl = seg(u, start, start + 0.9);
        if (fl <= 0 || fl >= 1) continue;
        var sy = rowY(by, bh, CHUNKS, i) + ROW_H / 2;
        var sx = bx + bw / 2;
        var e = ease(fl);
        var cxp = lerp(sx, ax, e) - 40 * Math.sin(Math.PI * fl);
        var cyp = lerp(sy, ay, e);
        ctx.save();
        ctx.globalAlpha = 0.9 * (1 - fl * 0.3);
        ctx.fillStyle = rgba(C.strong, 0.2);
        ctx.strokeStyle = C.strong;
        ctx.lineWidth = 1;
        rrect(cxp - 13, cyp - 5.5, 26, 11, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      drawTokenBars(292, 86, 300,
        ease(seg(u, 2.4, 3.3)),
        ease(seg(u, 3.5, 4.5)),
        seg(u, 4.5, 5.1));
    }

    function drawAnswer(t) {
      var pw = 430, ph = 292;
      var px = (W - pw) / 2, py = 62;
      var chip = seg(t, T_RETRIEVE + 0.2, T_RETRIEVE + 0.8);
      drawChip(24, 24, "chunks indexed", String(CHUNKS), chip);
      drawChip(W - 24, 24, "fewer prompt tokens", SAVED_PCT.toFixed(1) + "%", chip, true);

      drawDashboard(px, py, pw, ph, {
        frame: ease(seg(t, T_RETRIEVE, T_RETRIEVE + 0.5)),
        rev: seg(t, D_REV, D_REV + 0.45),
        revAmt: ease(seg(t, D_REV, D_REV + COUNT_DUR)),
        tier: seg(t, D_TIER, D_TIER + 0.45),
        mult: seg(t, D_MULT, D_MULT + 0.45),
        owed: seg(t, D_OWED, D_OWED + 0.45),
        owedAmt: ease(seg(t, D_OWED, D_OWED + COUNT_DUR))
      });
    }

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "butt";
      ctx.textBaseline = "alphabetic";

      if (t < T_ARRIVE) drawArrive(t);
      else if (t < T_READ) drawRead(t);
      else if (t < T_STORE) drawStore(t);
      else if (t < T_INDEX) drawIndexPhase(t);
      else if (t < T_RETRIEVE) drawRetrieve(t);
      else drawAnswer(t);
    }

    /* One settled frame for reduced motion: the two things worth keeping, the
       comparison and the answer, side by side and finished. */
    function renderStatic() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.textBaseline = "alphabetic";
      var dw = Math.min(372, W * 0.53), dx = W - dw - 22;
      drawTokenBars(24, 84, Math.max(110, dx - 24 - 76), 1, 1, 1);
      drawDashboard(dx, 50, dw, 296, {
        frame: 1, rev: 1, revAmt: 1, tier: 1, mult: 1, owed: 1, owedAmt: 1
      });
    }

    /* ---- readouts ---------------------------------------------------------- */

    var phase = "";
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
    function blank(keys) {
      for (var i = 0; i < keys.length; i++) stat(keys[i], NOVALUE);
    }

    function readouts(t) {
      if (t < T_ARRIVE) {
        setPhase("ingest");
        blank(["clauses", "chunks", "tokens", "saved", "revenue", "owed"]);
        return;
      }
      if (t < T_READ) {
        setPhase("read");
        stat("clauses", detectedAt(t) + " of " + CLAUSES);
        blank(["chunks", "tokens", "saved", "revenue", "owed"]);
        return;
      }

      stat("clauses", CLAUSES + " of " + CLAUSES);

      if (t < T_STORE) {
        setPhase("store");
        blank(["chunks", "tokens", "saved", "revenue", "owed"]);
        return;
      }
      if (t < T_INDEX) {
        setPhase("index");
        stat("chunks", Math.floor(landedAt(t - T_STORE)) + " of " + CHUNKS);
        blank(["tokens", "saved", "revenue", "owed"]);
        return;
      }

      stat("chunks", String(CHUNKS));

      if (t < T_RETRIEVE) {
        setPhase("retrieve");
        var u = t - T_INDEX;
        stat("tokens", u < 2.6 ? NOVALUE
          : u < 3.7 ? num(TOK_FULL)
          : num(TOK_RAG) + " of " + num(TOK_FULL));
        stat("saved", u < 4.6 ? NOVALUE : SAVED_PCT.toFixed(1) + "%");
        blank(["revenue", "owed"]);
        return;
      }

      setPhase("answer");
      stat("tokens", num(TOK_RAG) + " of " + num(TOK_FULL));
      stat("saved", SAVED_PCT.toFixed(1) + "%");
      stat("revenue", t < D_REV ? NOVALUE : money(REVENUE * ease(seg(t, D_REV, D_REV + COUNT_DUR))));
      stat("owed", t < D_OWED ? NOVALUE : money(OWED * ease(seg(t, D_OWED, D_OWED + COUNT_DUR))));
    }

    function setCaption(t) {
      if (!caption) return;
      var text;
      if (t < T_ARRIVE) {
        text = "One contract arrives: a " + PAGES + " page master distribution agreement, " +
               "with the money in clause 3.4.";
      } else if (t < T_READ) {
        text = "A model reads the page top to bottom and outlines the clause regions it " +
               "can name, " + CLAUSES + " of them here. The rebate tiers are the one that matters.";
      } else if (t < T_STORE) {
        text = "The document is filed in the data lake, the system of record every " +
               "downstream job reads from.";
      } else if (t < T_INDEX) {
        text = "The text is split into " + CHUNKS + " passages. Each one is embedded and " +
               "written into the vector search index as its own row.";
      } else if (t < T_RETRIEVE) {
        text = "The agent asks for the rebate terms and gets back only the rows that match: " +
               num(TOK_RAG) + " tokens in the prompt instead of " + num(TOK_FULL) + ", a " +
               SAVED_PCT.toFixed(1) + "% reduction.";
      } else {
        text = CUSTOMER + " has cleared the tier " + TIER_NO + " threshold of " +
               money(TIER_MIN) + ", and the tier " + TIER_NO + " rate applies to all " +
               "eligible revenue once a tier is cleared, so " + money(REVENUE) + " at " +
               (TIER_RATE * 100).toFixed(1) + "% is " + money(OWED) + " owed.";
      }
      caption.innerHTML = text;
    }

    function paint(t) {
      if (!sized && !resize()) return;
      render(t);
      readouts(t);
    }

    /* ---- loop --------------------------------------------------------------- */

    var clock = 0, running = false, last = 0, accum = 0, tick = 0;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000;
      if (clock > T_END) clock = 0;

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      paint(clock);
      if (++tick % 6 === 0) setCaption(clock);
    }

    function start() {
      if (running || prefersReduced() || !sized) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    function settle() {
      clock = T_HOLD + 0.5;
      renderStatic();
      readouts(clock);
      setCaption(clock);
    }

    /* First paint waits for a real measurement rather than bailing for good. */
    function boot() {
      if (booted || !resize()) return false;
      booted = true;
      if (prefersReduced()) settle();
      else {
        paint(clock);
        setCaption(clock);
        start();
      }
      return true;
    }

    readColours();
    boot();

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
      resizeTimer = setTimeout(function () {
        if (!booted) { boot(); return; }
        if (!resize()) return;
        if (prefersReduced()) settle();
        else { paint(clock); setCaption(clock); }
      }, 150);
    });

    new MutationObserver(function () {
      readColours();
      if (!booted) { boot(); return; }
      if (prefersReduced()) settle();
      else paint(clock);
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "data-palette"]
    });

    reduceMotion.addEventListener("change", function () {
      if (prefersReduced()) {
        stop();
        settle();
      } else {
        start();
      }
    });
  }

  /* --- Decision system tabs ---------------------------------------------- */
  /* Each tool keeps its own loop and its own IntersectionObserver, so hiding a
     panel pauses it and showing one resumes it with no wiring here. All this
     has to do is swap panels and tell the newly visible canvas to re-measure,
     since a hidden element reports zero size. */

  function initSystems() {
    var root = document.querySelector("[data-systems]");
    if (!root) return;

    var tabs = Array.prototype.slice.call(root.querySelectorAll("[data-system]"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-system-panel]"));
    if (!tabs.length || !panels.length) return;

    function select(name) {
      panels.forEach(function (p) {
        p.hidden = p.getAttribute("data-system-panel") !== name;
      });
      tabs.forEach(function (b) {
        var on = b.getAttribute("data-system") === name;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      window.dispatchEvent(new Event("resize"));
    }

    tabs.forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-system")); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var i = tabs.indexOf(b);
        var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        select(next.getAttribute("data-system"));
      });
    });
  }

  /* --- Pre-AI / Post-AI --------------------------------------------------- */
  /* The old site, kept verbatim under /pre-ai and shown in a frame. The frame
     is only given a src on first open, so the snapshot costs nothing to anyone
     who never presses the button. */

  function initEra() {
    var group = document.querySelector("[data-era]");
    var viewEl = document.querySelector("[data-era-view]");
    if (!group || !viewEl) return;

    var frame = viewEl.querySelector("[data-era-frame]");
    var btns = Array.prototype.slice.call(group.querySelectorAll("[data-era-set]"));
    var closers = Array.prototype.slice.call(viewEl.querySelectorAll("[data-era-close]"));
    var loaded = false;

    function mark(era) {
      btns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-era-set") === era));
      });
    }

    function show() {
      if (!loaded && frame) { frame.src = "pre-ai/index.html"; loaded = true; }
      viewEl.hidden = false;
      document.body.style.overflow = "hidden";
      mark("pre");
    }
    function hide() {
      viewEl.hidden = true;
      document.body.style.overflow = "";
      mark("post");
    }

    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        b.getAttribute("data-era-set") === "pre" ? show() : hide();
      });
    });
    closers.forEach(function (b) { b.addEventListener("click", hide); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !viewEl.hidden) hide();
    });

    mark("post");
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
    initPalette();
    initKnot();
    initRouting();
    initPricing();
    initContracts();
    initSystems();
    initEra();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
