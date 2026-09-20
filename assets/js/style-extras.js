/* =========================================================================
   DOSSIER — the editorial apparatus.

   One design. The site as a contemporary academic journal, with a standing
   rail of facts pinned to the left edge that never scrolls away.

   The two readings a portfolio has to serve are separated in SPACE rather
   than averaged: a hiring manager reads the rail and leaves without
   scrolling; a peer reads the column beside it. Averaging them gives a
   muddy middle that is neither fast nor considered.

   WHAT THIS BUILDS — and where every word of it comes from:

     · the rail        name and role from the hero, Now / Before / Studied /
                       Based from the About facts list, the three figures
                       from the metrics band (read off data-count, which is
                       the authored value, not the animated text), and the
                       résumé and email links from the page's own markup.
                       Nothing in it is composed here.
     · study metadata  the four systems, numbered, with the method tags each
                       panel already prints and whether it computes. The
                       page says in its own voice that Contracts is a drawn
                       walkthrough, so that distinction is quoted, not
                       assigned. Replaces the pill-shaped technology tags.
     · figure numbers  FIG. n on every canvas, in document order.
     · nav             relabelled to WORK / STUDIES / EXPERIENCE / ABOUT /
                       CONTACT by rewriting the EXISTING link nodes rather
                       than replacing them — main.js captures those nodes at
                       init for scroll tracking and the sliding indicator,
                       and swapping them out detaches both permanently.

   REMOVED at the author's request, and what happened to the content:
     · the Marginalia section. The sentences it collected are the page's own
       caveats and they are all still in the document where they were
       written; only the section that gathered them is gone.
     · the Index section.
     · the Education blackboard (snake lemma / Riemann vs Lebesgue), which
       is taken out of index.html entirely. main.js guards on a missing
       [data-blackboard] root, so its module simply does not start.

   NOT BUILT, deliberately: a PHOTOGRAPHS section. There are no photographs
   in this repository — assets/images holds logos, favicons and two
   portraits. A gallery of nothing would be the one dishonest thing on an
   otherwise scrupulous page.

   mount()/unmount() are driven by a MutationObserver on data-style, and
   unmount() puts every injected node and mutated attribute back.
   ========================================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var rAF = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sections() {
    return [].slice.call(document.querySelectorAll("main > section"));
  }
  function nameOf(s) {
    var l = s.querySelector(".section__label");
    if (l) return l.textContent.trim();
    if (s.classList.contains("hero")) return "Frontispiece";
    var a = s.getAttribute("aria-label");
    if (a) return a.trim();
    return (s.id || "Section").replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function words(node) {
    return (node.textContent || "").trim().split(/\s+/).filter(Boolean).length;
  }
  /* Canvases size themselves off their box, so anything that changes a box
     has to say so; a resize event is the signal main.js already listens for. */
  function remeasure() { rAF(function () { window.dispatchEvent(new Event("resize")); }); }

  var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  /* =====================================================================
     The apparatus itself. Mounted by whichever design is active; every
     design gets all of it, and the stylesheets decide what to show.
     ===================================================================== */

  var apparatus = (function () {
    var built = false;
    var added = [];        // nodes this module created, to remove on unmount
    var navSaved = null;   // [{a, href, text, hidden}] for the original links
    var navAdded = [];     // <li>s this module appended, to remove on unmount
    var mounted = null;

    /* ---- study metadata ------------------------------------------------ */

    /* The four panels, numbered, with the methods each one already prints
       and whether it computes. The page says in its own voice that three
       of the four solve live and that Contracts is a drawn walkthrough
       that "does not compute anything" — so that distinction is quoted,
       not assigned. */
    function studyMeta() {
      var panels = [].slice.call(document.querySelectorAll(".systems__panel"));
      panels.forEach(function (p, i) {
        var title = p.querySelector(".system__title");
        if (!title || p.querySelector(".ap-meta")) return;

        /* Method tags: the constraint chips this panel already shows.
           Anything with a digit in it is a bound or a readout ("Range
           20–2,500 mi", "Capacity 3"), not a method — an earlier filter
           only caught units and let "capacity 3" through as a method. */
        var chips = [].slice.call(p.querySelectorAll(".routing__constraints span"))
          .map(function (c) { return c.textContent.replace(/\s+/g, " ").trim(); })
          .filter(function (t) { return t && t.length < 42 && !/\d/.test(t); });

        /* Whether this study runs, taken from the page's own flag. The
           label says "invented figures" rather than "computes nothing":
           the contracts panel does arithmetic on its constants, so the
           stronger claim is one a reader with devtools can disprove, and
           the honest point was always that the inputs are made up. */
        var drawn = /does not compute anything|drawn walkthrough/i.test(p.textContent);

        var meta = el("div", "ap-meta");
        var l1 = el("p", "ap-meta__l ap-meta__l--id");
        l1.appendChild(el("span", "ap-meta__n", "Study " + (i + 1 < 10 ? "0" : "") + (i + 1)));
        l1.appendChild(el("span", "ap-meta__sep", "·"));
        l1.appendChild(el("span", "ap-meta__state", drawn ? "drawn walkthrough, invented figures" : "runs live in this page"));
        meta.appendChild(l1);

        if (chips.length) {
          meta.appendChild(el("p", "ap-meta__l ap-meta__l--method",
            chips.join("  /  ").toLowerCase()));
        }
        /* No reading time here. Every panel comes out at "1 min", which is
           true and useless — four identical lines that look like a bug. A
           reading time belongs on an essay; what distinguishes a study is
           its method and whether it computes, which the two lines above
           already say. */

        title.parentNode.insertBefore(meta, title.nextSibling);
        added.push(meta);
      });
    }

    /* ---- figure numbers ------------------------------------------------ */

    function figures() {
      var n = 0;
      [].slice.call(document.querySelectorAll("main canvas")).forEach(function (c) {
        if (c.previousElementSibling &&
            c.previousElementSibling.classList.contains("ap-fig")) return;
        n++;
        var f = el("p", "ap-fig", "Fig. " + n);
        c.parentNode.insertBefore(f, c);
        added.push(f);
      });
    }

    /* ---- currently ----------------------------------------------------- */

    /* Straight out of the facts list. The page already states these; this
       only sets them as a standing note rather than a definition list. */
    function currentlyLines() {
      var out = [];
      [].slice.call(document.querySelectorAll(".fact")).forEach(function (f) {
        var dt = f.querySelector("dt"), dd = f.querySelector("dd");
        if (!dt || !dd) return;
        var k = dt.textContent.trim().toLowerCase();
        if (!/^(now|based|off the clock)$/.test(k)) return;
        out.push({ k: k, v: dd.textContent.replace(/\s+/g, " ").trim() });
      });
      return out;
    }

    /* ---- navigation ----------------------------------------------------- */

    /* WORK / STUDIES / MARGINALIA / ABOUT / INDEX. Experience, Skills and
       Contact come out of the masthead and stay in the document: a CV's
       employment history belongs in About, not across the top of a page
       about the work itself. */
    /* Experience is BACK, third rather than absent.

       The brief said employment should retreat to About, and taking it out
       of the masthead entirely was the wrong reading of that. Employment
       is the single thing a hiring manager arrives looking for, and the
       cost of keeping it is one nav item — where the cost of removing it
       is that the fastest reader cannot find the fastest fact. It is no
       longer the headline: the page still leads with the work and the
       studies, which is what the retreat was actually for. */
    var NAV = [
      ["#work", "Work"],
      ["#routing", "Studies"],
      ["#experience", "Experience"],
      ["#about", "About"],
      ["#contact", "Contact"]
    ];

    /* THE EXISTING LINK NODES ARE REUSED, NEVER REPLACED.

       main.js captures the nav links once at init —
         var links = [].slice.call(document.querySelectorAll('.nav__link[href^="#"]'))
       — and drives scroll tracking and the sliding indicator off THOSE
       node references. An earlier draft did `list.innerHTML = ""` and
       built fresh <a>s, which detached every node main.js was holding:
       tracking went on setting aria-current on orphans, the indicator
       froze at 0px, and restoring the saved innerHTML on teardown created
       a THIRD set of nodes, so switching back to Base never recovered.

       So: mutate the text and href of the nodes that are already there,
       hide any spare ones, and append only what is genuinely missing.
       Everything is restored verbatim in navRestore(). */
    function nav() {
      var list = document.querySelector(".nav__list");
      if (!list) return;

      /* Only relabel on a page that actually has these sections. cv.html
         links out to index.html#about and has none of them locally, so
         filtering each entry against the page emptied its masthead
         completely — a résumé page with no navigation at all. */
      var present = NAV.filter(function (n) { return document.querySelector(n[0]); });
      if (present.length < 2) return;

      var links = [].slice.call(list.querySelectorAll(".nav__link"));
      navSaved = links.map(function (a) {
        return { a: a, href: a.getAttribute("href"), text: a.textContent,
                 hidden: a.parentNode.hidden };
      });
      navAdded = [];

      present.forEach(function (n, i) {
        if (i < links.length) {
          links[i].setAttribute("href", n[0]);
          links[i].textContent = n[1];
          links[i].parentNode.hidden = false;
        } else {
          var li = el("li");
          var a = el("a", "nav__link", n[1]);
          a.href = n[0];
          li.appendChild(a);
          list.appendChild(li);
          navAdded.push(li);
        }
      });
      // spare original links are hidden, not removed
      for (var j = present.length; j < links.length; j++) {
        links[j].parentNode.hidden = true;
      }
    }

    function navRestore() {
      if (!navSaved) return;
      navSaved.forEach(function (s) {
        s.a.setAttribute("href", s.href);
        s.a.textContent = s.text;
        s.a.parentNode.hidden = s.hidden;
      });
      navAdded.forEach(function (li) { if (li.parentNode) li.parentNode.removeChild(li); });
      navSaved = null; navAdded = [];
    }

    /* ---- mount / unmount ------------------------------------------------ */

    function mount(which) {
      if (built) { mounted = which; return; }
      built = true; mounted = which;

      studyMeta();
      figures();

      nav();
      remeasure();
    }

    function unmount() {
      if (!built) return;
      added.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      added = [];
      navRestore();
      built = false; mounted = null;
      remeasure();
    }

    return { mount: mount, unmount: unmount };
  })();

  /* =====================================================================
     The design. It mounts the apparatus and adds only what is particular
     to it; the arrangement is the stylesheet's job.
     ===================================================================== */

  /* DOSSIER — Quarto's register, plus a standing rail of facts.

     The problem this solves: the editorial designs read well to a peer and
     to anyone judging on taste, but they cost a hiring manager time — the
     facts they came for are spread down a page with a lot of air in it.
     Averaging the two registers produces a muddy middle that is neither
     fast nor considered.

     So the two readings are separated in SPACE instead. A rail fixed to
     the left edge carries exactly what a sixty-second reader needs and
     never scrolls away; the column beside it stays quiet. Nobody has to
     press anything, and neither reader sees the other's version as
     clutter — a permanent margin of facts is more book-like, not less.

     Every line in the rail is read out of the page: the name and role from
     the hero, the four facts from the About list, the three figures from
     the metrics band (by data-count, which is the authored value, not the
     animated text), and the résumé link from the masthead. */
  var dossier = (function () {
    var rail;

    /* Some facts hold more than one line — Before carries two employers
       separated by a <br>. Flattening with textContent ran them together
       into "…Data Scientist I and II Chain Link Services, Business
       Analyst", which reads as one nonsensical job. Split on the breaks
       and keep them as separate lines. */
    function factLines() {
      var out = [];
      [].slice.call(document.querySelectorAll(".fact")).forEach(function (f) {
        var dt = f.querySelector("dt"), dd = f.querySelector("dd");
        if (!dt || !dd) return;
        var k = dt.textContent.trim().toLowerCase();
        if (!/^(now|before|studied|based)$/.test(k)) return;
        var lines = [];
        var buf = "";
        [].slice.call(dd.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.tagName === "BR") { lines.push(buf); buf = ""; return; }
          buf += n.textContent;
        });
        lines.push(buf);
        lines = lines.map(function (t) { return t.replace(/\s+/g, " ").trim(); })
                     .filter(Boolean);
        out.push({ k: k, lines: lines });
      });
      return out;
    }

    function figures3() {
      return [].slice.call(document.querySelectorAll(".metric")).map(function (m) {
        var v = m.querySelector(".metric__value"), l = m.querySelector(".metric__label");
        var c = v && v.getAttribute("data-count");
        return {
          v: v ? (c != null ? c + (v.getAttribute("data-suffix") || "") : v.textContent.trim()) : "",
          l: l ? l.textContent.replace(/\s+/g, " ").trim() : ""
        };
      });
    }

    function on() {
      apparatus.mount("dossier");
      if (rail) return;
      var facts = factLines();
      if (!facts.length) return;          // cv.html and 404 have no facts list

      rail = el("aside", "dsr");
      rail.setAttribute("aria-label", "At a glance");

      var name = document.querySelector(".hero__name");
      var role = document.querySelector(".hero__role");
      if (name) rail.appendChild(el("p", "dsr__name", name.textContent.trim()));
      if (role) {
        rail.appendChild(el("p", "dsr__role",
          role.textContent.replace(/\s+/g, " ").trim()));
      }

      var dl = el("dl", "dsr__facts");
      facts.forEach(function (f) {
        dl.appendChild(el("dt", null, f.k));
        var dd = el("dd");
        f.lines.forEach(function (line, i) {
          if (i) dd.appendChild(document.createElement("br"));
          dd.appendChild(document.createTextNode(line));
        });
        dl.appendChild(dd);
      });
      rail.appendChild(dl);

      var figs = figures3();
      if (figs.length) {
        var fw = el("div", "dsr__figs");
        figs.forEach(function (f) {
          var d = el("div", "dsr__fig");
          d.appendChild(el("span", "dsr__fig-v", f.v));
          d.appendChild(el("span", "dsr__fig-l", f.l));
          fw.appendChild(d);
        });
        rail.appendChild(fw);
      }

      // the résumé link, reusing the masthead's own href rather than a new one
      var cv = document.querySelector('.site-header a[href$="cv.html"], .site-header a[href*="cv.html"]');
      var acts = el("div", "dsr__acts");
      if (cv) {
        var a = el("a", "dsr__cv", "Résumé →");
        a.href = cv.getAttribute("href");
        acts.appendChild(a);
      }
      var mail = document.querySelector('a[href^="mailto:"]');
      if (mail) {
        var m = el("a", "dsr__mail", "Email →");
        m.href = mail.getAttribute("href");
        acts.appendChild(m);
      }
      if (acts.childNodes.length) rail.appendChild(acts);

      /* Before <main>, not appended to <body>. While the rail is fixed its
         position in the DOM is irrelevant, but below 62rem it unpins and
         lays out in normal flow — and appended it landed at 12,257px down
         a 12,613px page, i.e. underneath the footer, which is the one
         place a summary is no use at all. */
      var main = document.querySelector("main");
      if (main && main.parentNode === document.body) {
        document.body.insertBefore(rail, main);
      } else {
        document.body.appendChild(rail);
      }
      remeasure();
    }

    function off() {
      if (rail) { rail.remove(); rail = null; }
      apparatus.unmount();
      remeasure();
    }
    return { on: on, off: off };
  })();

  /* --- wiring --------------------------------------------------------- */

  var MODULES = { dossier: dossier };
  var active = null;

  function sync() {
    var want = root.getAttribute("data-style");
    if (want === active) return;
    if (active && MODULES[active]) MODULES[active].off();
    active = MODULES[want] ? want : null;
    if (active) MODULES[active].on();
  }

  new MutationObserver(sync).observe(root, {
    attributes: true, attributeFilter: ["data-style"]
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync);
  } else { sync(); }
})();
