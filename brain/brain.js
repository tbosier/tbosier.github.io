/* ==========================================================================
   TAYLOR'S BRAIN — behavior

   One file, one module per room, no dependencies. Rooms initialise lazily on
   first entry, so nothing fetches a cat until somebody asks for a cat.

   Conventions carried over from the main site:
     - reduced motion is honoured globally and checked once, here
     - anything drawn to a canvas must survive being measured at zero size
     - no innerHTML anywhere that touches text we did not author
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var REDUCED = false;
  try { REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };
  var ease  = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* A seeded RNG. Seeding it rather than calling Math.random directly is
     what makes a draw reproducible: print the seed and the picture can be
     asked for again. See FIG 001. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }


  /* ======================================================== ROUTER ===== */

  var ROOMS = ["atrium", "uncertainty", "photographs", "machines",
               "familiars", "obsession", "opinions", "nowhere"];

  var mounted = {};     /* room -> true once initialised */
  var current = null;
  var hooks = {};       /* room -> { init, enter, exit } */

  function register(name, h) { hooks[name] = h; }

  function go(name, push) {
    if (ROOMS.indexOf(name) < 0) name = "atrium";
    if (name === current) return;

    var prev = current;
    if (prev && hooks[prev] && hooks[prev].exit) hooks[prev].exit();

    var node = $("#room-" + name);
    var old = prev && $("#room-" + prev);
    if (old) old.classList.remove("is-open");

    current = name;
    root.setAttribute("data-room", name);

    if (!mounted[name]) {
      mounted[name] = true;
      if (hooks[name] && hooks[name].init) {
        try { hooks[name].init(); }
        catch (err) { /* a broken room must not take the site with it */
          if (window.console) console.error("room " + name + " failed to build", err);
        }
      }
    }

    node.classList.add("is-open");
    node.scrollTop = 0;
    if (hooks[name] && hooks[name].enter) hooks[name].enter();

    var mapLink = $("[data-map-link]");
    if (mapLink) mapLink.hidden = (name === "atrium");

    if (push !== false && location.hash !== "#/" + name) {
      history.pushState(null, "", "#/" + name);
    }

    /* Move the reading position for anyone on a keyboard or a screen
       reader; the room is a new page as far as they are concerned. */
    node.setAttribute("tabindex", "-1");
    try { node.focus({ preventScroll: true }); } catch (e2) {}
  }

  function fromHash() {
    var m = /^#\/([a-z]+)/.exec(location.hash || "");
    return m ? m[1] : "atrium";
  }

  window.addEventListener("popstate", function () { go(fromHash(), false); });
  window.addEventListener("hashchange", function () { go(fromHash(), false); });

  /* Anything with data-goto is a door. */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-goto]");
    if (!t) return;
    ev.preventDefault();
    go(t.getAttribute("data-goto"));
  });


  /* ====================================================== LAYERS ======= */

  /* Overlays stack. Escape closes the one on top — not whichever the router
     happens to check first — and a modal keeps Tab inside itself instead of
     letting it wander into the content it is covering. */

  var layers = [];

  function openLayer(node, close, modal) {
    layers.push({ node: node, close: close, modal: !!modal,
                  from: document.activeElement });
    if (modal) {
      node.setAttribute("role", "dialog");
      node.setAttribute("aria-modal", "true");
    }
  }

  function closeLayer(node) {
    for (var i = layers.length - 1; i >= 0; i--) {
      if (layers[i].node === node) {
        var back = layers[i].from;
        layers.splice(i, 1);
        return back;
      }
    }
    return null;
  }

  function topLayer() { return layers.length ? layers[layers.length - 1] : null; }

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
                  'textarea:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Tab") return;
    var top = topLayer();
    if (!top || !top.modal) return;
    var f = $$(FOCUSABLE, top.node).filter(function (n) {
      return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
    });
    if (!f.length) { ev.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    var at = f.indexOf(document.activeElement);

    /* `at === -1` covers two cases that both have to be caught: focus is
       outside the layer entirely, and focus is on something inside it that
       is not in the tab order — the scrap's article carries tabindex="-1"
       so it can be focused for reading, and Tab from there used to fall
       straight out of the dialog. */
    if (at === -1) {
      ev.preventDefault();
      (ev.shiftKey ? last : first).focus();
    } else if (ev.shiftKey && at === 0) {
      ev.preventDefault(); last.focus();
    } else if (!ev.shiftKey && at === f.length - 1) {
      ev.preventDefault(); first.focus();
    }
  }, true);


  /* ==================================================== LIGHTBOX ======= */

  var lb     = $("[data-lb]");
  var lbImg  = $("[data-lb-img]");
  var lbCap  = $("[data-lb-cap]");
  var lbBack = null;

  function openLB(src, cap, plain, opener) {
    lbImg.src = src;
    lbImg.alt = cap ? cap.split("\n")[0] : "";
    lbCap.textContent = cap || "";
    lb.setAttribute("aria-label", cap ? cap.split("\n")[0] : "Enlarged image");
    lb.classList.toggle("is-plain", !!plain);
    lb.hidden = false;
    openLayer(lb, closeLB, true);
    lbBack = opener || null;
    $("[data-lb-close]").focus();
  }
  function closeLB() {
    if (lb.hidden) return;
    lb.hidden = true;
    lbImg.removeAttribute("src");
    closeLayer(lb);
    if (lbBack) { try { lbBack.focus(); } catch (e) {} lbBack = null; }
  }
  $("[data-lb-close]").addEventListener("click", closeLB);
  lb.addEventListener("click", function (ev) { if (ev.target === lb) closeLB(); });


  /* ======================================================== FIG 001 ==== */

  /* The drawing is a fresh draw on every visit, not a stored picture.

     What is sampled:
       - the SPINE of each limb is a discrete Brownian bridge, pinned at the
         origin and at that limb's terminal. A bridge is exactly the right
         object: a random path conditioned to start and end where we say.
       - the SIDE GROWTH is a branching process with generation-dependent
         offspring: Poisson(lambda) at each node, lambda = 1.75 * 0.62^g.
         It is NOT a subcritical Galton–Watson process -- the first two
         generations have mean 1.75 and 1.09, both above one, and only from
         the third does the mean drop below one. It is also cut off at four
         generations and at a total-segment budget, so what guarantees
         termination here is the cap, not the criticality. Saying otherwise
         would be a nicer sentence and a false one.
       - the ANGLES are wrapped-normal jitter about the parent direction.

       - the ARRANGEMENT: a random global rotation, a random permutation of
         the rooms over seven anchors, and a bounded jitter on each anchor.
         The anchors sit a seventh of a turn apart and the jitter is capped
         well inside that, so the arrangement is free to be random without
         ever letting two labels collide.

     The drawing also grows rather than appearing: the spines reach outward
     first and the fine growth follows them. A branching process is something
     that happens over time, so it is drawn that way.

     The seed is printed under the plate. ?seed=<n> reproduces a draw you
     liked; without one, every reload is a new realisation. */

  register("atrium", (function () {
    /* No angles here: where each room lands is drawn at build time. */
    var BRANCHES = [
      { room: "uncertainty", label: "Mathematics" },
      { room: "photographs", label: "Images" },
      { room: "machines",    label: "Machines" },
      { room: "familiars",   label: "Familiars" },
      { room: "obsession",   label: "Obsessions" },
      { room: "opinions",    label: "Opinions nobody requested" },
      { room: "nowhere",     label: "Things which currently have no purpose" }
    ];

    var CX = 500, CY = 360, RX = 392, RY = 262;
    var LAMBDA = 1.75;          /* offspring mean at the first generation  */
    var DECAY  = 0.62;          /* per-generation factor; mean < 1 from g=2 */
    var SIGMA  = 40;            /* bridge amplitude, in user units        */
    var BUDGET = 1100;          /* a hard cap, so a fat draw cannot stall */

    var limbs = [], raf = 0, mouse = null, t0 = 0, introDone = false, spent = 0;

    /* ---- the samplers ------------------------------------------------ */

    function gauss(r) {
      var u = 1 - r();          /* (0,1], so log() is finite */
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
    }

    /* Knuth. Fine at these lambdas, and it reads like the definition. */
    function poisson(r, lam) {
      var L = Math.exp(-lam), k = 0, p = 1;
      do { k++; p *= r(); } while (p > L);
      return k - 1;
    }

    /* W(i) - (i/n)W(n): a random walk with its endpoint subtracted off,
       which is a Brownian bridge. */
    function bridge(r, n) {
      var walk = [0], w = 0, i;
      for (i = 1; i <= n; i++) { w += gauss(r); walk.push(w); }
      var end = walk[n], out = [];
      for (i = 0; i <= n; i++) out.push(walk[i] - (i / n) * end);
      return out;
    }

    function pathThrough(pts) {
      var d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i - 1] || pts[i], p1 = pts[i],
            p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
        d += "C" + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + "," + (p1.y + (p2.y - p0.y) / 6).toFixed(1) +
             " " + (p2.x - (p3.x - p1.x) / 6).toFixed(1) + "," + (p2.y - (p3.y - p1.y) / 6).toFixed(1) +
             " " + p2.x.toFixed(1) + "," + p2.y.toFixed(1);
      }
      return d;
    }

    /* ---- growth ------------------------------------------------------ */

    /* A branching process is a thing that happens over time, so the drawing
       arrives the way it would be drawn: outward from the centre, the spines
       first and the fine growth catching up behind them. Each path is
       revealed by walking its own stroke-dashoffset down to zero, which is
       why every path is built starting at the end nearest the origin.

       The roughening filter is suspended while this runs. Re-rasterising a
       turbulence displacement over the whole plate on every frame is far too
       expensive, and letting it snap on at the end reads as the ink settling
       into the paper rather than as a glitch. */

    var grown = [], growRaf = 0, g0 = 0, limbHost = null;

    function stage(el, birth, dur) {
      var len = 0;
      try { len = el.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      el.style.strokeDasharray = len + " " + len;
      el.style.strokeDashoffset = len;
      grown.push({ el: el, len: len, birth: birth, dur: dur });
    }

    function growthFrame(ts) {
      if (!g0) g0 = ts;
      var t = ts - g0, done = true;
      for (var i = 0; i < grown.length; i++) {
        var G = grown[i];
        var k = clamp((t - G.birth) / G.dur, 0, 1);
        G.el.style.strokeDashoffset = (G.len * (1 - ease(k))).toFixed(2);
        if (k < 1) done = false;
      }
      if (done) return settle();
      growRaf = requestAnimationFrame(growthFrame);
    }

    function settle() {
      cancelAnimationFrame(growRaf);
      growRaf = 0;
      /* Hand the strokes back to CSS; a leftover dasharray would fight the
         hover states. */
      for (var i = 0; i < grown.length; i++) {
        grown[i].el.style.strokeDasharray = "";
        grown[i].el.style.strokeDashoffset = "";
      }
      grown.length = 0;
      if (limbHost) limbHost.setAttribute("filter", "url(#rough)");
      document.documentElement.classList.add("fig-grown");
    }

    var SPINE_DUR = 1500;

    /* ---- the draw ---------------------------------------------------- */

    function build(seed) {
      var gLimbs = $("[data-fig-limbs]");
      var gNodes = $("[data-fig-nodes]");
      var host   = $("[data-fig-labels]");
      var key    = $("[data-fig-key]");
      var svgEl  = $("[data-fig-svg]");
      var r = rng(seed);
      spent = 0;
      limbHost = gLimbs;

      /* Where each room sits is sampled as well: a random global rotation, a
         random permutation of the rooms over the seven anchors, and a bounded
         jitter on each. The anchors stay about 51 degrees apart and the
         jitter is capped at a quarter of that, so no draw can ever collide
         two labels — the arrangement is random, the legibility is not. */
      var order = BRANCHES.slice();
      for (var q = order.length - 1; q > 0; q--) {
        var w = Math.floor(r() * (q + 1));
        var tmp = order[q]; order[q] = order[w]; order[w] = tmp;
      }
      var rot = r() * 360;
      var SLOT = 360 / order.length;

      if (!REDUCED) gLimbs.removeAttribute("filter");

      order.forEach(function (b, bi) {
        var deg = rot + bi * SLOT + (r() - 0.5) * (SLOT * 0.46);
        var a  = deg * Math.PI / 180;
        var tx = CX + Math.cos(a) * RX;
        var ty = CY + Math.sin(a) * RY;

        var g = svg("g", { "class": "fig__g" });
        g.setAttribute("data-goto", b.room);
        g.style.cursor = "pointer";

        /* spine: Brownian bridge, laid perpendicular to origin -> terminal */
        var STEPS = 8;
        var bz = bridge(r, STEPS);
        var nx = -(ty - CY), ny = (tx - CX);
        var nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;

        var pts = [];
        for (var i = 0; i <= STEPS; i++) {
          var t = i / STEPS;
          /* Clipped, so an unlucky excursion cannot walk off the plate.
             This is why the caption says "clipped": beyond +/-105 user units
             the path stops being a faithful draw from the bridge. */
          var off = clamp(SIGMA * bz[i], -105, 105);
          pts.push({ x: lerp(CX, tx, t) + nx * off, y: lerp(CY, ty, t) + ny * off });
        }
        pts[0] = { x: CX, y: CY };
        pts[STEPS] = { x: tx, y: ty };

        var spine = svg("path", { "class": "fig__limb", d: pathThrough(pts), "stroke-width": 2.1 });
        g.appendChild(spine);
        if (!REDUCED) stage(spine, 0, SPINE_DUR);

        /* side growth: Poisson offspring, mean decaying by generation */
        function grow(x, y, ang, len, wd, depth, lam, birth) {
          if (depth <= 0 || len < 5 || spent > BUDGET) return;
          spent++;

          var seg = [{ x: x, y: y }];
          var px = x, py = y, pa = ang;
          for (var s = 0; s < 3; s++) {
            pa += gauss(r) * 0.3;                 /* wrapped-normal jitter */
            px += Math.cos(pa) * (len / 3);
            py += Math.sin(pa) * (len / 3);
            seg.push({ x: px, y: py });
          }

          var p = svg("path", {
            "class": "fig__limb" + (depth <= 1 ? " fig__filament" : ""),
            d: pathThrough(seg),
            "stroke-width": Math.max(0.5, wd).toFixed(2)
          });
          g.appendChild(p);
          if (!REDUCED) stage(p, birth, 430);

          gNodes.appendChild(svg("circle", {
            "class": "fig__node", cx: px.toFixed(1), cy: py.toFixed(1), r: (wd * 0.9).toFixed(2)
          }));

          var kids = poisson(r, lam);
          for (var k = 0; k < kids; k++) {
            /* fan the children either side of the parent direction */
            var side = (k % 2 ? 1 : -1) * (0.4 + Math.abs(gauss(r)) * 0.3);
            grow(px, py, pa + side, len * (0.54 + r() * 0.2), wd * 0.62,
                 depth - 1, lam * DECAY, birth + 250);
          }
        }

        for (var j = 1; j < pts.length - 1; j++) {
          var prev = pts[j - 1], here = pts[j];
          var base = Math.atan2(here.y - prev.y, here.x - prev.x);
          /* born just after the spine has reached this far along */
          var when = SPINE_DUR * (j / STEPS) + 90;
          var n = poisson(r, LAMBDA);
          for (var c = 0; c < n; c++) {
            var sd = (c % 2 ? 1 : -1) * (0.5 + Math.abs(gauss(r)) * 0.35);
            grow(here.x, here.y, base + sd, 64 - j * 5, 1.5, 3, LAMBDA * DECAY, when);
          }
          gNodes.appendChild(svg("circle", { "class": "fig__node", cx: here.x.toFixed(1), cy: here.y.toFixed(1), r: 2.2 }));
        }

        gLimbs.appendChild(g);

        /* The label, in HTML over the drawing so it can be real type. The
           ring sits close to the terminals rather than far outside them:
           a long name landing at due east has to stay on the plate. */
        var lx = CX + Math.cos(a) * (RX + 26);
        var ly = CY + Math.sin(a) * (RY + 40);
        var btn = el("button", "fig__label", b.label);
        btn.type = "button";
        btn.setAttribute("data-goto", b.room);
        btn.setAttribute("data-side", lx < CX ? "left" : "right");
        btn.style.left = (lx / 1000 * 100) + "%";
        btn.style.top  = (ly / 720 * 100) + "%";
        host.appendChild(btn);

        /* A plate this size cannot carry seven labels on a phone, so on a
           narrow screen the terminals get numerals and the names move into
           a key underneath — which is how a scientific plate has always
           labelled its parts anyway. Numbering runs clockwise from wherever
           this draw happened to start, and the key is built in the same
           order, so the two always agree. */
        var num = svg("text", {
          "class": "fig__num",
          x: (CX + Math.cos(a) * (RX + 22)).toFixed(1),
          y: (CY + Math.sin(a) * (RY + 18)).toFixed(1),
          "text-anchor": "middle"
        });
        num.textContent = String(bi + 1);
        svgEl.appendChild(num);

        var li = document.createElement("li");
        var kb = el("button", "fig__keybtn", b.label);
        kb.type = "button";
        kb.setAttribute("data-goto", b.room);
        li.appendChild(kb);
        key.appendChild(li);

        var rec = { g: g, btn: btn, ang: a, phase: r() * TAU, rot: 0, want: 0 };
        limbs.push(rec);

        function light(on) {
          $$(".fig__limb", g).forEach(function (p) { p.classList.toggle("is-lit", on); });
          btn.classList.toggle("is-lit", on);
          num.classList.toggle("is-lit", on);
        }
        rec.light = light;

        g.addEventListener("mouseenter", function () { light(true); });
        g.addEventListener("mouseleave", function () { light(false); });
        btn.addEventListener("mouseenter", function () { light(true); });
        btn.addEventListener("mouseleave", function () { light(false); });
        btn.addEventListener("focus", function () { light(true); });
        btn.addEventListener("blur", function () { light(false); });
      });

      /* Filaments belonging to no room at all. These are NOT the branching
         process above — each one is a single unbranched random walk whose
         length happens to be Poisson. They are here because I liked them. */
      var extra = 3 + poisson(r, 2);
      for (var f = 0; f < extra; f++) {
        var fa = r() * TAU;
        var fp = [{ x: CX, y: CY }];
        var flx = CX, fly = CY, fang = fa;
        var steps = 4 + poisson(r, 2);
        for (var z = 0; z < steps; z++) {
          fang += gauss(r) * 0.34;
          flx += Math.cos(fang) * 46;
          fly += Math.sin(fang) * 32;
          fp.push({ x: flx, y: fly });
        }
        var fil = svg("path", {
          "class": "fig__limb fig__filament", d: pathThrough(fp), "stroke-width": "1.1"
        });
        gLimbs.appendChild(fil);
        if (!REDUCED) stage(fil, 140 + f * 80, 1100);
      }

      if (REDUCED) {
        document.documentElement.classList.add("fig-grown");
      } else {
        growRaf = requestAnimationFrame(growthFrame);
        /* The names arrive once their limb has reached them. */
        setTimeout(function () {
          document.documentElement.classList.add("fig-named");
        }, SPINE_DUR * 0.8);
      }
    }

    function frame(ts) {
      if (!t0) t0 = ts;
      var t = (ts - t0) / 1000;

      limbs.forEach(function (L) {
        /* Ambient breath, plus a small lean toward the pointer. Ceiling of
           about a degree: it should be noticed, never watched. */
        var breath = Math.sin(t * 0.42 + L.phase) * 0.34;
        var pull = 0;
        if (mouse) {
          var d = Math.atan2(mouse.y - CY, mouse.x - CX) - L.ang;
          while (d >  Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          pull = Math.max(0, 1 - Math.abs(d) / 0.9) * (d > 0 ? 0.62 : -0.62);
        }
        L.want = breath + pull;
        L.rot = lerp(L.rot, L.want, 0.07);
        L.g.setAttribute("transform", "rotate(" + L.rot.toFixed(3) + "," + CX + "," + CY + ")");
      });

      raf = requestAnimationFrame(frame);
    }

    return {
      init: function () {
        /* A fresh realisation per visit, unless a seed was asked for. */
        var asked = /[?&]seed=(\d+)/.exec(location.search);
        var seed = asked ? (parseInt(asked[1], 10) >>> 0)
                         : (Math.floor(Math.random() * 0xffffffff) >>> 0);
        build(seed);

        var note = $("[data-fig-draw]");
        if (note) {
          note.textContent =
            "one realisation · spine: Brownian bridge, clipped · " +
            "offspring: Poisson(λ), λ = " + LAMBDA.toFixed(2) + " × " +
            DECAY.toFixed(2) + "^g over 4 generations · seed " + seed +
            " · reload to redraw";
        }

        var plate = $("[data-fig]");
        plate.addEventListener("mousemove", function (ev) {
          var r = plate.getBoundingClientRect();
          if (!r.width) return;
          mouse = {
            x: (ev.clientX - r.left) / r.width * 1000,
            y: (ev.clientY - r.top) / r.height * 720
          };
          var hint = $("[data-hint]");
          if (hint) hint.classList.add("is-gone");
        });
        plate.addEventListener("mouseleave", function () { mouse = null; });
      },

      enter: function () {
        if (!REDUCED && !raf) { t0 = 0; raf = requestAnimationFrame(frame); }

        /* "Then one branch lights up. Follow it." Once, on the first
           arrival, so the map explains itself without a tooltip. */
        if (!introDone) {
          introDone = true;
          setTimeout(function () {
            if (current !== "atrium") return;
            var pick = limbs[Math.floor(Math.random() * limbs.length)];
            pick.light(true);
            setTimeout(function () { pick.light(false); }, 2100);
          }, REDUCED ? 600 : 3400);
        }
      },

      exit: function () { cancelAnimationFrame(raf); raf = 0; }
    };
  })());


  /* =================================================== UNCERTAINTY ===== */

  register("uncertainty", (function () {
    var cv, ctx, raf = 0, w = 0, h = 0, dpr = 1;
    var xbar = 0.75, n = 6, target = { x: 0.75, n: 6 };

    function resize() {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;     /* measured at zero: wait */
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    var dens = function (x, mu, sd) {
      var z = (x - mu) / sd;
      return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(TAU));
    };

    function paint(ts) {
      raf = requestAnimationFrame(paint);
      if (!w && !resize()) return;

      /* The room breathes: the sample size wanders a little on its own, so
         the posterior is never quite still even when nobody is moving. */
      var breath = REDUCED ? 0 : Math.sin(ts / 2600) * 0.9;

      xbar = lerp(xbar, target.x, REDUCED ? 1 : 0.07);
      n    = lerp(n,    target.n, REDUCED ? 1 : 0.07);
      var nEff = Math.max(1, n + breath);

      /* Conjugate normal update, known variance. Prior N(0, 1); each
         observation carries variance 1; nEff of them arrive at xbar. */
      var prec = 1 + nEff;
      var mu   = (nEff * xbar) / prec;
      var sd   = 1 / Math.sqrt(prec);

      var lo = -3.6, hi = 3.6;
      var padX = 34, padB = 52, padT = 26;
      var px = function (x) { return padX + (x - lo) / (hi - lo) * (w - padX * 2); };
      var top = 1 / (sd * Math.sqrt(TAU));
      var py = function (d) { return (h - padB) - d / (top * 1.06) * (h - padB - padT); };

      ctx.clearRect(0, 0, w, h);

      var ink   = "#17141a";
      var faint = "rgba(23,20,26,0.26)";

      /* baseline */
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, h - padB + 0.5);
      ctx.lineTo(w - padX, h - padB + 0.5);
      ctx.stroke();

      /* the prior, dashed and faint — it is still in the room */
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = faint;
      ctx.beginPath();
      for (var i = 0; i <= 240; i++) {
        var x = lo + (hi - lo) * i / 240;
        var y = py(dens(x, 0, 1));
        i ? ctx.lineTo(px(x), y) : ctx.moveTo(px(x), y);
      }
      ctx.stroke();
      ctx.restore();

      /* The 89% interval. z is the 0.945 quantile of the standard normal,
         because a central 89% interval leaves 5.5% in each tail. 1.6226 --
         which is what this used to say -- spans 89.53%. */
      var z89 = 1.5982;
      var a = mu - z89 * sd, b = mu + z89 * sd;
      ctx.fillStyle = "rgba(138,100,8,0.13)";
      ctx.beginPath();
      ctx.moveTo(px(a), h - padB);
      for (var j = 0; j <= 160; j++) {
        var xb = a + (b - a) * j / 160;
        ctx.lineTo(px(xb), py(dens(xb, mu, sd)));
      }
      ctx.lineTo(px(b), h - padB);
      ctx.closePath();
      ctx.fill();

      /* the posterior */
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var k = 0; k <= 320; k++) {
        var xk = lo + (hi - lo) * k / 320;
        var yk = py(dens(xk, mu, sd));
        k ? ctx.lineTo(px(xk), yk) : ctx.moveTo(px(xk), yk);
      }
      ctx.stroke();

      /* interval rules */
      ctx.strokeStyle = "rgba(23,20,26,0.4)";
      [a, b].forEach(function (v) {
        ctx.beginPath();
        ctx.moveTo(px(v), py(dens(v, mu, sd)));
        ctx.lineTo(px(v), h - padB);
        ctx.stroke();
      });

      /* the observation itself, on the axis */
      ctx.strokeStyle = "#8a6408";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px(xbar), h - padB - 5);
      ctx.lineTo(px(xbar), h - padB + 7);
      ctx.stroke();

      ctx.font = "9.5px ui-monospace, 'JetBrains Mono', Menlo, monospace";
      ctx.fillStyle = "rgba(23,20,26,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("x̄", px(xbar), h - padB + 20);

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(23,20,26,0.42)";
      ctx.fillText("prior  N(0, 1)", padX, padT + 2);
      ctx.fillStyle = "rgba(23,20,26,0.7)";
      ctx.fillText("posterior  μ " + mu.toFixed(2) + "   σ " + sd.toFixed(3), padX, padT + 17);
      ctx.fillText("89% CI  [" + a.toFixed(2) + ", " + b.toFixed(2) + "]", padX, padT + 32);

      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(23,20,26,0.42)";
      /* One decimal, because nEff is genuinely fractional: the room breathes
         by nudging the effective sample size. Printing a rounded integer
         would name a posterior other than the one on screen. */
      ctx.fillText("n = " + nEff.toFixed(1), w - padX, padT + 2);

      announce(mu, sd, a, b, nEff);
    }

    /* Everything above is pixels on a canvas, which is nothing at all to a
       screen reader. Mirror the readout into the DOM, throttled, so it is
       announced once it settles rather than sixty times a second. */
    var live = null, liveAt = 0;
    function announce(mu, sd, lo, hi, n) {
      if (!live) return;
      var now = Date.now();
      if (now - liveAt < 700) return;
      liveAt = now;
      live.textContent =
        "Posterior mean " + mu.toFixed(2) + ", standard deviation " + sd.toFixed(3) +
        ". 89% credible interval " + lo.toFixed(2) + " to " + hi.toFixed(2) +
        ". Effective sample size " + n.toFixed(1) + ".";
    }

    return {
      init: function () {
        cv = $("[data-posterior]");
        ctx = cv.getContext("2d");
        live = $("[data-unc-live]");
        window.addEventListener("resize", function () { w = 0; });

        /* The pointer is one way to supply the data. It cannot be the only
           way, so the plot takes focus and the arrow keys do the same job:
           left and right move the sample mean, up and down the sample size. */
        cv.setAttribute("tabindex", "0");
        cv.addEventListener("keydown", function (ev) {
          var step = ev.shiftKey ? 0.5 : 0.15;
          var k = ev.key, handled = true;
          if (k === "ArrowLeft")       target.x = clamp(target.x - step, -2.6, 2.6);
          else if (k === "ArrowRight") target.x = clamp(target.x + step, -2.6, 2.6);
          else if (k === "ArrowUp")    target.n = clamp(target.n + (ev.shiftKey ? 8 : 2), 1, 45);
          else if (k === "ArrowDown")  target.n = clamp(target.n - (ev.shiftKey ? 8 : 2), 1, 45);
          else if (k === "Home")       { target.x = 0; target.n = 1; }
          else handled = false;
          if (!handled) return;
          ev.preventDefault();
          liveAt = 0;                       /* say it now, not in 700ms */
          var instr = $("[data-unc-instr]");
          if (instr) instr.classList.add("is-gone");
        });

        var room = $("#room-uncertainty");
        room.addEventListener("mousemove", function (ev) {
          var r = cv.getBoundingClientRect();
          if (!r.width) return;
          /* Across: where the data landed. Up: how much of it there is. */
          target.x = clamp((ev.clientX - r.left) / r.width * 5.2 - 2.6, -2.6, 2.6);
          var up = clamp(1 - (ev.clientY - r.top) / Math.max(1, r.height), 0, 1);
          target.n = 1 + up * 44;
          var instr = $("[data-unc-instr]");
          if (instr) instr.classList.add("is-gone");
        });
      },
      enter: function () { w = 0; if (!raf) raf = requestAnimationFrame(paint); },
      exit:  function () { cancelAnimationFrame(raf); raf = 0; }
    };
  })());


  /* ================================================ SCRAPS (sheet) ===== */

  (function () {
    var sheet = $("[data-sheet]");
    var body  = $("[data-sheet-body]");
    var last  = null;
    if (!sheet) return;

    function open(key, opener) {
      var tpl = $('[data-scrap-body="' + key + '"]');
      if (!tpl) return;
      body.textContent = "";
      body.appendChild(tpl.content.cloneNode(true));
      var h = body.querySelector("h2");
      sheet.setAttribute("aria-label", h ? h.textContent : "A scrap of paper");
      sheet.hidden = false;
      openLayer(sheet, close, true);
      last = opener || null;
      body.focus();
    }
    function close() {
      if (sheet.hidden) return;
      sheet.hidden = true;
      body.textContent = "";
      closeLayer(sheet);
      if (last) { try { last.focus(); } catch (e) {} last = null; }
    }

    $$("[data-scrap]").forEach(function (b) {
      b.addEventListener("click", function () { open(b.getAttribute("data-scrap"), b); });
    });
    $("[data-sheet-close]").addEventListener("click", close);
    sheet.addEventListener("click", function (ev) { if (ev.target === sheet) close(); });
    window.__closeSheet = close;
  })();


  /* ==================================================== PHOTOGRAPHS ==== */

  register("photographs", (function () {
    /* Stand-ins from an open stock feed. The captions are the point; the
       pictures are placeholders until real negatives are scanned. */
    var PLATES = [
      { seed: "tb-a1", place: "Houston, Texas",        t: "02:11:43", lens: "56mm / f1.4",  note: "I liked the light.\nThere is no deeper meaning." },
      { seed: "tb-a2", place: "Rotterdam",             t: "17:04:09", lens: "35mm / f2",    note: "The composition is doing something\nwith the diagonal that I could\nexplain at length and will not." },
      { seed: "tb-a3", place: "Unrecorded",            t: "—",        lens: "50mm / f1.8",  note: "I have no memory of taking this." },
      { seed: "tb-a4", place: "Las Cruces, New Mexico",t: "06:52:18", lens: "85mm / f2.8",  note: "Six frames of this. This is the\nworst one. It is also the one\nI keep coming back to." },
      { seed: "tb-a5", place: "A car park",            t: "23:40:02", lens: "28mm / f4",    note: "Late modernism, indifferently lit,\nphotographed by someone waiting\nfor a friend to come out of a shop." },
      { seed: "tb-a6", place: "Utrecht",               t: "08:15:55", lens: "35mm / f5.6",  note: "Sharp in the wrong place.\nKept anyway." },
      { seed: "tb-a7", place: "Somewhere on the A2",   t: "14:27:31", lens: "56mm / f1.4",  note: "An argument about edges." },
      { seed: "tb-a8", place: "Kitchen",               t: "09:03:12", lens: "50mm / f1.8",  note: "Steam. That is the whole photograph." },
      { seed: "tb-a9", place: "Vienna",                t: "19:48:26", lens: "24mm / f8",    note: "I was trying to photograph the\nabsence of the crowd and instead\nphotographed an empty square,\nwhich is not the same thing." },
      { seed: "tb-b1", place: "Unrecorded",            t: "03:19:07", lens: "—",            note: "Underexposed by two stops.\nI am told this was intentional.\nIt was not." },
      { seed: "tb-b2", place: "Amsterdam Noord",       t: "16:30:44", lens: "35mm / f2",    note: "Industrial, ignored, on its way out.\nEverything I photograph is on its way out.\nThis may be worth examining." },
      { seed: "tb-b3", place: "The same window",       t: "07:58:01", lens: "85mm / f2.8",  note: "Frame 41 of an ongoing project\nabout one window.\nNobody has asked about it." }
    ];

    var loupe, sheetEl, ZOOM = 2.7;

    function src(p) { return "https://picsum.photos/seed/" + p.seed + "/900/600"; }

    function caption(p, i) {
      return "IMG " + String(172 + i * 7).padStart(4, "0") + "\n" +
             p.place + "\n" + p.t + "\n" + p.lens + "\n\n" + p.note;
    }

    function moveLoupe(ev) {
      var frame = ev.target.closest && ev.target.closest(".frame");
      var img = frame && $("img", frame);
      if (!frame || !img || !img.classList.contains("is-in")) {
        loupe.classList.remove("is-on");
        sheetEl.classList.remove("is-loupe");   /* give the pointer back */
        return;
      }
      sheetEl.classList.add("is-loupe");
      var r = frame.getBoundingClientRect();
      loupe.classList.add("is-on");
      loupe.style.backgroundImage = 'url("' + img.src + '")';
      loupe.style.backgroundSize = (r.width * ZOOM) + "px " + (r.height * ZOOM) + "px";
      var fx = (ev.clientX - r.left) * ZOOM;
      var fy = (ev.clientY - r.top) * ZOOM;
      loupe.style.backgroundPosition = (84 - fx) + "px " + (84 - fy) + "px";
      loupe.style.transform = "translate(" + ev.clientX + "px," + ev.clientY + "px)";
    }

    return {
      init: function () {
        sheetEl = $("[data-contact]");
        loupe   = $("[data-loupe]");

        PLATES.forEach(function (p, i) {
          var b = el("button", "frame");
          b.type = "button";
          var img = new Image();
          img.alt = "Contact frame " + (i + 1) + ". " + p.place + ".";
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("load", function () { img.classList.add("is-in"); });
          img.addEventListener("error", function () {
            img.remove();
            b.appendChild(el("span", "frame__fail", "FRAME " + (i + 1) + "\nnot returned\nby the feed"));
          });
          img.src = src(p);
          b.appendChild(img);
          b.appendChild(el("span", "frame__no", String(i + 1) + "A"));
          b.addEventListener("click", function () {
            openLB(img.src, caption(p, i), false, b);
          });
          sheetEl.appendChild(b);
        });

        sheetEl.addEventListener("mousemove", moveLoupe);
        sheetEl.addEventListener("mouseleave", function () {
          loupe.classList.remove("is-on");
          sheetEl.classList.remove("is-loupe");
        });
      },
      exit: function () { if (loupe) loupe.classList.remove("is-on"); }
    };
  })());


  /* ======================================================= MACHINES ==== */

  register("machines", (function () {
    var BOXES = [
      { id: "intake",   x: 34,  y: 200, w: 118, h: 54, t: "INTAKE",        s: "orders, tenders",
        rows: [["throughput", "~9k rows / min"], ["schema drift", "twice a year, unannounced"]],
        d: "fine. nobody has ever\nthanked it." },
      { id: "feat",     x: 196, y: 200, w: 132, h: 54, t: "FEATURE STORE", s: "point-in-time",
        rows: [["lag", "~40 min"], ["leakage guards", "3"]],
        d: "the lag is where the\nbodies are buried." },
      { id: "legacy",   x: 382, y: 96,  w: 158, h: 58, t: "LEGACY FORECAST", s: "spreadsheet, 2016",
        rows: [["MAE", "~$7,000,000"], ["owner", "left in 2021"]],
        d: "not particularly good." },
      { id: "m07",      x: 382, y: 292, w: 158, h: 58, t: "MODEL 07",      s: "hierarchical + GBM",
        rows: [["MAE", "~$3,500,000"], ["retrains", "weekly"]],
        d: "less wrong." },
      { id: "recon",    x: 594, y: 200, w: 132, h: 54, t: "RECONCILE",     s: "4 levels",
        rows: [["coherent", "yes"], ["cost of coherence", "a little accuracy"]],
        d: "makes the arithmetic add up,\nwhich turns out to matter\nmore to people than being right." },
      { id: "decide",   x: 778, y: 200, w: 118, h: 54, t: "DECIDE",        s: "newsvendor",
        rows: [["quantile", "0.83"], ["asymmetry", "short costs 5x long"]],
        d: "the only box here\nthat spends money." },
      { id: "drift",    x: 382, y: 392, w: 158, h: 44, t: "DRIFT MONITOR", s: "watches 07",
        rows: [["alerts this quarter", "2"], ["of which real", "1"]],
        d: "the other one was\na public holiday." }
    ];

    var PIPES = [
      "M152,227 L196,227",
      "M328,227 L355,227 L355,125 L382,125",
      "M328,227 L355,227 L355,321 L382,321",
      "M540,125 L567,125 L567,227 L594,227",
      "M540,321 L567,321 L567,227 L594,227",
      "M726,227 L778,227"
    ];

    var raf = 0, dots = [], host, readout;

    function readRows(b) {
      readout.textContent = "";
      readout.appendChild(el("h3", null, b.t));
      readout.appendChild(el("p", "mach__invented", "invented figures"));
      var dl = document.createElement("dl");
      b.rows.forEach(function (r) {
        dl.appendChild(el("dt", null, r[0] + ":"));
        dl.appendChild(el("dd", null, r[1]));
      });
      readout.appendChild(dl);
      readout.appendChild(el("p", "diag", "diagnosis:"));
      var p = el("p", null, b.d);
      p.style.whiteSpace = "pre-line";
      readout.appendChild(p);
    }

    function idle() {
      readout.textContent = "";
      readout.appendChild(el("p", "mach__read-idle", "Hover a component."));
    }

    return {
      init: function () {
        host = $("[data-schem]");
        readout = $("[data-schem-read]");

        /* drawing furniture: corner ticks, like a plate that has been
           registered for printing */
        [[14, 14], [966, 14], [14, 456], [966, 456]].forEach(function (c) {
          host.appendChild(svg("path", { "class": "schem__tick",
            d: "M" + (c[0] - 8) + "," + c[1] + " L" + (c[0] + 8) + "," + c[1] +
               " M" + c[0] + "," + (c[1] - 8) + " L" + c[0] + "," + (c[1] + 8) }));
        });

        PIPES.forEach(function (d) {
          var p = svg("path", { "class": "schem__pipe", d: d });
          host.appendChild(p);
          for (var i = 0; i < 2; i++) {
            var c = svg("circle", { "class": "schem__dot", r: 1.9 });
            host.appendChild(c);
            dots.push({ el: c, path: p, len: 0, at: Math.random(), sp: 0.16 + Math.random() * 0.12 });
          }
        });

        /* The monitor hangs off model 07 on a dashed leader. */
        host.appendChild(svg("path", {
          "class": "schem__pipe", "stroke-dasharray": "3 4", d: "M461,392 L461,350"
        }));

        BOXES.forEach(function (b) {
          var g = svg("g", { "class": "schem__g" });
          g.appendChild(svg("rect", { "class": "schem__box", x: b.x, y: b.y, width: b.w, height: b.h }));
          var lbl = svg("text", { "class": "schem__lbl", x: b.x + 9, y: b.y + 22 });
          lbl.textContent = b.t;
          g.appendChild(lbl);
          var sub = svg("text", { "class": "schem__sub", x: b.x + 9, y: b.y + 37 });
          sub.textContent = b.s;
          g.appendChild(sub);

          var hit = svg("rect", { "class": "schem__hit", x: b.x - 6, y: b.y - 6, width: b.w + 12, height: b.h + 12 });
          hit.setAttribute("tabindex", "0");
          hit.setAttribute("role", "button");
          /* The figures are invented, and the label has to say so too: a
             screen reader never reaches the stamp at the foot of the plate. */
          hit.setAttribute("aria-label", b.t + ", invented figures. " +
            b.rows.map(function (r) { return r[0] + " " + r[1]; }).join(", ") +
            ". Diagnosis: " + b.d.replace(/\n/g, " "));
          g.appendChild(hit);

          var on = function () { g.classList.add("is-on"); readRows(b); };
          var off = function () { g.classList.remove("is-on"); idle(); };
          hit.addEventListener("mouseenter", on);
          hit.addEventListener("mouseleave", off);
          hit.addEventListener("focus", on);
          hit.addEventListener("blur", off);

          host.appendChild(g);
        });

        dots.forEach(function (d) { d.len = d.path.getTotalLength(); });
      },

      enter: function () {
        if (REDUCED) {
          /* Park the samples mid-pipe rather than deleting them; the
             diagram still reads as carrying something. */
          dots.forEach(function (d) {
            if (!d.len) d.len = d.path.getTotalLength();
            var p = d.path.getPointAtLength(d.len * d.at);
            d.el.setAttribute("cx", p.x); d.el.setAttribute("cy", p.y);
          });
          return;
        }
        var last = 0;
        (function tick(ts) {
          raf = requestAnimationFrame(tick);
          var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
          last = ts;
          dots.forEach(function (d) {
            if (!d.len) d.len = d.path.getTotalLength();
            d.at = (d.at + dt * d.sp) % 1;
            var p = d.path.getPointAtLength(d.len * d.at);
            d.el.setAttribute("cx", p.x.toFixed(1));
            d.el.setAttribute("cy", p.y.toFixed(1));
          });
        })(0);
      },

      exit: function () { cancelAnimationFrame(raf); raf = 0; }
    };
  })());


  /* ====================================================== FAMILIARS ==== */

  register("familiars", (function () {
    var CATS = [
      { name: "Louis I",  desc: "Orange and white domestic cat",
        life: "Unknown–present", med: "Gelatin silver print",
        cred: "Collection of the artist",
        wall: "Assumes the posture of a much larger animal." },
      { name: "Dimitri",  desc: "Grey domestic shorthair",
        life: "Unknown–present", med: "Gelatin silver print",
        cred: "On indefinite loan from the kitchen",
        wall: "Has never once come when called. Comes at other times." },
      { name: "Hamlet",   desc: "Black domestic cat, one white marking",
        life: "Unknown–present", med: "Gelatin silver print",
        cred: "Acquired 2023; would say otherwise",
        wall: "Named optimistically. Has since grown into it." }
    ];

    function url() {
      /* Every request returns a different cat, but identical URLs would be
         served from cache and give us the same cat three times. */
      return "https://cataas.com/cat?width=800&r=" +
             Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    return {
      init: function () {
        var row = $("[data-familiars]");
        CATS.forEach(function (c) {
          var fig = el("figure", "plinth");
          var frame = el("div", "plinth__frame");

          var img = new Image();
          img.alt = "Formal portrait of " + c.name + ", " + c.desc.toLowerCase() + ".";
          img.decoding = "async";
          img.addEventListener("load", function () { img.classList.add("is-in"); });
          img.addEventListener("error", function () {
            img.remove();
            frame.appendChild(el("div", "plinth__fail", "PHOTOGRAPH ABSENT\n\nthe beast declined\nto be reproduced"));
          });
          img.src = url();
          frame.appendChild(img);
          fig.appendChild(frame);

          var dl = document.createElement("dl");
          dl.className = "plinth__label";
          dl.appendChild(el("dt", null, c.name));
          dl.appendChild(el("dd", null, c.desc));
          var life = el("dd", "plain", c.life + ", " + c.med);
          dl.appendChild(life);
          dl.appendChild(el("dd", "plain", c.cred));
          dl.appendChild(el("dd", null, c.wall));
          fig.appendChild(dl);

          var btn = el("button", "plinth__btn", "Enlarge beast");
          btn.type = "button";
          btn.addEventListener("click", function () {
            if (!img.src || !img.classList.contains("is-in")) return;
            openLB(img.src,
              c.name + "\n" + c.desc + "\n" + c.life + "\n" + c.med + "\n" + c.cred +
              "\n\n" + c.wall, false, btn);
          });
          fig.appendChild(btn);

          row.appendChild(fig);
        });
      }
    };
  })());


  /* ======================================================= OPINIONS ==== */

  register("opinions", (function () {
    var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    /* The numbers are not typed in. They are GENERATED from the same four
       terms the derivation takes apart, which is the only way the waterfall
       can be guaranteed to reconstruct the bar exactly — and the only honest
       way to claim a chart can explain itself. */
    var COMP = {
      a: { year: "2025", base: 392, trend: 9,
           promo: [0, 0, 0, 40, 0, 0, 0, 0, 0, 0, 85, 0] },
      b: { year: "2026", base: 430, trend: 11,
           promo: [0, 60, 0, 0, 0, 0, 0, 0, 0, 70, 0, 0] }
    };
    var SEASON = MONTHS.map(function (_, m) {
      return Math.round(70 * Math.sin(TAU * (m - 2) / 12));
    });

    function parts(key, m) {
      var c = COMP[key];
      return [
        { k: "baseline",    v: c.base,
          why: "what the warehouse does with nothing else happening" },
        { k: "trend",       v: c.trend * m,
          why: c.trend + " a month, compounding over " + m + " month" + (m === 1 ? "" : "s") },
        { k: "seasonality", v: SEASON[m],
          why: "month " + (m + 1) + " of the annual profile" },
        { k: "promotion",   v: c.promo[m],
          why: c.promo[m] ? "a promotion ran this month" : "none ran this month" }
      ];
    }
    function total(key, m) {
      return parts(key, m).reduce(function (s, p) { return s + p.v; }, 0);
    }

    var DATA = {
      a: MONTHS.map(function (_, m) { return total("a", m); }),
      b: MONTHS.map(function (_, m) { return total("b", m); })
    };
    var LABEL = { a: "FY 2025", b: "FY 2026" };
    var DUR = 380;             /* the number the essay commits to */

    var charts = [], range = "a";

    /* ---- the two charts (act one: transitions) ------------------------ */

    function chart(host, animated) {
      var W = 440, H = 250, L = 38, R = 10, T = 16, B = 30;
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
      s.setAttribute("aria-label",
        "Bar chart, orders per month. Hovering a month reads out its value, " +
        "and activating one shows how it was calculated. " +
        (animated
          ? "When the range changes, the bars move to their new values."
          : "When the range changes, the chart repaints with no transition."));
      host.appendChild(s);

      /* BOTH charts get the hover readout and the drill-down. Only the
         transition differs, or this stops being a test of animation. */
      var tip = el("div", "tip");
      var tipV = el("b"); var tipT = document.createTextNode("");
      tip.appendChild(tipV); tip.appendChild(tipT);
      host.appendChild(tip);

      var hot = -1;
      function writeTip(i) {
        tipV.textContent = MONTHS[i] + " " + LABEL[range].slice(-4);
        tipT.nodeValue = bars[i].to + " orders";
      }

      var maxY = 760;
      var iw = W - L - R, ih = H - T - B;
      var band = iw / 12;
      var bw = band - 2;                       /* the 2px surface gap */
      var y0 = T + ih;
      var py = function (v) { return y0 - (v / maxY) * ih; };

      [0, 200, 400, 600].forEach(function (v) {
        s.appendChild(svg("line", { "class": "plot__grid", x1: L, x2: W - R, y1: py(v), y2: py(v) }));
        var t = svg("text", { "class": "plot__tick", x: L - 6, y: py(v) + 3, "text-anchor": "end" });
        t.textContent = v;
        s.appendChild(t);
      });
      s.appendChild(svg("line", { "class": "plot__axis", x1: L, x2: W - R, y1: y0, y2: y0 }));

      var bars = [], vlabels = [];
      MONTHS.forEach(function (m, i) {
        var x = L + i * band + 1;
        var p = svg("path", { "class": "bar" });
        s.appendChild(p);
        bars.push({ el: p, x: x, w: bw, v: 0, from: 0, to: 0 });

        if (i % 2 === 0) {
          var lt = svg("text", { "class": "plot__tick", x: x + bw / 2, y: y0 + 14, "text-anchor": "middle" });
          lt.textContent = m;
          s.appendChild(lt);
        }

        var vl = svg("text", { "class": "plot__vlabel", x: x + bw / 2, y: 0, "text-anchor": "middle" });
        s.appendChild(vl);
        vlabels.push(vl);

        var hit = svg("rect", { "class": "plot__hit", x: L + i * band, y: T, width: band, height: ih });
        /* Focusable, because "click the bar" cannot be the only way in. */
        hit.setAttribute("tabindex", "0");
        hit.setAttribute("role", "button");
        s.appendChild(hit);

        (function (idx) {
          function enter() {
            bars[idx].el.classList.add("is-hot");
            hot = idx;
            writeTip(idx);
            tip.classList.add("is-on");
            hit.setAttribute("aria-label",
              MONTHS[idx] + " " + LABEL[range].slice(-4) + ", " + bars[idx].to +
              " orders. Activate to see how this figure is calculated.");
          }
          function leave() {
            bars[idx].el.classList.remove("is-hot");
            hot = -1;
            tip.classList.remove("is-on");
          }
          hit.addEventListener("mouseenter", enter);
          hit.addEventListener("mousemove", function (ev) {
            var r = host.getBoundingClientRect();
            tip.style.left = (ev.clientX - r.left) + "px";
            tip.style.top  = (ev.clientY - r.top) + "px";
          });
          hit.addEventListener("mouseleave", leave);
          hit.addEventListener("focus", enter);
          hit.addEventListener("blur", leave);
          hit.addEventListener("click", function () { derive(idx); });
          hit.addEventListener("keydown", function (ev) {
            if (ev.key !== "Enter" && ev.key !== " ") return;
            ev.preventDefault();
            derive(idx);
          });
        })(i);
      });

      function d(b, v) {
        var y = py(v), r = Math.min(4, b.w / 2, Math.max(0, y0 - y));
        if (y >= y0) return "";
        return "M" + b.x + "," + y0 +
               "L" + b.x + "," + (y + r) +
               "Q" + b.x + "," + y + " " + (b.x + r) + "," + y +
               "L" + (b.x + b.w - r) + "," + y +
               "Q" + (b.x + b.w) + "," + y + " " + (b.x + b.w) + "," + (y + r) +
               "L" + (b.x + b.w) + "," + y0 + "Z";
      }

      function paintLabels(vals) {
        /* Selective direct labels: the extremes only. A number on every bar
           is a table pretending to be a chart. */
        var hi = vals.indexOf(Math.max.apply(null, vals));
        var lo = vals.indexOf(Math.min.apply(null, vals));
        vlabels.forEach(function (t, i) {
          if (i === hi || i === lo) {
            t.textContent = vals[i];
            t.setAttribute("y", py(vals[i]) - 5);
          } else {
            t.textContent = "";
          }
        });
      }

      var raf = 0;
      function set(vals, tween) {
        cancelAnimationFrame(raf);
        bars.forEach(function (b, i) { b.from = b.v; b.to = vals[i]; });
        if (hot >= 0) writeTip(hot);

        if (!tween || REDUCED) {
          bars.forEach(function (b) { b.v = b.to; b.el.setAttribute("d", d(b, b.v)); });
          paintLabels(vals);
          return;
        }

        var t0 = 0;
        (function step(ts) {
          if (!t0) t0 = ts;
          var k = clamp((ts - t0) / DUR, 0, 1), e = ease(k);
          bars.forEach(function (b) {
            b.v = lerp(b.from, b.to, e);
            b.el.setAttribute("d", d(b, b.v));
          });
          paintLabels(bars.map(function (b) { return Math.round(b.v); }));
          if (k < 1) raf = requestAnimationFrame(step);
          else paintLabels(vals);
        })(0);
      }

      function mark(i) {
        bars.forEach(function (b, j) { b.el.classList.toggle("is-picked", j === i); });
      }

      return { set: set, animated: animated, mark: mark };
    }

    /* ---- act two: taking one bar apart -------------------------------- */

    /* This is the part a BI tool will not do, and the reason the essay is
       not about transitions. The bar is decomposed into the four terms that
       produced it, in order, one at a time, landing exactly on the value the
       chart is already showing. */

    var box, plot, stepsEl, titleEl, dRaf = 0, picked = -1;

    function derive(m) {
      picked = m;
      charts.forEach(function (c) { c.mark(m); });

      var ps = parts(range, m);
      var tot = DATA[range][m];
      titleEl.textContent = MONTHS[m] + " " + COMP[range].year + " — " + tot + " orders";
      box.hidden = false;

      /* the arithmetic, as text, present whether or not anything animates */
      stepsEl.textContent = "";
      var run = 0;
      ps.forEach(function (p) {
        run += p.v;
        var dt = el("dt", null, p.k);
        var dd = el("dd");
        var sign = p.v < 0 ? "−" : "+";
        dd.appendChild(el("span", "deriv__v", sign + " " + Math.abs(p.v)));
        dd.appendChild(el("span", "deriv__run", "running " + run));
        dd.appendChild(el("span", "deriv__why", p.why));
        stepsEl.appendChild(dt);
        stepsEl.appendChild(dd);
      });
      var dt = el("dt", "is-total", "total");
      var dd = el("dd", "is-total");
      dd.appendChild(el("span", "deriv__v", String(tot)));
      dd.appendChild(el("span", "deriv__why", "which is the height of the bar you clicked"));
      stepsEl.appendChild(dt);
      stepsEl.appendChild(dd);

      drawWaterfall(ps, tot);
      box.scrollIntoView({ block: "nearest", behavior: REDUCED ? "auto" : "smooth" });
    }

    function drawWaterfall(ps, tot) {
      cancelAnimationFrame(dRaf);
      plot.textContent = "";

      var W = 760, H = 230, L = 44, R = 14, T = 26, B = 42;
      var iw = W - L - R, ih = H - T - B;
      var cols = ps.length + 1;
      var band = iw / cols, bw = Math.min(74, band - 18);
      var y0 = T + ih;

      /* scale to the tallest thing the waterfall ever reaches */
      var run = 0, peak = tot;
      ps.forEach(function (p) { run += p.v; peak = Math.max(peak, run); });
      var maxY = Math.ceil(peak * 1.12 / 100) * 100;
      var py = function (v) { return y0 - (v / maxY) * ih; };

      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
      s.setAttribute("aria-label",
        "Waterfall. Each term is added in turn and the final column equals the bar's value. " +
        "The same figures are listed beneath.");
      plot.appendChild(s);

      [0, maxY / 2, maxY].forEach(function (v) {
        s.appendChild(svg("line", { "class": "plot__grid", x1: L, x2: W - R, y1: py(v), y2: py(v) }));
        var t = svg("text", { "class": "plot__tick", x: L - 6, y: py(v) + 3, "text-anchor": "end" });
        t.textContent = Math.round(v);
        s.appendChild(t);
      });
      s.appendChild(svg("line", { "class": "plot__axis", x1: L, x2: W - R, y1: y0, y2: y0 }));

      var steps = [];
      run = 0;
      ps.forEach(function (p, i) {
        var from = run, to = run + p.v;
        run = to;
        var x = L + i * band + (band - bw) / 2;

        var rect = svg("rect", {
          "class": "wf" + (p.v < 0 ? " wf--down" : ""),
          x: x.toFixed(1), width: bw.toFixed(1), y: py(from).toFixed(1), height: 0
        });
        s.appendChild(rect);

        var val = svg("text", { "class": "wf__val", x: (x + bw / 2).toFixed(1),
                                y: (py(Math.max(from, to)) - 7).toFixed(1), "text-anchor": "middle" });
        val.textContent = (p.v < 0 ? "−" : "+") + Math.abs(p.v);
        val.style.opacity = 0;
        s.appendChild(val);

        var name = svg("text", { "class": "wf__name", x: (x + bw / 2).toFixed(1),
                                 y: (y0 + 15).toFixed(1), "text-anchor": "middle" });
        name.textContent = p.k;
        name.style.opacity = 0;
        s.appendChild(name);

        var link = svg("line", { "class": "wf__link",
          x1: (x + bw).toFixed(1), x2: (x + band).toFixed(1),
          y1: py(to).toFixed(1), y2: py(to).toFixed(1) });
        link.style.opacity = 0;
        s.appendChild(link);

        steps.push({ rect: rect, val: val, name: name, link: link,
                     from: from, to: to, x: x });
      });

      /* the total: a full bar, drawn from zero, landing on the same value */
      var tx = L + ps.length * band + (band - bw) / 2;
      var trect = svg("rect", { "class": "wf wf--total", x: tx.toFixed(1),
                                width: bw.toFixed(1), y: py(0).toFixed(1), height: 0 });
      s.appendChild(trect);
      var tval = svg("text", { "class": "wf__val wf__val--total", x: (tx + bw / 2).toFixed(1),
                               y: (py(tot) - 7).toFixed(1), "text-anchor": "middle" });
      tval.textContent = "0";
      tval.style.opacity = 0;
      s.appendChild(tval);
      var tname = svg("text", { "class": "wf__name", x: (tx + bw / 2).toFixed(1),
                                y: (y0 + 15).toFixed(1), "text-anchor": "middle" });
      tname.textContent = "total";
      tname.style.opacity = 0;
      s.appendChild(tname);

      function place(st, k) {
        var a = py(st.from), b = py(st.from + (st.to - st.from) * k);
        st.rect.setAttribute("y", Math.min(a, b).toFixed(1));
        st.rect.setAttribute("height", Math.abs(b - a).toFixed(1));
      }

      if (REDUCED) {
        steps.forEach(function (st) {
          place(st, 1);
          st.val.style.opacity = 1; st.name.style.opacity = 1; st.link.style.opacity = 1;
        });
        trect.setAttribute("y", py(tot).toFixed(1));
        trect.setAttribute("height", (y0 - py(tot)).toFixed(1));
        tval.textContent = String(tot);
        tval.style.opacity = 1; tname.style.opacity = 1;
        return;
      }

      var STEP = 620, GROW = 440, t0 = 0;
      (function frame(ts) {
        if (!t0) t0 = ts;
        var t = ts - t0, done = true;

        steps.forEach(function (st, i) {
          var k = clamp((t - i * STEP) / GROW, 0, 1);
          place(st, ease(k));
          st.val.style.opacity = k > 0.35 ? 1 : 0;
          st.name.style.opacity = k > 0.1 ? 1 : 0;
          st.link.style.opacity = k >= 1 ? 1 : 0;
          if (k < 1) done = false;
        });

        var tk = clamp((t - steps.length * STEP) / GROW, 0, 1);
        var te = ease(tk);
        trect.setAttribute("y", py(tot * te).toFixed(1));
        trect.setAttribute("height", (y0 - py(tot * te)).toFixed(1));
        tval.textContent = String(Math.round(tot * te));
        tval.style.opacity = tk > 0.05 ? 1 : 0;
        tname.style.opacity = tk > 0.05 ? 1 : 0;
        if (tk < 1) done = false;

        if (!done) dRaf = requestAnimationFrame(frame);
      })(0);
    }

    function closeDeriv() {
      cancelAnimationFrame(dRaf);
      dRaf = 0;
      box.hidden = true;
      picked = -1;
      charts.forEach(function (c) { c.mark(-1); });
    }

    /* ---- wiring -------------------------------------------------------- */

    function table() {
      var host = $("[data-exh-table]");
      host.textContent = "";
      var t = document.createElement("table");
      var thead = document.createElement("thead");
      var hr = document.createElement("tr");
      ["Month", "FY 2025", "FY 2026"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
      thead.appendChild(hr); t.appendChild(thead);
      var tb = document.createElement("tbody");
      MONTHS.forEach(function (m, i) {
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, m));
        tr.appendChild(el("td", null, String(DATA.a[i])));
        tr.appendChild(el("td", null, String(DATA.b[i])));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      host.appendChild(t);
    }

    function apply(key, tween) {
      range = key;
      charts.forEach(function (c) { c.set(DATA[key], tween && c.animated); });
      $$("[data-range]").forEach(function (b) {
        var on = b.getAttribute("data-range") === key;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      /* If a bar is open, it has to re-derive: the same month in a different
         year is a different number with a different explanation. */
      if (picked >= 0) derive(picked);
    }

    return {
      init: function () {
        box     = $("[data-deriv]");
        plot    = $("[data-deriv-plot]");
        stepsEl = $("[data-deriv-steps]");
        titleEl = $("[data-deriv-title]");

        charts.push(chart($('[data-chart="static"]'), false));
        charts.push(chart($('[data-chart="animated"]'), true));
        table();
        apply("a", false);

        $$("[data-range]").forEach(function (b) {
          b.addEventListener("click", function () { apply(b.getAttribute("data-range"), true); });
        });
        $("[data-deriv-replay]").addEventListener("click", function () {
          if (picked >= 0) derive(picked);
        });
        $("[data-deriv-close]").addEventListener("click", closeDeriv);

        if (REDUCED) {
          var n = $("[data-op-rm]");
          n.textContent = "You have reduced motion switched on. The two charts " +
            "above are now genuinely identical — same marks, same hover, no " +
            "transition — and the derivation below arrives complete instead " +
            "of a term at a time. Which costs you most of my argument. The offer " +
            "stands, and the arithmetic is all still there in writing.";
          n.hidden = false;
        }
      },
      exit: function () { cancelAnimationFrame(dRaf); dRaf = 0; }
    };
  })());


  /* ======================================================== NOWHERE ==== */

  register("nowhere", (function () {
    var KEY = "brain:notes";

    function read() {
      try {
        var v = JSON.parse(localStorage.getItem(KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    }
    function write(v) {
      try { localStorage.setItem(KEY, JSON.stringify(v.slice(-40))); }
      catch (e) { /* private window, or the quota. The note is lost and
                     that is thematically appropriate. */ }
    }

    function render() {
      var wall = $("[data-note-wall]");
      wall.textContent = "";
      var notes = read();
      if (!notes.length) return;

      wall.appendChild(el("p", "void__small",
        notes.length === 1 ? "One note, left by you, on this machine."
                           : notes.length + " notes, left by you, on this machine."));

      notes.slice().reverse().forEach(function (n) {
        var d = el("div", "void__note");
        var time = document.createElement("time");
        time.dateTime = n.t;
        try {
          time.textContent = new Date(n.t).toLocaleString(undefined,
            { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        } catch (e) { time.textContent = n.t; }
        d.appendChild(time);
        d.appendChild(document.createTextNode(n.s));
        wall.appendChild(d);
      });

      var clear = el("button", "void__clear", "[ burn them ]");
      clear.type = "button";
      clear.addEventListener("click", function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        render();
      });
      wall.appendChild(clear);
    }

    return {
      init: function () {
        var open = $("[data-note-open]");
        var form = $("[data-note-form]");
        var input = $("[data-note-input]");

        open.addEventListener("click", function () {
          open.hidden = true;
          form.hidden = false;
          input.focus();
        });
        $("[data-note-cancel]").addEventListener("click", function () {
          form.hidden = true;
          open.hidden = false;
          input.value = "";
          open.focus();
        });
        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var s = input.value.trim();
          if (!s) return;
          var notes = read();
          notes.push({ t: new Date().toISOString(), s: s });
          write(notes);
          input.value = "";
          form.hidden = true;
          open.hidden = false;
          render();
        });
        render();
      },
      enter: render
    };
  })());


  /* ========================================================== SHELL ==== */

  (function () {
    var box   = $("[data-shell]");
    var out   = $("[data-shell-out]");
    var form  = $("[data-shell-form]");
    var input = $("[data-shell-in]");
    var ps1   = $("[data-shell-ps1]");
    if (!box) return;

    var TONE = { warn: "b", ok: "i", bad: "u", dim: "s" };
    var history = [], hi = -1;
    var mode = null;          /* null | 'sudo' | 'vim' */
    var doorKnocks = 0;
    var booted = false;

    var DIRS = {
      "art/":       "atrium",
      "math/":      "uncertainty",
      "photos/":    "photographs",
      "projects/":  "machines",
      "cats/":      "familiars",
      "ideas/":     "obsession",
      "writing/":   "opinions"
    };

    var FILES = {
      "readme":    ["this is not a portfolio. the portfolio is upstairs.", "dim"],
      "todo":      ["347 entries. not reproducing them here.", "dim"],
      "self-doubt":["(binary file — will not display)", "dim"]
    };

    function say(text, tone) {
      var tag = TONE[tone] || "span";
      var n = document.createElement(tag);
      n.textContent = text + "\n";
      out.appendChild(n);
      out.scrollTop = out.scrollHeight;
    }
    function lines(arr, tone) { arr.forEach(function (l) { say(l, tone); }); }

    function boot() {
      if (booted) return;
      booted = true;
      lines([
        "brain 6.18.7 (tty2) — curated shell, sixteen commands",
        "type `help` if you want the list, or don't.",
        ""
      ], "dim");
    }

    function openShell() {
      if (!box.hidden) return;
      box.hidden = false;
      boot();
      openLayer(box, closeShell, false);
      input.focus();
    }
    function closeShell() {
      if (box.hidden) return;
      box.hidden = true;
      var back = closeLayer(box);
      try { (back || $("[data-shell-toggle]")).focus(); } catch (e) {}
    }
    function toggle() { box.hidden ? openShell() : closeShell(); }

    $("[data-shell-toggle]").addEventListener("click", toggle);
    $("[data-shell-close]").addEventListener("click", closeShell);

    function setMode(m) {
      mode = m;
      if (m === "sudo") {
        ps1.textContent = "[sudo] password for visitor:";
        input.type = "password";
      } else if (m === "vim") {
        ps1.textContent = ":";
        input.type = "text";
      } else {
        ps1.textContent = "$";
        input.type = "text";
      }
    }

    var CMD = {
      help: function () {
        lines([
          "ls [dir]        cd <dir>        cat <file>      pwd",
          "whoami          uname -a        date            fortune",
          "neofetch        pacman -Syu     clear           exit",
          "",
          "sudo works about as well here as it does anywhere."
        ], "dim");
      },

      ls: function (args) {
        if (args[0]) {
          var k = args[0].replace(/\/?$/, "/");
          if (k === "????????/") return say("ls: cannot open directory '????????': permission denied", "bad");
          if (!DIRS[k]) return say("ls: cannot access '" + args[0] + "': No such file or directory", "bad");
          return say("(it's a room. `cd " + k.slice(0, -1) + "` and look at it.)", "dim");
        }
        say("art/  cats/  ideas/  math/  photos/  projects/  writing/  " , "");
        say("????????/", "warn");
        say("readme  todo  self-doubt", "dim");
      },

      cd: function (args) {
        var a = (args[0] || "").replace(/\/?$/, "/");
        /* go() focuses the room it opens, which would take the keyboard away
           from the prompt the visitor is still typing at. Give it back. */
        setTimeout(function () { if (!box.hidden) input.focus(); }, 0);
        if (!args[0] || a === "~/" || a === "/") { go("atrium"); return say("→ the map", "ok"); }
        if (a === "????????/") {
          doorKnocks++;
          if (doorKnocks < 3) return say("bash: you probably shouldn't", "warn");
          say("bash: fine.", "warn");
          go("nowhere");
          return;
        }
        if (DIRS[a]) { go(DIRS[a]); return say("→ " + a.slice(0, -1), "ok"); }
        say("bash: cd: " + args[0] + ": No such file or directory", "bad");
      },

      cat: function (args) {
        var f = FILES[(args[0] || "").toLowerCase()];
        if (!args[0]) return say("cat: missing operand", "bad");
        if (args[0] === "cats" || args[0] === "cats/") { go("familiars"); return say("→ familiars", "ok"); }
        if (!f) return say("cat: " + args[0] + ": No such file or directory", "bad");
        say(f[0], f[1]);
      },

      pwd: function () { say("/home/taylor/brain/" + (current === "atrium" ? "" : current)); },

      whoami: function () { say("visitor"); },

      date: function () { say(new Date().toString()); },

      fortune: function () {
        var F = [
          "All models are wrong. Some models are wrong in ways that are\nexpensive on a Tuesday.",
          "The hardest part of forecasting is the part where somebody has to\ndecide something.",
          "You do not have a data problem. You have an agreement problem.",
          "Any sufficiently advanced spreadsheet is indistinguishable from\nproduction.",
          "The interval was there when it left the model."
        ];
        say(F[Math.floor(Math.random() * F.length)], "dim");
      },

      uname: function () { say("Brain 6.18.7-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/probably"); },

      neofetch: function () {
        lines([
          "       /\\          visitor@brain",
          "      /  \\         ---------------",
          "     /\\   \\        OS: Brain 6.18.7-arch1-1",
          "    /      \\       Uptime: 34 years, give or take",
          "   /   ,,   \\      Packages: 17 (pacman), 347 unfinished",
          "  /   |  |  -\\     Shell: curated, sixteen commands",
          " /_-''    ''-_\\    Resolution: depends on the day",
          "                   Theme: paper, ink, brass",
          "                   Terminal: this one",
          "                   Memory: 4 GiB used / unclear total"
        ], "dim");
      },

      pacman: function (args) {
        if (args.join(" ").indexOf("-Syu") < 0) {
          return say("error: no operation specified (use -h for help)", "bad");
        }
        lines([
          ":: Synchronizing package databases...",
          " core                     is up to date",
          " extra                    is up to date",
          " multilib                 is up to date",
          ":: Starting full cognitive upgrade..."
        ], "dim");
        say("warning: 347 unfinished projects will be preserved", "warn");
        say("warning: cannot resolve 'sleep', a dependency of 'everything'", "warn");
        say("nothing to do", "dim");
      },

      rm: function (args) {
        var a = args.join(" ");
        if (/-rf?\s+\/?$/.test(a) || a === "-rf /") return say("nice try.", "warn");
        if (/self-doubt/.test(a)) {
          return say("rm: cannot remove 'self-doubt': Operation not permitted\n(try sudo. it will not help.)", "bad");
        }
        say("rm: missing operand", "bad");
      },

      vim: function () {
        say("you are now trapped.", "warn");
        setMode("vim");
      },

      clear: function () { out.textContent = ""; },

      exit: function () { closeShell(); }
    };
    CMD.vi = CMD.vim;
    CMD.emacs = function () { say("emacs: no. this is an Arch joke, have some consistency.", "dim"); };
    CMD.man = function (a) {
      if ((a[0] || "") === "rust") { go("obsession"); return say("→ rust(1)", "ok"); }
      say("No manual entry for " + (a[0] || "nothing"), "bad");
    };
    CMD.sl = function () { say("you have not installed sl. a small mercy.", "dim"); };

    function sudo(args) {
      var rest = args.slice();
      var a = rest.join(" ");
      if (/^rm\s+-rf?\s+self-doubt/.test(a)) {
        setMode("sudo");
        return;
      }
      if (rest[0] === "whoami") return say("still visitor", "dim");
      if (rest[0] === "pacman") return CMD.pacman(rest.slice(1));
      if (!rest.length) return say("usage: sudo <command>", "bad");
      say("visitor is not in the sudoers file. This incident has been\nnoted and immediately forgotten.", "bad");
    }

    function run(raw) {
      var line = raw.trim();

      if (mode === "vim") {
        if (/^:q!?$|^:wq$|^:x$/.test(line)) {
          setMode(null);
          return say("you escaped vim. tell people.", "ok");
        }
        return say("you are in vim.", "dim");
      }

      if (mode === "sudo") {
        setMode(null);
        say("");
        say("incorrect password.", "bad");
        say("self-doubt remains installed.", "dim");
        return;
      }

      say("$ " + line, "dim");
      if (!line) return;

      var parts = line.split(/\s+/);
      var cmd = parts[0];
      var args = parts.slice(1);

      if (cmd === "sudo") return sudo(args);
      if (CMD[cmd]) return CMD[cmd](args);
      say("bash: " + cmd + ": command not found", "bad");
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = input.value;
      if (mode !== "sudo" && v.trim()) { history.push(v); hi = history.length; }
      input.value = "";
      run(v);
      out.scrollTop = out.scrollHeight;
    });

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowUp" && history.length) {
        ev.preventDefault();
        hi = Math.max(0, hi - 1);
        input.value = history[hi] || "";
      } else if (ev.key === "ArrowDown" && history.length) {
        ev.preventDefault();
        hi = Math.min(history.length, hi + 1);
        input.value = history[hi] || "";
      }
    });

    /* Backtick opens the shell from anywhere, as long as the visitor is not
       in the middle of typing something else. */
    window.addEventListener("keydown", function (ev) {
      var t = ev.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (ev.key === "`" && !typing && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        toggle();
      }
    });

    window.__shellOpen = function () { return !box.hidden; };
    window.__shellClose = closeShell;
  })();


  /* ===================================================== GLOBAL KEYS === */

  window.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;

    /* Peel the layer that was opened last, not the first one this function
       happens to name. Opening a scrap and then the shell has to close the
       shell first, or Escape reaches past what is actually on top. */
    var top = topLayer();
    if (top) { top.close(); return; }
    if (current !== "atrium") go("atrium");
  });


  /* ========================================================== START ==== */

  go(fromHash(), false);
  if (!location.hash) history.replaceState(null, "", "#/atrium");

})();
