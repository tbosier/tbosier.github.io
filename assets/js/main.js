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

    var running = false, paused = false, last = 0, accum = 0, ready = false;
    var transportReg = null, rate = 1;
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
      clock += dt / 1000 * rate;
      if (clock > T_END) { endPass(); return; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;
      draw(clock);
      if (transportReg && transportReg.onTick) transportReg.onTick(clock);
    }

    function start() {
      if (paused) return;
      if (running || prefersReduced() || !ready) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    /* A reader lands on the answer, not an empty board. The solve has already
       happened; the animation is how it got there, and watching it is a
       choice rather than a wait. */
    var armed = false;

    function settle() {
      clock = T_END - 1;        // the finished solution, trucks parked
      draw(clock);
    }

    /* These panels can boot late, inside a tab that was closed when the
       control bar was wired up, so arming has to refresh the bar too. */
    function arm(on) {
      armed = !!on;
      if (!transportReg) return;
      if (transportReg.onArm) transportReg.onArm(armed);
      if (transportReg.onTick) transportReg.onTick(clock);
    }

    function endPass() {
      paused = true; stop(); settle(); arm(true);
    }

    function runPass() {
      paused = false; arm(false);
      clock = 0; last = 0; accum = FRAME_MS;
      draw(clock);
      start();
    }

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
        seed++; solve(); fillTables(); runPass();
      });
    }

    readColours();
    solve();
    fillTables();

    /* This panel can start inside a closed tab, where it measures zero.
       Bailing there would mean it never initialises at all, so first paint
       waits for a real measurement. */
    function firstPaint() {
      if (ready || !resize()) return;
      ready = true;
      settle();
      if (!prefersReduced()) { paused = true; arm(true); }
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
      resizeTimer = setTimeout(function () { if (resize()) draw(clock); }, 150);
    });

    new MutationObserver(function () {
      readColours();
      render(clock);
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"]
    });


    transportReg = TRANSPORTS["dispatch"] = {
      isArmed: function () { return armed; },
      run: runPass,
      disarm: function () { if (armed) arm(false); },
      onArm: null,
      setRate: function (r) { rate = r; },
      getRate: function () { return rate; },
      duration: T_END,
      now: function () { return clock; },
      isPaused: function () { return paused; },
      setPaused: function (v) {
        paused = !!v;
        if (paused) stop(); else { last = 0; accum = FRAME_MS; start(); }
      },
      seek: function (t) {
        clock = t;
        draw(clock);
      },
      onTick: null
    };

    reduceMotion.addEventListener("change", function () {
      prefersReduced() ? stop() : start();
    });
  }

  /* --- Pricing: lane rates, borrowed strength ---------------------------- */
  /* The hard part of freight pricing is not the dense lanes, it is that most
     lanes barely move. A lane with five loads has an average, but that average
     is mostly noise, and quoting off it loses money in both directions. So the
     lane is not priced on its own: a three level Normal hierarchy puts each
     lane inside its region and each region inside the network, and the
     posterior mean is a precision weighted blend of the lane's own average and
     its region's. Everything drawn below is computed from the seeded sample,
     so the arithmetic on the canvas is the arithmetic that ran. */

  function initPricing() {
    var root = document.querySelector("[data-pricing]");
    if (!root) return;

    var canvas = root.querySelector(".pricing__canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var caption = root.querySelector("[data-pricing-caption]");
    var stepEls = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });

    var NOVALUE = "\u2014";            // the placeholder the markup ships with
    var SIG = "\u03c3\u00b2";          // sigma squared
    var TAU = "\u03c4\u00b2";          // tau squared

    /* ---- the board ------------------------------------------------------ */

    var WEEKS = 40;                    // weeks of history the warehouse holds
    var W_REF = WEEKS - 1;             // "now": the week every level is quoted at
    var HORIZON = 12;                  // weeks quoted forward

    var REGIONS = [
      { name: "West", base: 2.44 },
      { name: "Midwest", base: 2.05 },
      { name: "South", base: 2.24 }
    ];

    /* per > 0 is a dense lane that runs every week; k is the number of weeks a
       thin lane happened to move at all. The imbalance is the whole point. */
    var SPEC = [
      { o: "LAX", d: "PHX", r: 0, per: 3, k: 0,  off:  0.07 },
      { o: "OAK", d: "LAS", r: 0, per: 0, k: 16, off: -0.03 },
      { o: "SEA", d: "BOI", r: 0, per: 0, k: 7,  off: -0.04 },
      { o: "CHI", d: "ATL", r: 1, per: 3, k: 0,  off: -0.06 },
      { o: "DET", d: "CLE", r: 1, per: 0, k: 23, off:  0.08 },
      { o: "MSP", d: "OMA", r: 1, per: 0, k: 5,  off: -0.02 },
      { o: "DFW", d: "DEN", r: 2, per: 2, k: 0,  off:  0.04 },
      { o: "HOU", d: "MEM", r: 2, per: 0, k: 12, off: -0.07 },
      { o: "ATL", d: "JAX", r: 2, per: 0, k: 9,  off:  0.03 }
    ];

    /* Truth used only to make the sample. Nothing below reads these again. */
    var SEED = 2507;
    var SIGMA_TRUE = 0.23;             // load to load spread, dollars per mile
    var MK_PHI = 0.88, MK_SD = 0.070;  // the market wanders, week to week
    var TREND_TRUE = 0.0035;

    /* ---- seeded sample -------------------------------------------------- */

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

    var lanes = [];
    var model = {};

    function build() {
      var rand = mulberry32(SEED), i, w, k;

      /* One market path shared by every lane: an AR(1) around the trend, which
         is why the forecast has to widen with the horizon. */
      var market = [], m = 0, mbar = 0;
      for (w = 0; w < WEEKS; w++) {
        m = MK_PHI * m + gauss(rand) * MK_SD;
        market.push(m);
        mbar += m;
      }
      mbar /= WEEKS;
      for (w = 0; w < WEEKS; w++) market[w] -= mbar;

      for (i = 0; i < SPEC.length; i++) {
        var S = SPEC[i], weeks = [];
        if (S.per > 0) {
          for (w = 0; w < WEEKS; w++) {
            var cnt = S.per + (rand() < 0.42 ? 1 : 0);
            for (var q = 0; q < cnt; q++) weeks.push(w);
          }
        } else {
          var pool = [];
          for (w = 0; w < WEEKS; w++) pool.push(w);
          for (w = WEEKS - 1; w > 0; w--) {
            var j = Math.floor(rand() * (w + 1));
            var sw = pool[w]; pool[w] = pool[j]; pool[j] = sw;
          }
          weeks = pool.slice(0, S.k);
          weeks.sort(function (a, b) { return a - b; });
        }

        var level = REGIONS[S.r].base + S.off, obs = [], seen = {}, cover = 0;
        for (k = 0; k < weeks.length; k++) {
          obs.push({
            w: weeks[k],
            y: level + TREND_TRUE * (weeks[k] - W_REF) + market[weeks[k]] + gauss(rand) * SIGMA_TRUE
          });
          if (!seen[weeks[k]]) { seen[weeks[k]] = 1; cover++; }
        }

        lanes.push({
          o: S.o, d: S.d, r: S.r,
          label: S.o + " to " + S.d,
          n: obs.length, obs: obs, cover: cover
        });
      }
    }

    /* ---- empirical Bayes, three levels ---------------------------------- */

    function fit() {
      var i, k, ln;

      /* 1. One shared trend, estimated within lanes so no lane's level can
            leak into it. This is the pooled fixed effects slope. */
      var sxy = 0, sxx = 0;
      for (i = 0; i < lanes.length; i++) {
        ln = lanes[i];
        if (ln.n < 2) continue;
        var wb = 0, yb = 0;
        for (k = 0; k < ln.n; k++) { wb += ln.obs[k].w; yb += ln.obs[k].y; }
        wb /= ln.n; yb /= ln.n;
        for (k = 0; k < ln.n; k++) {
          sxy += (ln.obs[k].w - wb) * (ln.obs[k].y - yb);
          sxx += (ln.obs[k].w - wb) * (ln.obs[k].w - wb);
        }
      }
      var trend = sxy / sxx;

      /* 2. Every load is carried to the quoting week, so the hierarchy is on
            one comparable number per lane. */
      var ssw = 0, dfw = 0, ntot = 0;
      for (i = 0; i < lanes.length; i++) {
        ln = lanes[i];
        var s = 0;
        for (k = 0; k < ln.n; k++) {
          ln.obs[k].z = ln.obs[k].y - trend * (ln.obs[k].w - W_REF);
          s += ln.obs[k].z;
        }
        ln.ybar = s / ln.n;
        ln.lo = ln.obs[0].y; ln.hi = ln.obs[0].y;
        for (k = 0; k < ln.n; k++) {
          ssw += (ln.obs[k].z - ln.ybar) * (ln.obs[k].z - ln.ybar);
          if (ln.obs[k].y < ln.lo) ln.lo = ln.obs[k].y;
          if (ln.obs[k].y > ln.hi) ln.hi = ln.obs[k].y;
        }
        dfw += ln.n - 1;
        ntot += ln.n;
      }
      var sigma2 = ssw / (dfw - 1);     // one slope spent, hence the extra df

      /* 3. tau2 is the spread of lane levels inside a region. A plain variance
            of the lane averages would count the sampling noise of the thin
            lanes as real lane to lane spread, so solve the weighted moment
            equation instead: each squared deviation is scaled by the variance
            it should have, and the total is matched to its degrees of freedom.
            The root is found by bisection because the left side falls
            monotonically in tau2. */
      function regionFit(t2) {
        var pr = [0, 0, 0], wm = [0, 0, 0], mu = [], a;
        for (a = 0; a < lanes.length; a++) {
          var p = 1 / (t2 + sigma2 / lanes[a].n);
          pr[lanes[a].r] += p;
          wm[lanes[a].r] += p * lanes[a].ybar;
        }
        for (a = 0; a < REGIONS.length; a++) mu.push(wm[a] / pr[a]);
        return { mu: mu, pr: pr };
      }
      function moment(t2) {
        var rf = regionFit(t2), s = 0, a;
        for (a = 0; a < lanes.length; a++) {
          var dv = lanes[a].ybar - rf.mu[lanes[a].r];
          s += dv * dv / (t2 + sigma2 / lanes[a].n);
        }
        return s - (lanes.length - REGIONS.length);
      }
      var lo = 0.00002, hi = 0.25;
      for (i = 0; i < 70; i++) {
        var mid = (lo + hi) / 2;
        if (moment(mid) > 0) lo = mid; else hi = mid;
      }
      var tau2 = (lo + hi) / 2;
      var rf = regionFit(tau2);

      /* 4. The top level. Regions are themselves drawn from the network, so a
            region with little behind it would be pulled in too. These three
            have plenty, so they barely move, and that is worth showing. */
      var mu0 = 0, a2;
      for (a2 = 0; a2 < REGIONS.length; a2++) mu0 += rf.mu[a2];
      mu0 /= REGIONS.length;
      var sr = 0, invp = 0;
      for (a2 = 0; a2 < REGIONS.length; a2++) {
        sr += (rf.mu[a2] - mu0) * (rf.mu[a2] - mu0);
        invp += 1 / rf.pr[a2];
      }
      sr /= REGIONS.length - 1;
      var tau02 = Math.max(0.0004, sr - invp / REGIONS.length);

      var mur = [], regw = [];
      for (a2 = 0; a2 < REGIONS.length; a2++) {
        var pp = 1 / tau02;
        mur.push((rf.pr[a2] * rf.mu[a2] + pp * mu0) / (rf.pr[a2] + pp));
        regw.push(rf.pr[a2] / (rf.pr[a2] + pp));
      }

      /* 5. How far the level itself drifts in a week. Build the network's
            weekly index out of the within lane residuals, then read the growth
            of the squared change against the lag: the intercept of that line
            is the measurement noise and the slope is the weekly drift, so no
            noise correction has to be guessed at. */
      var idxS = [], idxC = [], w2;
      for (w2 = 0; w2 < WEEKS; w2++) { idxS.push(0); idxC.push(0); }
      for (i = 0; i < lanes.length; i++) {
        ln = lanes[i];
        for (k = 0; k < ln.n; k++) {
          idxS[ln.obs[k].w] += ln.obs[k].z - ln.ybar;
          idxC[ln.obs[k].w]++;
        }
      }
      var idx = [];
      for (w2 = 0; w2 < WEEKS; w2++) idx.push(idxC[w2] ? idxS[w2] / idxC[w2] : null);

      var gxs = [], gys = [], lag;
      for (lag = 1; lag <= 8; lag++) {
        var acc = 0, cc = 0;
        for (w2 = 0; w2 + lag < WEEKS; w2++) {
          if (idx[w2] === null || idx[w2 + lag] === null) continue;
          var dv2 = idx[w2 + lag] - idx[w2];
          acc += dv2 * dv2; cc++;
        }
        if (cc) { gxs.push(lag); gys.push(acc / cc); }
      }
      var mx = 0, my = 0;
      for (i = 0; i < gxs.length; i++) { mx += gxs[i]; my += gys[i]; }
      mx /= gxs.length; my /= gys.length;
      var num2 = 0, den2 = 0;
      for (i = 0; i < gxs.length; i++) {
        num2 += (gxs[i] - mx) * (gys[i] - my);
        den2 += (gxs[i] - mx) * (gxs[i] - mx);
      }
      var drift2 = Math.max(0.0002, num2 / den2);

      /* 6. The conjugate posterior, one lane at a time. */
      for (i = 0; i < lanes.length; i++) {
        ln = lanes[i];
        ln.precData = ln.n / sigma2;
        ln.precPrior = 1 / tau2;
        ln.mur = mur[ln.r];
        ln.post = (ln.precData * ln.ybar + ln.precPrior * ln.mur) / (ln.precData + ln.precPrior);
        ln.postVar = 1 / (ln.precData + ln.precPrior);
        ln.weight = ln.precData / (ln.precData + ln.precPrior);
        ln.quote = ln.post + trend;
        ln.quoteSd = Math.sqrt(ln.postVar + drift2);
        ln.quoteLo = ln.quote - 1.96 * ln.quoteSd;
        ln.quoteHi = ln.quote + 1.96 * ln.quoteSd;

        /* The chart has to hold the history and the widest band it will draw. */
        var far = ln.post + trend * HORIZON;
        var sdFar = Math.sqrt(ln.postVar + sigma2 + drift2 * HORIZON);
        ln.yLo = Math.min(ln.lo, far - 1.96 * sdFar) - 0.05;
        ln.yHi = Math.max(ln.hi, far + 1.96 * sdFar) + 0.05;
      }

      model = {
        trend: trend, sigma2: sigma2, tau2: tau2, tau02: tau02,
        drift2: drift2, mu0: mu0, mur: mur, regw: regw, ntot: ntot
      };
    }

    build();
    fit();

    /* Predictive spread for one load h weeks out, and for the lane level. */
    function predSd(ln, h) {
      return Math.sqrt(ln.postVar + model.sigma2 + model.drift2 * h);
    }
    function levelSd(ln, h) {
      return Math.sqrt(ln.postVar + model.drift2 * h);
    }

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
    function money(v) { return "$" + v.toFixed(2); }
    function num(v) { return Math.round(v).toLocaleString("en-US"); }
    function pct(v) { return (v * 100).toFixed(0) + "%"; }
    function setFont(px, weight) { ctx.font = (weight || 500) + " " + px + "px " + C.family; }

    function text(str, x, y, colour, align, px, weight) {
      setFont(px, weight);
      ctx.textAlign = align || "left";
      ctx.fillStyle = colour;
      ctx.fillText(str, x, y);
    }

    /* Longest wording that still fits, then shrink the type as a last resort.
       The panel is narrow on a phone and a clipped sentence is worse than a
       shorter one. */
    function textFit(options, x, y, colour, align, px, weight, maxW) {
      var i;
      for (i = 0; i < options.length; i++) {
        setFont(px, weight);
        if (ctx.measureText(options[i]).width <= maxW) {
          text(options[i], x, y, colour, align, px, weight);
          return;
        }
      }
      var last = options[options.length - 1], p = px;
      setFont(p, weight);
      while (p > 6.5 && ctx.measureText(last).width > maxW) { p -= 0.4; setFont(p, weight); }
      text(last, x, y, colour, align, p, weight);
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

    /* ---- phases, in seconds ---------------------------------------------- */

    var T_BOARD = 2.0;                 // the board alone, selection landing
    var T_COLLECT = 6.2;
    var T_POOL = 12.2;
    var T_FIT = 17.2;
    var T_END = 24.2;

    var STREAM_FROM = 2.7;             // loads start lifting off the board
    var FLIGHT = 0.85;

    /* ---- state ----------------------------------------------------------- */

    var selected = 0, cursor = 0, hover = -1, focused = false;
    var clock = 0, boardF = 0, shrunk = false;
    var rows = [];

    /* ---- board layout ----------------------------------------------------- */

    function layout(f) {
      var bw = lerp(Math.min(470, Math.max(280, W - 90)), Math.min(200, W * 0.30), f);
      var rowH = lerp(23, 16.5, f);
      var regH = lerp(19, 13.5, f);
      var headH = lerp(24, 17, f);
      var padX = lerp(14, 8, f);
      var bh = headH + REGIONS.length * (regH + 3 * rowH) + 10;

      /* A short canvas still has to show all nine rows and the two lines of
         help around the full board, so the rows give way rather than spill. */
      var room = H - lerp(56, 44, f);
      var k = bh > room ? room / bh : 1;
      if (k < 1) {
        rowH *= k; regH *= k; headH *= k;
        bh = headH + REGIONS.length * (regH + 3 * rowH) + 10 * k;
      }
      var bx = lerp((W - bw) / 2, 12, f);
      var by = lerp((H - bh) / 2, 22, f);

      rows = [];
      var y = by + headH, ri, li = 0;
      var bands = [];
      for (ri = 0; ri < REGIONS.length; ri++) {
        bands.push({ y: y, h: regH, region: ri });
        y += regH;
        for (var q = 0; q < 3; q++) {
          rows.push({ x: bx + 3, y: y, w: bw - 6, h: rowH, lane: li });
          y += rowH;
          li++;
        }
      }
      return {
        x: bx, y: by, w: bw, h: bh, rowH: rowH, headH: headH,
        padX: padX, bands: bands,
        fs: lerp(11.2, 8.8, f) * Math.max(0.78, k),
        fsSmall: lerp(9, 7.6, f) * Math.max(0.8, k)
      };
    }

    function drawBoard(f, pulse) {
      var L = layout(f);
      var i;

      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      rrect(L.x, L.y, L.w, L.h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textBaseline = "middle";
      var hy = L.y + L.headH / 2 + 2;
      text("Load board", L.x + L.padX, hy, C.ink, "left", L.fs, 700);
      text("loads", L.x + L.w * 0.66, hy, C.faint, "right", L.fsSmall, 600);
      text("$/mi", L.x + L.w - L.padX, hy, C.faint, "right", L.fsSmall, 600);
      ctx.fillStyle = C.line;
      ctx.fillRect(L.x + 10, L.y + L.headH - 1, L.w - 20, 1);

      for (i = 0; i < L.bands.length; i++) {
        var b = L.bands[i];
        text(REGIONS[b.region].name, L.x + L.padX, b.y + b.h / 2 + 1,
             C.faint, "left", L.fsSmall, 700);
        ctx.fillStyle = rgba(C.line, 0.8);
        ctx.fillRect(L.x + L.padX + 46, b.y + b.h / 2, L.w - L.padX * 2 - 46, 1);
      }

      for (i = 0; i < rows.length; i++) {
        var r = rows[i], ln = lanes[i];
        var on = i === selected;
        var cy = r.y + r.h / 2 + 1;

        if (on) {
          ctx.fillStyle = rgba(C.strong, 0.10 + 0.05 * pulse);
          rrect(r.x, r.y + 1, r.w, r.h - 2, 4);
          ctx.fill();
          ctx.fillStyle = C.strong;
          rrect(r.x + 1, r.y + 3, 2.5, r.h - 6, 1.2);
          ctx.fill();
        } else if (i === hover) {
          ctx.fillStyle = rgba(C.brand, 0.07);
          rrect(r.x, r.y + 1, r.w, r.h - 2, 4);
          ctx.fill();
        }

        text(ln.label, L.x + L.padX, cy, on ? C.strong : C.ink, "left", L.fs, on ? 700 : 500);
        text(String(ln.n), L.x + L.w * 0.66, cy, on ? C.strong : C.muted, "right", L.fs, 600);
        text(ln.ybar.toFixed(2), L.x + L.w - L.padX, cy,
             on ? C.strong : C.muted, "right", L.fs, 600);

        /* A thin lane should look thin from across the room. */
        var bar = Math.min(1, ln.n / 140);
        ctx.fillStyle = rgba(on ? C.strong : C.brand, on ? 0.55 : 0.28);
        ctx.fillRect(L.x + L.w * 0.67, cy + L.rowH * 0.30, (L.w * 0.14) * bar, 2);

        if (focused && i === cursor) {
          ctx.save();
          ctx.setLineDash([3, 2]);
          ctx.strokeStyle = C.brand;
          ctx.lineWidth = 1.4;
          rrect(r.x - 1, r.y, r.w + 2, r.h, 5);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
      ctx.textBaseline = "alphabetic";
      return L;
    }

    /* ---- the analysis area ------------------------------------------------ */

    function areaRect(L) {
      var x = L.x + L.w + 18;
      return { x: x, y: 22, w: Math.max(140, W - x - 16), h: H - 44 };
    }

    /* ---- beat 1: collect --------------------------------------------------- */

    function hopper(A, n) {
      var rim = Math.min(92, A.w * 0.22);
      var neck = Math.max(14, rim * 0.33);
      var depth = Math.min(118, A.h * 0.34);
      var top = A.y + Math.min(104, A.h * 0.30);
      /* Tighten the packing rather than allow a dense lane to pile out of the top:
         capacity is about depth times the mean width over the pitch squared. */
      var pitch = Math.min(8.2, Math.sqrt(depth * Math.max(12, rim + neck - 6) / Math.max(1, n)));
      return {
        cx: A.x + A.w * 0.60, top: top, rim: rim, neck: neck,
        depth: depth, pitch: Math.max(3.2, pitch)
      };
    }

    function pileSlot(hp, i) {
      /* Rows fill from the narrow bottom of the funnel upwards, so the pile
         grows the way a pile grows and a five load lane stays visibly empty. */
      var row = 0, seen = 0, cap = 3;
      while (row < 80) {
        cap = Math.max(3, Math.floor(
          (lerp(hp.neck, hp.rim, clamp01(row * hp.pitch / hp.depth)) * 2 - 6) / hp.pitch));
        if (seen + cap > i) break;
        seen += cap;
        row++;
      }
      var span = (cap - 1) * hp.pitch;
      return {
        x: hp.cx - span / 2 + (i - seen) * hp.pitch,
        y: hp.top + hp.depth - 5 - row * hp.pitch
      };
    }

    function drawHopper(A, ln, landed, alpha) {
      var hp = hopper(A, ln.n);
      ctx.save();
      ctx.globalAlpha = aBase * alpha;

      ctx.beginPath();
      ctx.moveTo(hp.cx - hp.rim, hp.top);
      ctx.lineTo(hp.cx - hp.neck, hp.top + hp.depth);
      ctx.lineTo(hp.cx + hp.neck, hp.top + hp.depth);
      ctx.lineTo(hp.cx + hp.rim, hp.top);
      ctx.closePath();
      ctx.fillStyle = rgba(C.brand, 0.05);
      ctx.fill();
      ctx.strokeStyle = rgba(C.brand, 0.55);
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.strokeStyle = rgba(C.brand, 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hp.cx - hp.rim - 8, hp.top);
      ctx.lineTo(hp.cx + hp.rim + 8, hp.top);
      ctx.stroke();

      var i;
      for (i = 0; i < landed; i++) {
        var s = pileSlot(hp, i);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.9, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.brand, 0.62);
        ctx.fill();
      }

      var ly = hp.top + hp.depth;
      text(String(Math.round(landed)), hp.cx, ly + 34, C.ink, "center", 26, 800);
      text("of " + ln.n + " loads observed", hp.cx, ly + 50, C.muted, "center", 9.4, 600);
      ctx.restore();
    }

    function drawCollect(t, A, L) {
      var ln = lanes[selected];
      var hp = hopper(A, ln.n);
      /* Departures are spaced so that the LAST load lands before the beat
         ends, which is why a dense lane pours and a thin one drips. */
      var landBy = T_COLLECT - 0.35;
      var gap = (landBy - FLIGHT - STREAM_FROM) / Math.max(1, ln.n);
      var landed = 0, i;

      for (i = 0; i < ln.n; i++) {
        var dep = STREAM_FROM + i * gap;
        if (t >= dep + FLIGHT) landed++;
      }

      textFit([ln.label], A.x, A.y + 22, C.strong, "left", 15, 800, A.w);
      textFit(["every load this lane has moved in " + WEEKS + " weeks",
               ln.n + " loads, " + WEEKS + " weeks"],
              A.x, A.y + 38, C.muted, "left", 9.4, 500, A.w);

      drawHopper(A, ln, landed, seg(t, STREAM_FROM - 0.5, STREAM_FROM + 0.2));

      /* The observations are in week order, so the covered weeks fill in as
         the loads land, and a thin lane shows its gaps as it goes. */
      var seenW = {}, covered = 0;
      for (i = 0; i < landed; i++) {
        if (!seenW[ln.obs[i].w]) { seenW[ln.obs[i].w] = 1; covered++; }
      }
      var stripW = Math.min(A.w * 0.46, 300);
      var cellW = Math.max(1.6, (stripW - (WEEKS - 1) * 1.5) / WEEKS);
      var stripY = A.y + 68;
      ctx.save();
      ctx.globalAlpha = aBase * seg(t, STREAM_FROM - 0.5, STREAM_FROM + 0.2);
      textFit(["weeks with freight", "weeks"], A.x, stripY - 6, C.faint, "left", 8.6, 600,
              Math.max(24, stripW - 52));
      text(covered + " of " + WEEKS, A.x + stripW, stripY - 6, C.muted, "right", 8.6, 700);
      for (i = 0; i < WEEKS; i++) {
        var cxw = A.x + i * (cellW + 1.5);
        ctx.fillStyle = seenW[i] ? rgba(C.brand, 0.75) : rgba(C.line, 1);
        ctx.fillRect(cxw, stripY, cellW, 12);
      }
      ctx.restore();

      var src = rows[selected];
      var sx = src.x + src.w - 6, sy = src.y + src.h / 2;

      for (i = 0; i < ln.n; i++) {
        var d2 = STREAM_FROM + i * gap;
        if (t < d2 || t > d2 + FLIGHT) continue;
        var f = (t - d2) / FLIGHT, e = ease(f);
        var slot = pileSlot(hp, i);
        var mxp = (sx + slot.x) / 2;
        /* Fly under the coverage strip, not across the heading. */
        var myp = Math.max(A.y + 88, Math.min(sy, slot.y) - 58);
        var px = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mxp + e * e * slot.x;
        var py = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * myp + e * e * slot.y;
        ctx.beginPath();
        ctx.arc(px, py, 2.9, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.brand, 0.85 * (1 - f * 0.25));
        ctx.fill();
      }

      if (t > landBy) {
        ctx.save();
        ctx.globalAlpha = aBase * seg(t, landBy, landBy + 0.3);
        textFit(["raw average " + money(ln.ybar) + " per mile",
                 "raw average " + money(ln.ybar)],
                hp.cx, hp.top + hp.depth + 74, C.ink, "center", 11, 700, A.w);
        ctx.restore();
      }
    }

    /* ---- beat 2: pool ------------------------------------------------------ */

    function node(x, y, w, h, label, value, tone, alpha) {
      ctx.save();
      ctx.globalAlpha = aBase * alpha;
      ctx.fillStyle = rgba(tone, 0.08);
      ctx.strokeStyle = rgba(tone, 0.55);
      ctx.lineWidth = 1.2;
      rrect(x - w / 2, y - h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();
      text(label, x, y - 2, tone, "center", 9.2, 700);
      text(value, x, y + 11, tone, "center", 10.2, 600);
      ctx.restore();
    }

    function link(x1, y1, x2, y2, tone, alpha, wide) {
      ctx.save();
      ctx.globalAlpha = aBase * alpha;
      ctx.strokeStyle = rgba(tone, wide ? 0.7 : 0.3);
      ctx.lineWidth = wide ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, (y1 + y2) / 2, x2, (y1 + y2) / 2, x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    /* The rate axis is a fixed 70 cent window on every lane, so a lane that
       hardly moves cannot be made to look like one that moves a long way. */
    var POOL_SPAN = 0.70;

    function drawShrink(x, y, w, ln, slide, showWeight) {
      var c = ln.mur, x0 = c - POOL_SPAN / 2, x1 = c + POOL_SPAN / 2;
      function gx(v) { return x + (clamp01((v - x0) / (x1 - x0))) * w; }

      ctx.strokeStyle = rgba(C.line, 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5); ctx.lineTo(x + w, y + 0.5);
      ctx.stroke();

      var tick;
      for (tick = -3; tick <= 3; tick++) {
        var v = c + tick * 0.1;
        ctx.fillStyle = rgba(C.faint, 0.5);
        ctx.fillRect(gx(v), y - 3, 1, 6);
        text(v.toFixed(2), gx(v), y + 16, C.faint, "center", 8, 500);
      }

      var rx = gx(ln.mur), ax = gx(ln.ybar);

      ctx.strokeStyle = rgba(C.muted, 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(rx, y - 26); ctx.lineTo(rx, y - 4);
      ctx.stroke();
      text(REGIONS[ln.r].name + " mean " + money(ln.mur), rx, y - 32, C.muted, "center", 9, 700);

      ctx.strokeStyle = rgba(C.ink, 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ax, y + 24); ctx.lineTo(ax, y + 4);
      ctx.stroke();
      text("lane mean " + money(ln.ybar) + ", " + ln.n + " loads",
           ax, y + 38, C.ink, "center", 9, 700);

      /* The estimate itself, sliding exactly the shrinkage distance. */
      var px = lerp(ax, gx(ln.post), slide);
      ctx.save();
      ctx.strokeStyle = rgba(C.strong, 0.35);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, y); ctx.lineTo(px, y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = C.strong;
      ctx.beginPath();
      ctx.moveTo(px, y - 7);
      ctx.lineTo(px + 6, y - 15);
      ctx.lineTo(px - 6, y - 15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, y, 4.2, 0, Math.PI * 2);
      ctx.fill();

      if (showWeight > 0.01) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * showWeight;
        text(money(lerp(ln.ybar, ln.post, slide)), px, y - 20, C.strong, "center", 11, 800);
        ctx.restore();
      }
    }

    function drawPool(t, A) {
      var ln = lanes[selected];
      var u = t - T_COLLECT;
      var cx = A.x + A.w / 2;
      var aNet = ease(seg(u, 0.0, 0.7));
      var aReg = ease(seg(u, 0.7, 1.5));
      var aLane = ease(seg(u, 1.5, 2.2));
      var aAxis = ease(seg(u, 2.3, 3.0));
      var slide = ease(seg(u, 3.2, 4.5));
      var aMath = seg(u, 4.4, 5.0);

      var yNet = A.y + 26, yReg = A.y + 78, yLane = A.y + 130;
      var gapX = Math.min(132, A.w * 0.30), nodeW = gapX * 0.90;
      var i, rxs = [];
      for (i = 0; i < REGIONS.length; i++) rxs.push(cx + (i - 1) * gapX);

      for (i = 0; i < REGIONS.length; i++) {
        link(cx, yNet + 13, rxs[i], yReg - 13, C.brand, aReg, i === ln.r);
      }
      link(rxs[ln.r], yReg + 13, cx, yLane - 13, C.strong, aLane, true);
      for (i = 0; i < 3; i++) {
        var sx2 = rxs[ln.r] + (i - 1) * gapX * 0.35;
        if (i !== 1) link(rxs[ln.r], yReg + 13, sx2, yLane - 13, C.brand, aLane * 0.6, false);
      }

      node(cx, yNet, Math.min(158, A.w * 0.42), 26, "Network, 9 lanes",
           money(model.mu0), C.brand, aNet);
      for (i = 0; i < REGIONS.length; i++) {
        node(rxs[i], yReg, nodeW, 26, REGIONS[i].name,
             money(model.mur[i]), i === ln.r ? C.strong : C.brand,
             aReg * (i === ln.r ? 1 : 0.55));
      }
      node(cx, yLane, Math.min(166, A.w * 0.44), 26, ln.label,
           ln.n + " loads", C.strong, aLane);

      /* The top level is not decoration: the regions are shrunk towards the
         network too, they simply have enough behind them not to move. */
      ctx.save();
      ctx.globalAlpha = aBase * aReg;
      textFit(["each region keeps " + pct(model.regw[ln.r]) + " of its own data",
               "regions keep " + pct(model.regw[ln.r])],
              cx, yNet - 20, C.faint, "center", 8.6, 500, A.w);
      ctx.restore();

      if (aAxis > 0.01) {
        ctx.save();
        ctx.globalAlpha = aBase * aAxis;
        drawShrink(A.x + 34, A.y + 214, A.w - 68, ln, slide, slide);
        ctx.restore();
      }

      if (aMath > 0.01) {
        ctx.save();
        ctx.globalAlpha = aBase * aMath;
        var y0 = A.y + A.h - 46;
        textFit([pct(ln.weight) + " weight on this lane's own data",
                 pct(ln.weight) + " weight on this lane"],
                A.x, y0, C.strong, "left", 14, 800, A.w);
        textFit(["data precision  n / " + SIG + " = " + ln.n + " / " + model.sigma2.toFixed(4) +
                 " = " + num(ln.precData),
                 "n / " + SIG + " = " + num(ln.precData)],
                A.x, y0 + 18, C.muted, "left", 9.2, 500, A.w);
        textFit(["prior precision  1 / " + TAU + " = 1 / " + model.tau2.toFixed(5) +
                 " = " + num(ln.precPrior),
                 "1 / " + TAU + " = " + num(ln.precPrior)],
                A.x, y0 + 31, C.muted, "left", 9.2, 500, A.w);
        textFit([num(ln.precData) + " / (" + num(ln.precData) + " + " + num(ln.precPrior) +
                 ") = " + (ln.weight * 100).toFixed(1) + "%"],
                A.x, y0 + 44, C.faint, "left", 9.2, 500, A.w);
        ctx.restore();
      }
    }

    /* ---- beats 3 and 4: fit and forecast ------------------------------------ */

    function chartRect(A) {
      return { x: A.x + 40, y: A.y + 34, w: A.w - 52, h: A.h - 82 };
    }

    function drawChart(R, ln, xMax, showPts, fitLine, band95, band50, mid, lvl, quoteA) {
      var x0 = -1, x1 = xMax;
      function gx(w) { return R.x + (w - x0) / (x1 - x0) * R.w; }
      function gy(v) { return R.y + R.h - (v - ln.yLo) / (ln.yHi - ln.yLo) * R.h; }

      var i, h, tickv;

      /* axes */
      ctx.strokeStyle = rgba(C.line, 1);
      ctx.lineWidth = 1;
      var step = (ln.yHi - ln.yLo) / 4;
      for (i = 0; i <= 4; i++) {
        tickv = ln.yLo + i * step;
        var yy = Math.round(gy(tickv)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(R.x, yy); ctx.lineTo(R.x + R.w, yy);
        ctx.stroke();
        text(money(tickv), R.x - 7, yy + 3, C.faint, "right", 8.2, 500);
      }

      var xt = [0, 10, 20, 30, W_REF, 45, 51];
      var xl = ["-39", "-29", "-19", "-9", "now", "+6", "+12"];
      for (i = 0; i < xt.length; i++) {
        if (xt[i] > xMax) continue;
        text(xl[i], gx(xt[i]), R.y + R.h + 15, C.faint, "center", 8.2, 500);
      }
      text("week", R.x + R.w, R.y + R.h + 29, C.faint, "right", 8.2, 500);

      /* the bands, drawn widest first */
      function band(mult, alpha, upto) {
        ctx.fillStyle = rgba(C.brand, alpha);
        ctx.beginPath();
        for (h = 0; h <= upto; h++) {
          var v = ln.post + model.trend * h + mult * predSd(ln, Math.max(h, 0.001));
          h === 0 ? ctx.moveTo(gx(W_REF + h), gy(v)) : ctx.lineTo(gx(W_REF + h), gy(v));
        }
        for (h = upto; h >= 0; h--) {
          var v2 = ln.post + model.trend * h - mult * predSd(ln, Math.max(h, 0.001));
          ctx.lineTo(gx(W_REF + h), gy(v2));
        }
        ctx.closePath();
        ctx.fill();
      }

      if (band95 > 0.01) band(1.96, 0.14, Math.max(1, Math.round(band95 * HORIZON)));
      if (band50 > 0.01) band(0.674, 0.20, Math.max(1, Math.round(band50 * HORIZON)));

      if (lvl > 0.01) {
        var uptoL = Math.max(1, Math.round(lvl * HORIZON));
        ctx.fillStyle = rgba(C.strong, 0.26);
        ctx.beginPath();
        for (h = 0; h <= uptoL; h++) {
          var v3 = ln.post + model.trend * h + 1.96 * levelSd(ln, Math.max(h, 0.001));
          h === 0 ? ctx.moveTo(gx(W_REF + h), gy(v3)) : ctx.lineTo(gx(W_REF + h), gy(v3));
        }
        for (h = uptoL; h >= 0; h--) {
          var v4 = ln.post + model.trend * h - 1.96 * levelSd(ln, Math.max(h, 0.001));
          ctx.lineTo(gx(W_REF + h), gy(v4));
        }
        ctx.closePath();
        ctx.fill();
      }

      /* history */
      if (showPts > 0) {
        var upto = Math.round(showPts * ln.n);
        for (i = 0; i < upto && i < ln.n; i++) {
          ctx.beginPath();
          ctx.arc(gx(ln.obs[i].w), gy(ln.obs[i].y), 2.4, 0, Math.PI * 2);
          ctx.fillStyle = rgba(C.ink, 0.42);
          ctx.fill();
        }
      }

      /* the fitted level and trend through the history */
      if (fitLine > 0.01) {
        var wEnd = lerp(0, W_REF, fitLine);
        ctx.strokeStyle = C.strong;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx(0), gy(ln.post + model.trend * (0 - W_REF)));
        ctx.lineTo(gx(wEnd), gy(ln.post + model.trend * (wEnd - W_REF)));
        ctx.stroke();
      }

      /* the predictive median */
      if (mid > 0.01) {
        var uptoM = lerp(0, HORIZON, mid);
        ctx.strokeStyle = C.strong;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(gx(W_REF), gy(ln.post));
        ctx.lineTo(gx(W_REF + uptoM), gy(ln.post + model.trend * uptoM));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* the "now" rule */
      if (xMax > W_REF + 0.5) {
        ctx.save();
        ctx.strokeStyle = rgba(C.faint, 0.6);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx(W_REF), R.y); ctx.lineTo(gx(W_REF), R.y + R.h);
        ctx.stroke();
        ctx.restore();
      }

      if (quoteA > 0.01) {
        ctx.save();
        ctx.globalAlpha = aBase * quoteA;
        var qx = gx(W_REF + 1), qy = gy(ln.quote);
        ctx.fillStyle = C.strong;
        ctx.strokeStyle = C.surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(qx, qy, 4.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        var l1 = money(ln.quote) + " per mile next week";
        var l2 = "95% " + money(ln.quoteLo) + " to " + money(ln.quoteHi) + " on the lane level";
        setFont(9, 500);
        if (ctx.measureText(l2).width + 18 > R.w) {
          l2 = "95% " + money(ln.quoteLo) + " to " + money(ln.quoteHi);
        }
        setFont(11.5, 700);
        var w1 = ctx.measureText(l1).width;
        setFont(9, 500);
        var w2 = ctx.measureText(l2).width;
        var pw = Math.max(w1, w2) + 18;
        var px = Math.max(R.x, Math.min(qx + 12, R.x + R.w - pw));
        var py = Math.max(R.y + 4, qy - 46);
        ctx.fillStyle = C.surface;
        ctx.strokeStyle = rgba(C.strong, 0.45);
        ctx.lineWidth = 1;
        rrect(px, py, pw, 38, 6);
        ctx.fill(); ctx.stroke();
        text(l1, px + 9, py + 16, C.strong, "left", 11.5, 700);
        text(l2, px + 9, py + 30, C.muted, "left", 9, 500);
        ctx.restore();
      }
    }

    function drawFit(t, A) {
      var ln = lanes[selected];
      var u = t - T_POOL;
      var R = chartRect(A);
      textFit([ln.label + ", " + ln.n + " loads over " + WEEKS + " weeks",
               ln.label + ", " + ln.n + " loads"],
              A.x, A.y + 16, C.ink, "left", 11.5, 700, A.w);
      drawChart(R, ln, W_REF + 1, seg(u, 0.2, 2.8), ease(seg(u, 2.6, 4.2)), 0, 0, 0, 0, 0);

      if (u > 2.9) {
        ctx.save();
        ctx.globalAlpha = aBase * seg(u, 2.9, 3.4);
        var sign = model.trend >= 0 ? "+" : "";
        textFit(["pooled level " + money(ln.post) + ", shared trend " + sign +
                 (model.trend * 100).toFixed(2) + " cents per mile per week",
                 "level " + money(ln.post) + ", trend " + sign +
                 (model.trend * 100).toFixed(2) + "c per week"],
                A.x, A.y + A.h - 6, C.strong, "left", 10, 700, A.w);
        ctx.restore();
      }
    }

    function drawForecast(t, A) {
      var ln = lanes[selected];
      var u = t - T_FIT;
      var R = chartRect(A);
      var xMax = lerp(W_REF + 1, W_REF + HORIZON + 1, ease(seg(u, 0, 1.0)));
      textFit([ln.label + ", " + HORIZON + " weeks ahead", ln.label],
              A.x, A.y + 16, C.ink, "left", 11.5, 700, A.w);
      drawChart(R, ln, xMax, 1, 1,
        ease(seg(u, 0.8, 2.8)), ease(seg(u, 1.5, 3.4)),
        ease(seg(u, 2.0, 3.8)), ease(seg(u, 2.6, 4.2)), seg(u, 4.2, 4.9));

      ctx.save();
      ctx.globalAlpha = aBase * seg(u, 1.2, 1.9);
      textFit(["95% and 50% of individual loads, and the darker band is the lane level itself",
               "95% and 50% of loads, dark band is the lane level",
               "95%, 50%, and the lane level"],
              A.x, A.y + A.h - 6, C.faint, "left", 8.8, 500, A.w);
      ctx.restore();
    }

    /* ---- frame ------------------------------------------------------------- */

    var curF = 0, aBase = 1;

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "butt";
      ctx.textBaseline = "alphabetic";

      var f = shrunk ? 1 : ease(seg(t, T_BOARD, T_BOARD + 1.0));
      if (f >= 1) shrunk = true;
      curF = f;

      var pulse = t < T_BOARD ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
      var L = drawBoard(f, pulse);
      var A = areaRect(L);

      if (t < T_BOARD) {
        ctx.save();
        ctx.globalAlpha = 1 - f;
        textFit(["Nine lanes, three regions, wildly uneven history",
                 "Nine lanes, three regions"],
                L.x + L.w / 2, L.y - 12, C.muted, "center", 10.5, 600, L.w);
        textFit(["Click a lane, or use the arrow keys and Enter",
                 "Click a lane, or press Enter"],
                L.x + L.w / 2, L.y + L.h + 18, C.faint, "center", 9.4, 500, L.w);
        ctx.restore();
        return;
      }

      ctx.save();
      aBase = seg(t, T_BOARD + 0.3, T_BOARD + 0.9);
      ctx.globalAlpha = aBase;
      if (t < T_COLLECT) drawCollect(t, A, L);
      else if (t < T_POOL) drawPool(t, A);
      else if (t < T_FIT) drawFit(t, A);
      else drawForecast(t, A);
      ctx.restore();
      aBase = 1;
    }

    /* One settled frame for reduced motion: a thin lane, its shrinkage and its
       finished forecast, both done. */
    function renderStatic() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.textBaseline = "alphabetic";
      shrunk = true;
      curF = 1;

      var L = drawBoard(1, 0);
      var A = areaRect(L);
      var ln = lanes[selected];

      var R = { x: A.x + 40, y: A.y + 26, w: A.w - 52, h: A.h * 0.52 };
      textFit([ln.label + ", " + ln.n + " loads, quoted " + HORIZON + " weeks out",
               ln.label + ", " + ln.n + " loads"],
              A.x, A.y + 12, C.ink, "left", 11.5, 700, A.w);
      drawChart(R, ln, W_REF + HORIZON + 1, 1, 1, 1, 1, 1, 1, 1);
      drawShrink(A.x + 34, A.y + A.h - 52, A.w - 68, ln, 1, 1);
      textFit([pct(ln.weight) + " weight on this lane's own data",
               pct(ln.weight) + " weight on this lane"],
              A.x + A.w, A.y + A.h - 4, C.strong, "right", 10.5, 700, A.w);
    }

    /* ---- readouts ----------------------------------------------------------- */

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
      var ln = lanes[selected];
      stat("lane", ln.label);

      if (t < T_COLLECT) {
        setPhase("collect");
        var gap = (T_COLLECT - 0.35 - FLIGHT - STREAM_FROM) / Math.max(1, ln.n);
        var shown = Math.max(0, Math.min(ln.n,
          Math.floor((t - STREAM_FROM - FLIGHT) / gap) + 1));
        stat("loads", shown ? shown + " of " + ln.n : NOVALUE);
        blank(["raw", "pooled", "weight", "quote"]);
        return;
      }

      stat("loads", String(ln.n));
      stat("raw", money(ln.ybar));

      if (t < T_POOL) {
        setPhase("pool");
        var slide = ease(seg(t - T_COLLECT, 3.2, 4.5));
        stat("pooled", slide > 0.02 ? money(lerp(ln.ybar, ln.post, slide)) : NOVALUE);
        stat("weight", slide >= 1 ? pct(ln.weight) : NOVALUE);
        stat("quote", NOVALUE);
        return;
      }

      stat("pooled", money(ln.post));
      stat("weight", pct(ln.weight));

      if (t < T_FIT) {
        setPhase("fit");
        stat("quote", NOVALUE);
        return;
      }

      setPhase("forecast");
      stat("quote", t - T_FIT < 4.2 ? NOVALUE
        : money(ln.quote) + " +/- " + (1.96 * ln.quoteSd).toFixed(2));
    }

    function setCaption(t) {
      if (!caption) return;
      var ln = lanes[selected];
      var txt;
      if (t < T_BOARD) {
        txt = "Nine lanes across three regions. " + ln.label + " is up next, with " +
              ln.n + " observed loads against a board where the counts run from 5 to 139.";
      } else if (t < T_COLLECT) {
        txt = "Collecting every load " + ln.label + " has moved: " + ln.n + " of them over " +
              ln.cover + " active weeks. A dense lane pours, a thin lane trickles.";
      } else if (t < T_POOL) {
        txt = ln.label + " gets " + pct(ln.weight) + " of the weight on its own average of " +
              money(ln.ybar) + ". The rest comes from the " + REGIONS[ln.r].name +
              " mean of " + money(ln.mur) + ", which pulls the estimate to " + money(ln.post) + ".";
      } else if (t < T_FIT) {
        txt = "Forty weeks of " + ln.label + " loads, with the pooled level of " +
              money(ln.post) + " and the shared market trend of " +
              (model.trend * 100).toFixed(2) + " cents per mile per week drawn through them.";
      } else {
        txt = "Twelve weeks ahead on " + ln.label + ". Next week quotes at " + money(ln.quote) +
              " per mile, with a 95% interval of " + money(ln.quoteLo) + " to " +
              money(ln.quoteHi) + " on the lane level.";
      }
      caption.innerHTML = txt;
    }

    function paint(t) {
      if (!sized && !resize()) return;
      render(t);
      readouts(t);
    }

    /* ---- selection ----------------------------------------------------------- */

    function select(i) {
      selected = ((i % lanes.length) + lanes.length) % lanes.length;
      cursor = selected;
      clock = 0;
      /* Picking a lane is the request to price it, so it runs. */
      if (sized) runPass();
    }

    function hitTest(e) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return -1;
      /* The backing store is dpr times the CSS box, and the context is scaled
         by dpr, so the drawing coordinates are CSS pixels either way. */
      var px = (e.clientX - rect.left) * (canvas.width / rect.width) / dpr;
      var py = (e.clientY - rect.top) * (canvas.height / rect.height) / dpr;
      layout(curF);
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
      }
      return -1;
    }

    canvas.removeAttribute("aria-hidden");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label",
      "Freight load board with nine lanes. Use the up and down arrow keys to move " +
      "between lanes and Enter to price the highlighted lane.");

    canvas.addEventListener("click", function (e) {
      var i = hitTest(e);
      if (i >= 0) select(i);
    });
    canvas.addEventListener("mousemove", function (e) {
      var i = hitTest(e);
      if (i === hover) return;
      hover = i;
      canvas.style.cursor = i >= 0 ? "pointer" : "default";
      if (!running && sized) paint(clock);
    });
    canvas.addEventListener("mouseleave", function () {
      hover = -1;
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("focus", function () { focused = true; });
    canvas.addEventListener("blur", function () { focused = false; });
    canvas.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Home" || k === "End") {
        e.preventDefault();
        if (k === "Home") cursor = 0;
        else if (k === "End") cursor = lanes.length - 1;
        else cursor = (cursor + (k === "ArrowDown" ? 1 : lanes.length - 1)) % lanes.length;
        if (!running && sized) paint(clock);
      } else if (k === "Enter" || k === " " || k === "Spacebar") {
        e.preventDefault();
        select(cursor);
      }
    });

    /* ---- loop ---------------------------------------------------------------- */

    var running = false, paused = false, last = 0, accum = 0, tick = 0;
    var transportReg = null, rate = 1;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000 * rate;
      if (clock > T_END) { endPass(); return; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      paint(clock);
      if (++tick % 6 === 0) setCaption(clock);
      if (transportReg && transportReg.onTick) transportReg.onTick(clock);
    }

    function start() {
      if (paused) return;
      if (running || prefersReduced() || !sized) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    /* The panel opens on a priced lane, not an empty board. MSP to OMA has
       five loads, which is the whole argument in one row. */
    var armed = false;

    function settle(pick) {
      if (pick) { selected = 5; cursor = selected; }
      clock = T_END - 1;
      renderStatic();
      readouts(clock);
      setCaption(clock);
    }

    /* These panels can boot late, inside a tab that was closed when the
       control bar was wired up, so arming has to refresh the bar too. */
    function arm(on) {
      armed = !!on;
      if (!transportReg) return;
      if (transportReg.onArm) transportReg.onArm(armed);
      if (transportReg.onTick) transportReg.onTick(clock);
    }

    function endPass() {
      paused = true; stop(); settle(false); arm(true);
    }

    function runPass() {
      paused = false; arm(false);
      clock = 0; last = 0; accum = FRAME_MS;
      paint(clock); setCaption(clock);
      start();
    }

    /* First paint waits for a real measurement rather than bailing for good. */
    function boot() {
      if (booted || !resize()) return false;
      booted = true;
      settle(true);
      if (!prefersReduced()) { paused = true; arm(true); }
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
      attributes: true, attributeFilter: ["data-theme"]
    });


    transportReg = TRANSPORTS["pricing"] = {
      isArmed: function () { return armed; },
      run: runPass,
      disarm: function () { if (armed) arm(false); },
      onArm: null,
      setRate: function (r) { rate = r; },
      getRate: function () { return rate; },
      duration: T_END,
      now: function () { return clock; },
      isPaused: function () { return paused; },
      setPaused: function (v) {
        paused = !!v;
        if (paused) stop(); else { last = 0; accum = FRAME_MS; start(); }
      },
      seek: function (t) {
        clock = t;
        paint(clock);
        setCaption(clock);
      },
      onTick: null
    };

    reduceMotion.addEventListener("change", function () {
      if (prefersReduced()) {
        stop();
        settle();
      } else {
        start();
      }
    });
  }

  /* --- Capacity: committing before demand is known ----------------------- */
  /* The other three panels each do one thing: retrieve, optimise, infer. This
     one has to do two at once, which is the part of the job that actually
     bites. Contract volume is committed for the quarter before the quarter is
     known. Under-commit and the overflow goes to the spot market at a premium;
     over-commit and a shortfall fee lands on trucks that never moved. The
     fleet is finite, so the lanes compete.

     That is a two stage stochastic program with recourse. It is solved here by
     sample average approximation: 400 demand scenarios per lane, and the plan
     that minimises mean cost over all of them. The structure is worth knowing,
     because it is what makes this tractable in a browser at all. The capacity
     constraint binds only the first stage variables, and the second stage
     separates by lane, so the Lagrangian decomposes: given one price on
     capacity, each lane's commitment is its own newsvendor quantile, and the
     whole problem collapses to finding the scalar that makes the parts add up
     to the fleet. Correlated demand does not break this, because a lane's
     quantile only ever reads its own marginal.

     Three costs come out, and the ordering between them is a theorem rather
     than an accident: perfect information <= this plan <= planning on mean
     demand. The two gaps are EVPI and the value of the stochastic solution,
     and both are measured on the same 400 scenarios that are drawn. */

  function initCapacity() {
    var root = document.querySelector("[data-capacity]");
    if (!root) return;

    var canvas = root.querySelector(".capacity__canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var caption = root.querySelector("[data-capacity-caption]");
    var stepEls = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var out = {};
    root.querySelectorAll("[data-stat]").forEach(function (el) {
      out[el.getAttribute("data-stat")] = el;
    });

    var NOVALUE = "—";
    var LAM = "λ";

    /* ---- the instance ---------------------------------------------------- */
    /* Eight of the nine lanes are the pricing board's, and PHX to SLC is a
       lane that opened this quarter. The numbers are arranged the way they
       actually arrange themselves in a tight market, which is the only reason
       this problem is interesting: the fattest spot premium on the board sits
       on the lane with six loads of history, and the carrier has priced that
       uncertainty back as a steep minimum volume fee. Planning on a single
       demand number walks straight into it.
         n  loads of history, which sets how well demand is pinned down
         mu expected loads next quarter
         c  contracted cost per load
         s  spot cost per load, always the dearer of the two
         p  minimum volume fee per committed load that goes unused */
    var SPEC = [
      { label: "LAX to PHX", n: 139, mu: 205, c:  980, s: 1290, p:  120 },
      { label: "CHI to ATL", n: 135, mu: 190, c: 1760, s: 2180, p:  170 },
      { label: "DFW to DEN", n: 104, mu: 158, c: 1940, s: 2300, p:  140 },
      { label: "PHX to SLC", n:   6, mu: 145, c: 1180, s: 1880, p: 1150 },
      { label: "DET to CLE", n:  23, mu:  70, c:  520, s:  690, p:   90 },
      { label: "OAK to LAS", n:  16, mu:  52, c: 1420, s: 1910, p:  520 },
      { label: "HOU to MEM", n:  12, mu:  44, c: 1430, s: 1980, p:  610 },
      { label: "ATL to JAX", n:   9, mu:  32, c:  930, s: 1270, p:  430 },
      { label: "MSP to OMA", n:   5, mu:  20, c: 1010, s: 1420, p:  560 }
    ];

    var K = 400;                 // scenarios in the sample average
    var CAP = 700;               // loads the fleet can carry this quarter
    var MARKET = 0.075;          // one shared shock: the whole market moves together
    var SEED = 60317;

    /* ---- scenarios ------------------------------------------------------- */

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

    var lanes = [];
    var SCALE = 1, TOTSCALE = 1, EXPSCALE = 1;

    function quantile(sorted, q) {
      if (q <= 0) return sorted[0];
      if (q >= 1) return sorted[sorted.length - 1];
      var h = (sorted.length - 1) * q, lo = Math.floor(h);
      return sorted[lo] + (h - lo) * (sorted[lo + 1] - sorted[lo]);
    }

    function build() {
      var rand = mulberry32(SEED), i, k;

      /* One market path shared by every lane. It does not change any lane's
         own quantile, and so does not change the plan; it does change what the
         plan is worth, which is the honest part. */
      var shock = [];
      for (k = 0; k < K; k++) shock.push(gauss(rand));

      for (i = 0; i < SPEC.length; i++) {
        var S = SPEC[i];
        /* Thin history means a loose forecast. Same argument the pricing panel
           makes, carried forward into the decision. */
        var cv = 0.10 + 0.55 / Math.sqrt(S.n);
        var sd = S.mu * cv;
        var d = [];
        for (k = 0; k < K; k++) {
          var v = S.mu * (1 + MARKET * shock[k]) + sd * gauss(rand);
          d.push(Math.max(0, Math.round(v)));
        }
        var sorted = d.slice().sort(function (a, b) { return a - b; });
        lanes.push({
          label: S.label, n: S.n, mu: S.mu, sd: sd,
          c: S.c, s: S.s, p: S.p,
          spread: S.s - S.c,            // premium avoided by committing
          d: d, sorted: sorted,
          q10: quantile(sorted, 0.10),
          q50: quantile(sorted, 0.50),
          q90: quantile(sorted, 0.90),
          q99: quantile(sorted, 0.99),
          dbar: d.reduce(function (a, b) { return a + b; }, 0) / K,
          x: 0, xFree: 0
        });
      }
    }

    /* ---- the program ----------------------------------------------------- */

    /* Given one price on capacity, every lane is a newsvendor on its own
       marginal: commit while the spot premium avoided still beats the
       shortfall fee risked, net of what the capacity itself costs. */
    function fractile(ln, lam) {
      return (ln.spread - lam) / (ln.spread + ln.p);
    }
    function allocate(lam) {
      var x = [], tot = 0;
      for (var i = 0; i < lanes.length; i++) {
        var q = fractile(lanes[i], lam);
        var v = q <= 0 ? 0 : quantile(lanes[i].sorted, q);
        if (v < 0) v = 0;
        x.push(v); tot += v;
      }
      return { x: x, tot: tot };
    }

    /* Whole loads, and they must still add to the fleet exactly. Largest
       remainder does that without quietly inventing or losing one. */
    function roundToCap(x, cap) {
      var i, out = [], frac = [], sum = 0;
      for (i = 0; i < x.length; i++) {
        var f = Math.floor(x[i]);
        out.push(f); frac.push({ i: i, r: x[i] - f }); sum += f;
      }
      var left = Math.round(cap) - sum;
      frac.sort(function (a, b) { return b.r - a.r; });
      for (i = 0; i < frac.length && left > 0; i++) { out[frac[i].i]++; left--; }
      for (i = frac.length - 1; i >= 0 && left < 0; i--) {
        if (out[frac[i].i] > 0) { out[frac[i].i]--; left++; }
      }
      return out;
    }

    /* Second stage, evaluated on the sample rather than assumed.

       Worth writing the cost out, because it splits cleanly and the split is
       what makes the comparison legible:

         c*min(d,x) + p*(x-d)+ + s*(d-x)+  ==  c*d + spread*(d-x)+ + p*(x-d)+

       The first term is every load at the contract price. It does not contain
       x at all, so no plan can touch it: on this instance it is $1.23M of the
       bill whatever anyone decides. Everything the decision actually controls
       is in the second part, the spot premium paid on loads that were not
       covered plus the fee on commitments that went unused. That is what gets
       compared below, and it is why the axis there can start at zero. */
    function exposure(x) {
      var tot = 0;
      for (var k = 0; k < K; k++) {
        for (var i = 0; i < lanes.length; i++) {
          var ln = lanes[i], d = ln.d[k], xi = x[i];
          tot += ln.spread * (d > xi ? d - xi : 0) + ln.p * (xi > d ? xi - d : 0);
        }
      }
      return tot / K;
    }

    /* Fill the fleet by the premium each load avoids, richest lane first.
       This is what "plan against a number" looks like once capacity binds, and
       it is also the right answer when demand is genuinely known. */
    function greedyFill(want, cap) {
      var order = [], i;
      for (i = 0; i < lanes.length; i++) order.push(i);
      order.sort(function (a, b) { return lanes[b].spread - lanes[a].spread; });
      var x = [], left = cap;
      for (i = 0; i < lanes.length; i++) x.push(0);
      for (i = 0; i < order.length; i++) {
        var j = order[i], take = Math.min(want[j], left);
        x[j] = take; left -= take;
      }
      return x;
    }

    var res = {};

    function solve() {
      var i;

      /* No price on capacity yet: what every lane would take on its own. */
      var free = allocate(0);
      for (i = 0; i < lanes.length; i++) lanes[i].xFree = free.x[i];
      res.free = free.tot;

      /* Bisect the dual until the parts add up to the fleet. If the lanes
         together want less than the fleet, capacity is free and lambda is 0. */
      var lam = 0;
      if (free.tot > CAP) {
        var hiLam = 0;
        for (i = 0; i < lanes.length; i++) hiLam = Math.max(hiLam, lanes[i].spread);
        var lo = 0, hi = hiLam;
        for (i = 0; i < 60; i++) {
          var mid = (lo + hi) / 2;
          if (allocate(mid).tot > CAP) lo = mid; else hi = mid;
        }
        lam = (lo + hi) / 2;
      }
      res.lam = lam;

      var got = allocate(lam);
      var xInt = roundToCap(got.x, Math.min(CAP, Math.round(got.tot)));
      for (i = 0; i < lanes.length; i++) lanes[i].x = xInt[i];
      res.x = xInt;
      res.committed = xInt.reduce(function (a, b) { return a + b; }, 0);

      /* The three exposures, all on the same 400 scenarios. */
      res.expPlan = exposure(xInt);

      /* Plan against one demand number and capacity goes to whoever offers the
         biggest premium, because with demand known there is nothing else to
         weigh. That is the right answer to the wrong question. */
      var meanWant = [];
      for (i = 0; i < lanes.length; i++) meanWant.push(Math.round(lanes[i].mu));
      res.xMean = roundToCap(greedyFill(meanWant, CAP), Math.min(CAP,
        meanWant.reduce(function (a, b) { return a + b; }, 0)));
      res.expMean = exposure(res.xMean);

      /* Perfect information: solve each scenario knowing its own demand. Not
         achievable, which is the point of measuring it. */
      var tot = 0;
      for (var k = 0; k < K; k++) {
        var want = [];
        for (i = 0; i < lanes.length; i++) want.push(lanes[i].d[k]);
        var xk = greedyFill(want, CAP);
        for (i = 0; i < lanes.length; i++) {
          var ln = lanes[i], d = ln.d[k], xi = xk[i];
          tot += ln.spread * (d > xi ? d - xi : 0) + ln.p * (xi > d ? xi - d : 0);
        }
      }
      res.expPerfect = tot / K;

      /* Locked contract spend, the same under every plan. Shown so the gaps
         below are read against the right denominator. */
      var base = 0;
      for (var k2 = 0; k2 < K; k2++) {
        for (i = 0; i < lanes.length; i++) base += lanes[i].c * lanes[i].d[k2];
      }
      res.base = base / K;

      res.vss = res.expMean - res.expPlan;      // value of the stochastic solution
      res.evpi = res.expPlan - res.expPerfect;  // value of perfect information

      var mx = 0;
      for (i = 0; i < lanes.length; i++) {
        mx = Math.max(mx, lanes[i].q99, lanes[i].xFree, res.xMean[i]);
      }
      SCALE = mx * 1.05;
      TOTSCALE = Math.max(res.free, CAP) * 1.08;
      EXPSCALE = Math.max(res.expMean, res.expPlan, res.expPerfect) * 1.14;
    }

    /* ---- canvas plumbing ------------------------------------------------- */

    var W = 0, H = 0, dpr = 1, C = {}, sized = false, booted = false;

    function readColours() {
      var cs = getComputedStyle(document.documentElement);
      function v(n, f) { return (cs.getPropertyValue(n) || "").trim() || f; }
      C.brand = v("--brand", "#47515f");
      C.strong = v("--brand-strong", "#2a323c");
      C.ink = v("--ink", "#12161c");
      C.muted = v("--ink-muted", "#59636f");
      C.faint = v("--ink-faint", "#8b96a3");
      C.line = v("--line", "#dfe2e7");
      C.surface = v("--bg-elevated", "#ffffff");
      C.family = getComputedStyle(document.body).fontFamily || "sans-serif";
    }
    function rgba(hex, a) {
      hex = (hex || "").replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (isNaN(n)) return "rgba(71,81,95," + a + ")";
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
    }

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

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
    function ease(v) { var u = 1 - clamp01(v); return 1 - u * u * u; }
    function lerp(a, b, f) { return a + (b - a) * f; }
    function num(v) { return Math.round(v).toLocaleString("en-US"); }
    function money(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
    function setFont(px, weight) { ctx.font = (weight || 500) + " " + px + "px " + C.family; }

    function text(str, x, y, colour, align, px, weight) {
      setFont(px, weight);
      ctx.textAlign = align || "left";
      ctx.fillStyle = colour;
      ctx.fillText(str, x, y);
    }
    function textFit(options, x, y, colour, align, px, weight, maxW) {
      var i;
      for (i = 0; i < options.length; i++) {
        setFont(px, weight);
        if (ctx.measureText(options[i]).width <= maxW) {
          text(options[i], x, y, colour, align, px, weight);
          return;
        }
      }
      var last = options[options.length - 1], p = px;
      setFont(p, weight);
      while (p > 6.5 && ctx.measureText(last).width > maxW) { p -= 0.4; setFont(p, weight); }
      text(last, x, y, colour, align, p, weight);
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

    /* ---- timeline -------------------------------------------------------- */

    var T_SCEN = 3.8, T_TRADE = 6.6, T_DUAL = 12.0, T_COMMIT = 13.8, T_END = 18.4;
    var clock = 0;

    function geom() {
      var padX = Math.max(12, W * 0.024);
      var labelW = Math.max(52, Math.min(96, W * 0.113));
      var valueW = Math.max(34, Math.min(58, W * 0.068));
      return {
        padX: padX,
        x0: padX + labelW,
        x1: W - padX - valueW,
        rowsY: H * 0.058,
        rowH: (H * 0.492) / lanes.length,
        totalY: H * 0.602,
        totalH: Math.max(14, H * 0.05),
        cmpY: H * 0.715,
        cmpH: H * 0.25
      };
    }

    /* The dual, and every lane's commitment under it, at time t. */
    function stateAt(t) {
      if (t < T_TRADE) return { lam: 0, grow: ease(seg(t, T_SCEN + 0.15, T_TRADE - 0.2)) };
      if (t < T_DUAL) {
        var f = ease(seg(t, T_TRADE + 0.25, T_DUAL - 0.25));
        return { lam: res.lam * f, grow: 1 };
      }
      return { lam: res.lam, grow: 1 };
    }

    /* ---- drawing --------------------------------------------------------- */

    var DOTS = 44;                     // scenarios drawn per lane, of the 400

    function drawRow(g, i, st, fan, dotF, allocF, showMean) {
      var ln = lanes[i];
      var y = g.rowsY + i * g.rowH + g.rowH * 0.5;
      var span = g.x1 - g.x0;
      function sx(v) { return g.x0 + (v / SCALE) * span; }

      ctx.strokeStyle = rgba(C.line, 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x0, y + g.rowH * 0.34);
      ctx.lineTo(g.x1, y + g.rowH * 0.34);
      ctx.stroke();

      textFit([ln.label, ln.label.replace(" to ", "-")],
              g.x0 - 7, y + 3.2, C.muted, "right", 9.4, 600, g.x0 - g.padX - 7);

      /* the sample itself, thinned so the shape reads */
      if (dotF > 0) {
        var shown = Math.round(DOTS * clamp01(dotF));
        ctx.fillStyle = rgba(C.brand, fan > 0 ? 0.16 : 0.34);
        for (var k = 0; k < shown; k++) {
          var idx = (k * 9 + i * 3) % K;
          var jitter = ((idx % 7) - 3) / 3 * (g.rowH * 0.19);
          ctx.fillRect(sx(ln.d[idx]) - 0.75, y + jitter - 0.75, 1.5, 1.5);
        }
      }

      /* the predictive, once the sample has landed */
      if (fan > 0) {
        var lo = sx(ln.q10), hi = sx(ln.q90), med = sx(ln.q50);
        var cx = lerp(med, lo, fan), w = (hi - lo) * fan;
        /* The band is the point of the panel, so its edges have to be
           findable. A pale fill alone disappears against the surface. */
        ctx.fillStyle = rgba(C.brand, 0.1);
        rrect(cx, y - g.rowH * 0.24, w, g.rowH * 0.48, 3);
        ctx.fill();
        ctx.strokeStyle = rgba(C.brand, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = rgba(C.brand, 0.5);
        ctx.beginPath();
        ctx.moveTo(med, y - g.rowH * 0.26);
        ctx.lineTo(med, y + g.rowH * 0.26);
        ctx.stroke();
      }

      /* what this lane asked for before the fleet was priced */
      if (st.lam > 0.01) {
        var fx = sx(ln.xFree);
        ctx.strokeStyle = rgba(C.faint, 0.8);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(fx, y - g.rowH * 0.3);
        ctx.lineTo(fx, y + g.rowH * 0.3);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* The commitment. Once the plan is settled the row reports the integer
         plan itself, so the nine rows visibly add to the fleet in the readout
         rather than to a rounding of nine separate quantiles. */
      if (allocF > 0) {
        var q = fractile(ln, st.lam);
        var xv = q <= 0 ? 0 : quantile(ln.sorted, q);
        if (xv < 0) xv = 0;
        if (showMean > 0) xv = res.x[i];
        var bw = (sx(xv) - g.x0) * allocF;
        var half = showMean > 0.3 ? 3 : 3.5;
        ctx.fillStyle = C.strong;
        rrect(g.x0, y - half, bw, half * 2, 2.5);
        ctx.fill();

        /* what planning on one demand number would have committed instead */
        if (showMean > 0) {
          ctx.save();
          ctx.globalAlpha = showMean;
          ctx.fillStyle = rgba(C.ink, 0.34);
          rrect(g.x0, y + half + 1.5, Math.max(1.5, sx(res.xMean[i]) - g.x0), 3.5, 1.75);
          ctx.fill();
          ctx.restore();
        }
        text(num(xv), g.x1 + 7, y + 3.2, C.ink, "left", 9.4, 700);
        return xv;
      }
      return 0;
    }

    function drawTotal(g, total, reveal, settled) {
      var y = g.totalY, h = g.totalH, span = g.x1 - g.x0;
      function sx(v) { return g.x0 + (v / TOTSCALE) * span; }

      ctx.fillStyle = rgba(C.line, 0.6);
      rrect(g.x0, y, span, h, 4); ctx.fill();

      var over = total > CAP + 0.5;
      ctx.fillStyle = over ? rgba(C.ink, 0.78) : C.brand;
      rrect(g.x0, y, Math.max(2, sx(total) - g.x0), h, 4); ctx.fill();

      var cx = sx(CAP);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, y - 8); ctx.lineTo(cx, y + h + 8);
      ctx.stroke();
      text("fleet " + num(CAP), cx + 6, y - 12, C.ink, "left", 9, 700);

      if (reveal > 0.02) {
        var msg = over
          ? [num(total) + " loads asked for, " + num(total - CAP) + " over the fleet",
             num(total) + " asked, " + num(total - CAP) + " over"]
          : settled
            ? [num(total) + " loads committed, fleet full", num(total) + " committed"]
            : [num(total) + " loads committed", num(total) + " committed"];
        msg.push(num(total));
        /* The label lives inside the fill, so the fill is the width it has to
           fit. When even the bare number will not, it moves outside. */
        var fillW = Math.max(2, sx(total) - g.x0);
        if (fillW > 54) {
          textFit(msg, g.x0 + 9, y + h * 0.5 + 3.3, C.surface, "left", 9.4, 700, fillW - 18);
        } else {
          text(num(total), g.x0 + fillW + 7, y + h * 0.5 + 3.3, C.ink, "left", 9.4, 700);
        }
      }
      textFit(["total commitment", "total"],
              g.x0 - 7, y + h * 0.5 + 3.2, C.muted, "right", 9.4, 600, g.x0 - g.padX - 7);
    }

    /* Before the answer exists, the lower third carries the argument. */
    function drawNote(g, t) {
      var y = g.cmpY + g.cmpH * 0.34, span = g.x1 - g.x0;
      var a, msg;
      if (t < T_SCEN) {
        a = ease(seg(t, 0.3, 1.2));
        msg = ["400 demand scenarios a lane, drawn from the same predictive the pricing panel builds",
               "400 demand scenarios a lane",
               "400 scenarios a lane"];
      } else if (t < T_TRADE) {
        a = ease(seg(t, T_SCEN, T_SCEN + 0.5));
        msg = ["Each lane's own optimum: commit while the spot premium avoided still beats the shortfall fee risked",
               "Each lane's own optimum, before the fleet is considered",
               "Each lane's own optimum"];
      } else {
        a = ease(seg(t, T_TRADE, T_TRADE + 0.5));
        msg = ["One price on capacity for every lane at once. The thinner the spot premium, the more the lane gives up.",
               "One price on capacity, applied to every lane at once",
               "One price on capacity"];
      }
      ctx.save();
      ctx.globalAlpha = a;
      textFit(msg, g.x0 + span / 2, y, C.muted, "center", 10.2, 500, span);
      if (t >= T_TRADE) {
        textFit([LAM + " = " + money(stateAt(t).lam) + " per load of fleet",
                 LAM + " = " + money(stateAt(t).lam)],
                g.x0 + span / 2, y + 22, C.ink, "center", 13, 700, span);
      }
      ctx.restore();
    }

    /* Perfect information <= this plan <= the mean demand plan. The ordering
       is a theorem, not a result: no plan can beat knowing, and the plan that
       reads the whole distribution cannot do worse than the one that reads its
       mean. What is not a theorem is the size of the two gaps, and those are
       the only numbers here worth arguing about. Bars start at zero because
       exposure genuinely starts at zero. */
    function drawCompare(g, f) {
      /* These labels are wordier than a lane name, so where the board is wide
         enough the bars give up a little length to let them say what they mean
         instead of falling back to one word. */
      var x0 = g.x0 + ((g.x1 - g.x0) > 420 ? 38 : 0);
      var span = g.x1 - x0;
      function sx(v) { return (v / EXPSCALE) * span; }

      ctx.save();
      ctx.globalAlpha = ease(seg(f, 0, 0.16));
      textFit(["Spot premium and unused-commitment fees. The left gap is unreachable; the right gap is what this plan wins back.",
               "Spot premium and unused-commitment fees, over the same 400 scenarios",
               "Spot premium and unused-commitment fees"],
              g.x0, g.cmpY + 1, C.muted, "left", 9.6, 600, g.x1 - g.x0);
      ctx.restore();

      var bars = [
        { v: res.expPerfect, at: 0.16, tone: 0,
          label: ["if demand were known", "if known"] },
        { v: res.expPlan, at: 0.38, tone: 2, label: ["this plan", "plan"] },
        { v: res.expMean, at: 0.64, tone: 1,
          label: ["planned on mean demand", "on mean demand", "mean"] }
      ];
      var barH = Math.max(8, g.cmpH * 0.13);
      var gap = g.cmpH * 0.195;
      var top = g.cmpY + g.cmpH * 0.14;
      var i, bar, a2, y, w;

      for (i = 0; i < bars.length; i++) {
        bar = bars[i];
        a2 = ease(seg(f, bar.at, bar.at + 0.13));
        if (a2 <= 0.01) continue;
        y = top + i * gap;
        w = sx(bar.v) * a2;
        ctx.save();
        ctx.globalAlpha = a2;
        ctx.fillStyle = rgba(C.line, 0.55);
        rrect(x0, y, span, barH, 3); ctx.fill();
        ctx.fillStyle = bar.tone === 2 ? C.strong : bar.tone === 1 ? rgba(C.ink, 0.42) : rgba(C.brand, 0.4);
        rrect(x0, y, Math.max(2, w), barH, 3); ctx.fill();
        textFit(bar.label, x0 - 7, y + barH * 0.5 + 3.2,
                bar.tone === 2 ? C.ink : C.muted, "right",
                bar.tone === 2 ? 9.4 : 9, bar.tone === 2 ? 700 : 500, x0 - g.padX - 7);
        textFit([money(bar.v)], x0 + Math.max(2, w) + 7, y + barH * 0.5 + 3.2,
                bar.tone === 2 ? C.ink : C.muted, "left", 9.2, bar.tone === 2 ? 700 : 500, 90);
        ctx.restore();
      }

      /* Both gaps are differences between bar lengths, so guides through the
         whole block and one line of brackets underneath say it without
         crowding any single row. */
      var bottom = top + 2 * gap + barH;
      var marks = [
        { from: res.expPerfect, to: res.expPlan, at: 0.52,
          label: "EVPI " + money(res.evpi), strong: false },
        { from: res.expPlan, to: res.expMean, at: 0.78,
          label: "VSS " + money(res.vss), strong: true }
      ];
      /* On a narrow board the two spans are close enough that centred labels
         overlap, so they go on separate lines instead of shrinking to nothing. */
      setFont(9.6, 700);
      var lw0 = ctx.measureText(marks[0].label).width;
      var lw1 = ctx.measureText(marks[1].label).width;
      var mid0 = x0 + (sx(marks[0].from) + sx(marks[0].to)) / 2;
      var mid1 = x0 + (sx(marks[1].from) + sx(marks[1].to)) / 2;
      var stack = (mid0 + lw0 / 2 + 8) > (mid1 - lw1 / 2);

      for (i = 0; i < marks.length; i++) {
        var mk = marks[i];
        a2 = ease(seg(f, mk.at, mk.at + 0.14));
        if (a2 <= 0.01) continue;
        var xa = x0 + sx(mk.from), xb = x0 + sx(mk.to);
        var yb = bottom + 9;
        ctx.save();
        ctx.globalAlpha = a2;
        ctx.strokeStyle = mk.strong ? C.strong : rgba(C.ink, 0.45);
        ctx.lineWidth = 1;
        ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath();
        ctx.moveTo(xa, top - 4); ctx.lineTo(xa, yb);
        ctx.moveTo(xb, top - 4); ctx.lineTo(xb, yb);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(xa, yb); ctx.lineTo(xb, yb);
        ctx.moveTo(xa, yb - 3); ctx.lineTo(xa, yb + 3);
        ctx.moveTo(xb, yb - 3); ctx.lineTo(xb, yb + 3);
        ctx.stroke();
        textFit([mk.label], (xa + xb) / 2, yb + (stack ? 14 + i * 12 : 14),
                mk.strong ? C.strong : C.muted, "center", 9.6, 700,
                stack ? span : Math.max(64, Math.abs(xb - xa) + 40));
        ctx.restore();
      }
    }

    function frameAt(t) {
      var g = geom();
      var st = stateAt(t);
      var dotF = seg(t, 0.35, T_SCEN - 0.5);
      var fan = ease(seg(t, T_SCEN - 0.9, T_SCEN + 0.1));
      var allocF = ease(seg(t, T_SCEN + 0.15, T_SCEN + 0.9));
      var total = 0, i;

      var showMean = t >= T_COMMIT ? ease(seg(t, T_COMMIT + 0.3, T_COMMIT + 1.1)) : 0;
      for (i = 0; i < lanes.length; i++) {
        total += drawRow(g, i, st, fan, dotF, allocF * st.grow, showMean);
      }
      if (showMean > 0.02) {
        ctx.save();
        ctx.globalAlpha = showMean;
        textFit(["lower bar: where planning on mean demand would have put the fleet",
                 "lower bar: the mean demand plan", "lower bar: mean demand"],
                g.x1, g.rowsY - 5, C.faint, "right", 8.6, 500, (g.x1 - g.x0) * 0.8);
        ctx.restore();
      }

      if (t >= T_COMMIT) total = res.committed;
      drawTotal(g, total, allocF, t >= T_COMMIT);

      if (t < T_COMMIT) drawNote(g, t);
      else drawCompare(g, seg(t, T_COMMIT + 0.15, T_END - 0.4));
    }

    function render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";
      ctx.lineCap = "butt";
      ctx.textBaseline = "alphabetic";
      frameAt(t);
    }
    function renderStatic() { render(T_END - 0.4); }

    /* ---- readouts -------------------------------------------------------- */

    var phase = "";
    function setPhase(name) {
      if (phase === name) return;
      phase = name;
      stepEls.forEach(function (el) {
        el.setAttribute("aria-current", String(el.getAttribute("data-step") === name));
      });
    }
    function stat(key, value) { if (out[key]) out[key].textContent = value; }
    function blank(keys) { for (var i = 0; i < keys.length; i++) stat(keys[i], NOVALUE); }

    function readouts(t) {
      if (t < T_SCEN) {
        setPhase("scenarios");
        var shown = Math.round(K * clamp01(seg(t, 0.35, T_SCEN - 0.5)));
        stat("scenarios", shown ? num(shown) + " of " + num(K) : NOVALUE);
        blank(["committed", "lambda", "cost", "vss", "evpi"]);
        return;
      }

      stat("scenarios", num(K) + " of " + num(K));

      if (t < T_TRADE) {
        setPhase("trade");
        stat("committed", num(res.free) + " asked, " + num(CAP) + " fleet");
        stat("lambda", NOVALUE);
        blank(["cost", "vss", "evpi"]);
        return;
      }

      var st = stateAt(t);
      if (t < T_DUAL) {
        setPhase("dual");
        stat("committed", num(allocate(st.lam).tot) + " of " + num(CAP));
        stat("lambda", money(st.lam) + " / load");
        blank(["cost", "vss", "evpi"]);
        return;
      }

      stat("committed", num(res.committed) + " of " + num(CAP));
      stat("lambda", money(res.lam) + " / load");

      if (t < T_COMMIT) {
        setPhase("commit");
        blank(["cost", "vss", "evpi"]);
        return;
      }

      setPhase("worth");
      var f = seg(t, T_COMMIT + 0.15, T_END - 0.4);
      stat("cost", f > 0.51 ? money(res.expPlan) : NOVALUE);
      stat("evpi", f > 0.66 ? money(res.evpi) : NOVALUE);
      stat("vss", f > 0.92 ? money(res.vss) : NOVALUE);
    }

    function setCaption(t) {
      if (!caption) return;
      var txt;
      if (t < T_SCEN) {
        txt = "Four hundred demand scenarios a lane, drawn from the same predictive the " +
              "pricing board builds. The lanes with the least history fan the widest.";
      } else if (t < T_TRADE) {
        txt = "On its own, each lane commits up to a newsvendor quantile: the point where the " +
              "spot premium it avoids stops beating the shortfall fee it risks. Together they " +
              "ask for " + num(res.free) + " loads against a fleet of " + num(CAP) + ".";
      } else if (t < T_DUAL) {
        txt = "One price on capacity applies to every lane at once. As it rises each lane " +
              "slides down its own predictive, and the lanes with the thinnest spot premium " +
              "give up the most.";
      } else if (t < T_COMMIT) {
        txt = "The dual settles at " + money(res.lam) + " a load, which is what one more load " +
              "of fleet capacity is worth this quarter. DET to CLE carries the thinnest premium " +
              "on the board, so it is the first lane to stop being protected at all.";
      } else {
        var d = res.x[3] - res.xMean[3], l = res.x[0] - res.xMean[0];
        txt = "Contract spend is " + money(res.base) + " whatever anyone decides, so the only " +
              "thing on the table is the " + money(res.expPlan) + " of premium and fees. " +
              "Planning on mean demand pushes " + Math.abs(d) + " more loads onto PHX to SLC, " +
              "the lane with six loads of history, and takes " + Math.abs(l) + " off LAX to PHX, " +
              "the one it knows best. That trade costs " + money(res.vss) + " a quarter.";
      }
      caption.textContent = txt;
    }

    function paint(t) {
      if (!sized && !resize()) return;
      render(t);
      readouts(t);
    }

    /* ---- loop ------------------------------------------------------------ */

    var running = false, paused = false, last = 0, accum = 0, tick = 0;
    var transportReg = null, rate = 1;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000 * rate;
      if (clock > T_END) { endPass(); return; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      paint(clock);
      if (++tick % 6 === 0) setCaption(clock);
      if (transportReg && transportReg.onTick) transportReg.onTick(clock);
    }

    function start() {
      if (paused) return;
      if (running || prefersReduced() || !sized) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    /* The panel opens on the finished plan: the fleet is already committed and
       the two gaps are already measured. */
    var armed = false;

    function settle() {
      clock = T_END - 0.4;
      renderStatic();
      readouts(clock);
      setCaption(clock);
    }

    function arm(on) {
      armed = !!on;
      if (!transportReg) return;
      if (transportReg.onArm) transportReg.onArm(armed);
      if (transportReg.onTick) transportReg.onTick(clock);
    }

    function endPass() {
      paused = true; stop(); settle(); arm(true);
    }

    function runPass() {
      paused = false; arm(false);
      clock = 0; last = 0; accum = FRAME_MS;
      paint(clock); setCaption(clock);
      start();
    }

    function boot() {
      if (booted || !resize()) return false;
      booted = true;
      settle();
      if (!prefersReduced()) { paused = true; arm(true); }
      return true;
    }

    build();
    solve();
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
      attributes: true, attributeFilter: ["data-theme"]
    });

    transportReg = TRANSPORTS["capacity"] = {
      isArmed: function () { return armed; },
      run: runPass,
      disarm: function () { if (armed) arm(false); },
      onArm: null,
      setRate: function (r) { rate = r; },
      getRate: function () { return rate; },
      duration: T_END,
      now: function () { return clock; },
      isPaused: function () { return paused; },
      setPaused: function (v) {
        paused = !!v;
        if (paused) stop(); else { last = 0; accum = FRAME_MS; start(); }
      },
      seek: function (t) {
        clock = t;
        paint(clock);
        setCaption(clock);
      },
      onTick: null
    };

    reduceMotion.addEventListener("change", function () {
      if (prefersReduced()) { stop(); settle(); } else { start(); }
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
    var T_RETRIEVE = 29.4;
    var T_HOLD = 36.4;                 // dashboard finished, holding
    var T_END = 38.4;

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


    /* A four point twinkle reads as a sparkle at this size; a round dot just
       looks like dirt on the screen. */
    function sparkPoint(cx, cy, s) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.2, cx + s, cy);
      ctx.quadraticCurveTo(cx + s * 0.2, cy + s * 0.2, cx, cy + s);
      ctx.quadraticCurveTo(cx - s * 0.2, cy + s * 0.2, cx - s, cy);
      ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.2, cx, cy - s);
      ctx.fill();
    }

    function drawSparkle(cx, cy, r, prog, now) {
      var launch = prog < 1 ? prog : 1;
      var i;
      ctx.save();

      // Two rings expanding out of the number as it lands.
      for (i = 0; i < 2; i++) {
        var rp = launch * 1.5 - i * 0.3;
        if (rp <= 0 || rp >= 1) continue;
        ctx.globalAlpha = 0.3 * (1 - rp);
        ctx.strokeStyle = C.brand;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * (0.62 + rp * 0.7), r * (0.62 + rp * 0.7) * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Then a ring of twinkles that keeps going while the number is up.
      var n = 14;
      for (i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + now * 0.2;
        var wob = 0.84 + 0.18 * Math.sin(now * 2.3 + i * 1.7);
        var px = cx + Math.cos(a) * r * wob;
        var py = cy + Math.sin(a) * r * wob * 0.48;
        var tw = 0.5 + 0.5 * Math.sin(now * 3.2 + i * 2.1);
        ctx.globalAlpha = (0.2 + 0.62 * tw) * launch;
        ctx.fillStyle = C.brand;
        sparkPoint(px, py, (1.3 + tw * 2.5) * launch);
      }
      ctx.restore();
    }

    function drawTokenBars(x, y, maxW, f1, f2, pct, spark, now) {
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

      /* This bar starts level with the one above and collapses down to the
         retrieved size, with its number counting down as it goes. Growing a
         small bar from zero shows the same end state and none of the drop,
         which is the only thing worth looking at here. */
      var ratio = TOK_RAG / TOK_FULL;
      var w2 = maxW * (1 - f2 * (1 - ratio));
      var shown = Math.round(TOK_FULL + (TOK_RAG - TOK_FULL) * f2);
      ctx.fillStyle = rgba(C.brand, 0.95);
      rrect(x, y + 104, Math.max(2, w2), barH, 4); ctx.fill();
      setFont(10, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText(num(shown), x + w2 + 8, y + 104 + barH / 2 + 3.6);

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
        else ctx.fillText("fewer tokens in the prompt", x + bw + 26, y + 172);
        setFont(9, 500);
        ctx.fillStyle = C.faint;
        ctx.fillText(num(TOK_RAG) + " tokens instead of " + num(TOK_FULL) + ".",
                     x, y + (narrow ? 210 : 196));
        ctx.restore();

        if (spark > 0) {
          setFont(27, 800);
          var sw = ctx.measureText(big).width;
          drawSparkle(x + sw / 2, y + 160, Math.max(sw * 0.80, 66), spark, now);
        }
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

      /* Deliberately unhurried. The entire case for the vector index lives in
         the gap between these two bars, and it is missed if it snaps shut. */
      drawTokenBars(292, 86, 300,
        ease(seg(u, 2.4, 3.6)),
        ease(seg(u, 4.4, 7.4)),
        seg(u, 7.5, 8.3),
        seg(u, 7.5, 8.6),
        t);
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
          : u < 4.4 ? num(TOK_FULL)
          : u < 7.4 ? num(Math.round(TOK_FULL + (TOK_RAG - TOK_FULL) * ease(seg(u, 4.4, 7.4)))) +
                      " of " + num(TOK_FULL)
          : num(TOK_RAG) + " of " + num(TOK_FULL));
        stat("saved", u < 7.5 ? NOVALUE : SAVED_PCT.toFixed(1) + "%");
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

    var clock = 0, running = false, paused = false, last = 0, accum = 0, tick = 0;
    var transportReg = null, rate = 1;
    var FRAME_MS = 1000 / 30;

    function frame(now) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      clock += dt / 1000 * rate;
      if (clock > T_END) { endPass(); return; }

      accum += dt;
      if (accum < FRAME_MS) return;
      accum = 0;

      paint(clock);
      if (++tick % 6 === 0) setCaption(clock);
      if (transportReg && transportReg.onTick) transportReg.onTick(clock);
    }

    function start() {
      if (paused) return;
      if (running || prefersReduced() || !sized) return;
      running = true; last = 0; accum = FRAME_MS;
      window.requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    /* The panel opens on the finished dashboard: the rebate is already worked
       out. Watching how it got there is the opt-in. */
    var armed = false;

    function settle() {
      clock = T_HOLD + 0.5;
      renderStatic();
      readouts(clock);
      setCaption(clock);
    }

    /* These panels can boot late, inside a tab that was closed when the
       control bar was wired up, so arming has to refresh the bar too. */
    function arm(on) {
      armed = !!on;
      if (!transportReg) return;
      if (transportReg.onArm) transportReg.onArm(armed);
      if (transportReg.onTick) transportReg.onTick(clock);
    }

    function endPass() {
      paused = true; stop(); settle(); arm(true);
    }

    function runPass() {
      paused = false; arm(false);
      clock = 0; last = 0; accum = FRAME_MS;
      paint(clock); setCaption(clock);
      start();
    }

    /* First paint waits for a real measurement rather than bailing for good. */
    function boot() {
      if (booted || !resize()) return false;
      booted = true;
      settle();
      if (!prefersReduced()) { paused = true; arm(true); }
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
      attributes: true, attributeFilter: ["data-theme"]
    });


    transportReg = TRANSPORTS["contracts"] = {
      isArmed: function () { return armed; },
      run: runPass,
      disarm: function () { if (armed) arm(false); },
      onArm: null,
      setRate: function (r) { rate = r; },
      getRate: function () { return rate; },
      duration: T_END,
      now: function () { return clock; },
      isPaused: function () { return paused; },
      setPaused: function (v) {
        paused = !!v;
        if (paused) stop(); else { last = 0; accum = FRAME_MS; start(); }
      },
      seek: function (t) {
        clock = t;
        paint(clock);
      },
      onTick: null
    };

    reduceMotion.addEventListener("change", function () {
      if (prefersReduced()) {
        stop();
        settle();
      } else {
        start();
      }
    });
  }

  /* --- Transport: pause and scrub ---------------------------------------- */
  /* These animations pack a lot into one pass, and some of it goes by in under
     a second. Each system registers its clock here and a control bar drives
     it, so a reader can stop and go back over any beat. */

  var TRANSPORTS = {};

  function initTransport() {
    Array.prototype.slice.call(document.querySelectorAll("[data-transport]")).forEach(function (bar) {
      var name = bar.getAttribute("data-transport");
      var reg = TRANSPORTS[name];
      if (!reg) { bar.hidden = true; return; }

      var back = bar.querySelector("[data-t-back]");
      var fwd = bar.querySelector("[data-t-fwd]");
      var play = bar.querySelector("[data-t-play]");
      var seek = bar.querySelector("[data-t-seek]");
      var time = bar.querySelector("[data-t-time]");
      var speed = bar.querySelector("[data-t-rate]");
      var dragging = false;
      var hasRun = false;

      function fmt(v) { return v.toFixed(1) + "s"; }

      function paint(t) {
        if (seek && !dragging) seek.value = String(Math.round(t / reg.duration * 1000));
        if (time) time.textContent = fmt(t) + " / " + fmt(reg.duration);
        if (play) {
          var p = reg.isPaused();
          play.setAttribute("aria-pressed", String(p));
          play.setAttribute("aria-label", p ? "Play" : "Pause");
          play.classList.toggle("is-paused", p);
        }
      }
      reg.onTick = paint;

      /* The panel rests on its finished figure, so something has to say there
         is a run behind it. A play glyph in a control bar does not; a labelled
         button over the canvas does. Built here rather than in the markup so
         it never appears for a reader whose JS did not load. */
      var runner = null;
      if (reg.run) {
        runner = document.createElement("button");
        runner.className = "runner";
        runner.type = "button";
        runner.innerHTML =
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>' +
          '<span data-runner-label>Watch it run</span>' +
          '<span class="runner__len">' + Math.round(reg.duration) + 's</span>';
        runner.addEventListener("click", function () {
          hasRun = true;
          reg.run();
          paint(reg.now());
        });
        /* In the control bar rather than over the figure: every corner of
           every canvas already has a label in it, and covering the answer to
           advertise the animation defeats the point of resting on the answer.
           It stands in for the play button, which means nothing at rest. */
        bar.insertBefore(runner, bar.firstChild);
      }

      function setArmed(on) {
        if (!runner) return;
        runner.hidden = !on;
        bar.classList.toggle("is-armed", !!on);
        runner.querySelector("[data-runner-label]").textContent =
          hasRun ? "Run it again" : "Watch it run";
      }
      reg.onArm = setArmed;
      setArmed(reg.isArmed ? reg.isArmed() : false);

      if (speed && reg.setRate) {
        speed.value = String(reg.getRate());
        speed.addEventListener("change", function () {
          reg.setRate(parseFloat(speed.value) || 1);
        });
      }

      if (play) {
        play.addEventListener("click", function () {
          /* Sitting on the finished figure, play means run it, not un-pause a
             clock that is already at the end. */
          if (reg.isArmed && reg.isArmed() && reg.run) { hasRun = true; reg.run(); }
          else reg.setPaused(!reg.isPaused());
          paint(reg.now());
        });
      }
      function nudge(d) {
        if (reg.disarm) reg.disarm();
        reg.setPaused(true);
        reg.seek(Math.max(0, Math.min(reg.duration, reg.now() + d)));
        paint(reg.now());
      }
      if (back) back.addEventListener("click", function () { nudge(-1); });
      if (fwd) fwd.addEventListener("click", function () { nudge(1); });

      if (seek) {
        seek.addEventListener("pointerdown", function () {
          dragging = true;
          if (reg.disarm) reg.disarm();
          reg.setPaused(true);
        });
        seek.addEventListener("input", function () {
          reg.seek(seek.value / 1000 * reg.duration);
          paint(reg.now());
        });
        function release() { dragging = false; }
        seek.addEventListener("pointerup", release);
        seek.addEventListener("pointercancel", release);
        seek.addEventListener("blur", release);
      }

      paint(reg.now());
    });
  }

  /* --- GitHub star count ------------------------------------------------- */
  /* The number in the markup is the last one I saw, so the badge is never
     empty or wrong-looking. If the API answers, it wins. If it does not
     (offline, rate-limited, blocked), nothing changes and nothing breaks. */

  function initStars() {
    Array.prototype.slice.call(document.querySelectorAll("[data-gh-stars]")).forEach(function (el) {
      var repo = el.getAttribute("data-gh-stars");
      var out = el.querySelector("[data-gh-stars-count]");
      if (!repo || !out) return;

      fetch("https://api.github.com/repos/" + repo, {
        headers: { Accept: "application/vnd.github+json" }
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.stargazers_count !== "number") return;
          var n = d.stargazers_count;
          out.textContent = n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
          el.setAttribute("aria-label", n + " stars on GitHub");
        })
        .catch(function () { /* keep the value already on the page */ });
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
    initRouting();
    initPricing();
    initContracts();
    initCapacity();
    initSystems();
    initTransport();
    initEra();
    initYear();
    initStars();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
