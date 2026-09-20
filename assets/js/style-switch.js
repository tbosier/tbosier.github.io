/* =========================================================================
   Design harness — temporary, not part of the site.

   Two independent axes, because the design is settled and the colour is
   not:

     data-style="dossier"   the one alternate design, in style-dossier.css
     data-accent="…"        one of seven printing colours, in accents.css

   Both are scoped entirely under those attributes, so removing them falls
   back to the base stylesheet untouched. This file builds its own control
   and its own chrome; it reads no design token and sets no site class, so
   the harness looks the same whichever colour is showing and cannot be
   mistaken for part of the page.

   Keys: 0 the shipped base, D Dossier, 1-7 the accents, [ and ] step
   through them. Collapsing the panel turns the shortcuts off.

   To revert the site completely: this file and its <script> tag, the
   style-dossier.css and accents.css <link>s, the data-style/data-accent
   block in each page's pre-paint <head> script, and the extra families
   added to the Google Fonts URL. Keep Fraunces' SOFT/WONK axes if you
   keep the base sheet, which needs them for its font-variation-settings.
   ========================================================================= */
(function () {
  "use strict";

  /* This is a review tool, and review tools must not ship. It mounts only
     when the page is being served locally, or when someone asks for it by
     name with ?lab. Published without this guard it would put unfinished
     design notes ("strongest taste, weakest fit") on a stranger's screen,
     and its bare number keys -- which need no click, only a focused body
     -- would write designStyle and designAccent into the localStorage of
     a visitor who never knew the panel was there, changing the site for
     them on every later visit. */
  var host = location.hostname;
  var local = host === "localhost" || host === "127.0.0.1" || host === "::1" ||
              host === "[::1]" || host === "0.0.0.0" || location.protocol === "file:";
  if (!local && !/[?&]lab(=|&|$)/.test(location.search)) return;

  var KEY = "designStyle";

  /* Two independent axes now, because the design is settled and the
     colour is not: STYLES picks the shipped base or Dossier, ACCENTS
     picks the printing colour. Number keys drive the accents, since that
     is what is being compared; [ and ] step through them. */
  var STYLES = [
    { id: "",        n: "0", name: "Base",    note: "the site as shipped" },
    { id: "dossier", n: "D", name: "Dossier", note: "standing rail, editorial column" }
  ];

  var ACCENTS = [
    { id: "amber",     name: "Amber",     note: "instrumentation \u00b7 monitored, not marketed" },
    { id: "brass",     name: "Brass",     note: "scholarly \u00b7 senior, considered" },
    { id: "sage",      name: "Sage",      note: "clinical-botanical \u00b7 calm, lowest risk" },
    { id: "ice",       name: "Ice",       note: "trust by convention \u00b7 safest, least distinct" },
    { id: "rose",      name: "Rose",      note: "art direction \u00b7 strongest taste, weakest fit" },
    { id: "vermilion", name: "Vermilion", note: "assertive \u00b7 rubrication, decide" },
    { id: "bone",      name: "Bone",      note: "no accent \u00b7 confident, demanding" }
  ];
  var AKEY = "designAccent";

  var root = document.documentElement;

  function indexOfCurrent() {
    var cur = root.getAttribute("data-style") || "";
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === cur) return i;
    return 0;
  }

  /* --- chrome -------------------------------------------------------- */

  var css = [
    ".dlab{position:fixed;left:clamp(.75rem,3vw,1.5rem);bottom:clamp(.75rem,3vw,1.5rem);",
    "z-index:300;font:500 12px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;",
    "color:#e8e8ea;background:rgba(14,14,16,.92);border:1px solid rgba(255,255,255,.14);",
    "border-radius:12px;box-shadow:0 18px 44px -20px rgba(0,0,0,.9);",
    "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);",
    /* leave the back-to-top button its corner: it is 2.4rem plus gutter */
    "display:flex;flex-direction:column;overflow:hidden;",
    "max-width:min(calc(100vw - 6rem),21rem)}",
    "@media print{.dlab{display:none}}",

    ".dlab__bar{display:flex;align-items:center;gap:.5rem;padding:.45rem .5rem .45rem .7rem}",
    ".dlab__eyebrow{font-size:9px;letter-spacing:.18em;text-transform:uppercase;",
    "color:#7e7e88;flex:none}",
    ".dlab__now{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
    "font-size:11.5px;letter-spacing:.02em;color:#f3f3f5}",
    ".dlab__now b{font-weight:600}",
    ".dlab__now i{font-style:normal;color:#8a8a94}",

    ".dlab__list{display:flex;gap:2px;padding:0 .5rem .5rem;flex-wrap:wrap}",
    ".dlab__opt{appearance:none;-webkit-appearance:none;font:inherit;font-size:11px;",
    "padding:.36rem .5rem;border:1px solid rgba(255,255,255,.12);border-radius:7px;",
    "background:transparent;color:#a6a6b0;cursor:pointer;white-space:nowrap;",
    "transition:color .15s,background-color .15s,border-color .15s}",
    ".dlab__opt:hover{color:#fff;border-color:rgba(255,255,255,.3)}",
    ".dlab__opt[aria-pressed=true]{background:#f3f3f5;border-color:#f3f3f5;color:#101014;font-weight:600}",
    ".dlab__opt kbd{font:inherit;font-size:9px;opacity:.9;margin-right:.35rem}",

    ".dlab__x{appearance:none;-webkit-appearance:none;flex:none;width:1.4rem;height:1.4rem;",
    "display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.12);",
    "border-radius:6px;background:transparent;color:#a6a6b0;cursor:pointer;font:inherit;font-size:11px}",
    ".dlab__x:hover{color:#fff;border-color:rgba(255,255,255,.3)}",
    ".dlab.is-shut .dlab__list{display:none}",
    ".dlab.is-shut .dlab__acc-note{display:none}",
    ".dlab__list--accent{padding-top:0;border-top:1px solid rgba(255,255,255,.1);margin-top:.15rem;padding-top:.5rem}",
    ".dlab__opt--acc{font-size:10.5px;padding:.3rem .45rem}",
    ".dlab :focus-visible{outline:2px solid #6ea8ff;outline-offset:2px}"
  ].join("");

  var sheet = document.createElement("style");
  sheet.textContent = css;
  document.head.appendChild(sheet);

  /* --- markup --------------------------------------------------------- */

  var box = document.createElement("div");
  box.className = "dlab";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Design style");

  var bar = document.createElement("div");
  bar.className = "dlab__bar";

  var eyebrow = document.createElement("span");
  eyebrow.className = "dlab__eyebrow";
  eyebrow.textContent = "Accent";

  var now = document.createElement("p");
  now.className = "dlab__now";
  now.style.margin = "0";
  // Announce the change to a screen reader, since the visual difference is
  // the whole point and none of it is conveyed any other way.
  now.setAttribute("aria-live", "polite");

  var shut = document.createElement("button");
  shut.type = "button";
  shut.className = "dlab__x";
  shut.setAttribute("aria-expanded", "true");
  shut.textContent = "–";
  shut.setAttribute("aria-label", "Collapse style switcher");

  bar.appendChild(eyebrow);
  bar.appendChild(now);
  bar.appendChild(shut);

  var list = document.createElement("div");
  list.className = "dlab__list";

  var accentRow = document.createElement("div");
  accentRow.className = "dlab__list dlab__list--accent";

  function accentIndex() {
    var cur = root.getAttribute("data-accent") || "rose";
    for (var i = 0; i < ACCENTS.length; i++) if (ACCENTS[i].id === cur) return i;
    return 4;
  }

  function applyAccent(i, persist) {
    var a = ACCENTS[i];
    if (!a) return;
    root.setAttribute("data-accent", a.id);
    if (persist) { try { localStorage.setItem(AKEY, a.id); } catch (e) {} }
    for (var k = 0; k < accentBtns.length; k++) {
      accentBtns[k].setAttribute("aria-pressed", k === i ? "true" : "false");
    }
    accNote.textContent = a.name + " — " + a.note;
    /* The canvases repaint themselves: each one observes data-accent on
       <html> and answers by calling readColours(). A synthetic resize
       would not do it — resize() returns false only on a zero-sized box,
       so the event does get through, but the handlers repaint from the
       colours they already cached and the new accent never lands. */
  }

  var accentBtns = ACCENTS.map(function (a, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dlab__opt dlab__opt--acc";
    b.innerHTML = "<kbd>" + (i + 1) + "</kbd>";
    b.appendChild(document.createTextNode(a.name));
    b.title = a.name + " — " + a.note + "  (press " + (i + 1) + ")";
    b.addEventListener("click", function () { applyAccent(i, true); });
    accentRow.appendChild(b);
    return b;
  });
  var accNote = document.createElement("p");
  accNote.className = "dlab__acc-note";
  accNote.style.cssText = "margin:.1rem .5rem .5rem;font-size:10px;color:#8a8a94;line-height:1.5";

  var buttons = STYLES.map(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dlab__opt";
    b.innerHTML = "<kbd>" + i + "</kbd>";
    b.appendChild(document.createTextNode(s.name));
    b.title = s.name + " — " + s.note + "  (press " + i + ")";
    b.addEventListener("click", function () { apply(i, true); });
    list.appendChild(b);
    return b;
  });

  box.appendChild(bar);
  box.appendChild(list);
  box.appendChild(accentRow);
  box.appendChild(accNote);

  /* --- behaviour ------------------------------------------------------ */

  function apply(i, persist) {
    var s = STYLES[i];
    if (!s) return;
    if (s.id) root.setAttribute("data-style", s.id);
    else root.removeAttribute("data-style");

    if (persist) {
      try { localStorage.setItem(KEY, s.id); } catch (e) {}
    }

    // The canvas panels watch data-style and re-read their colours, but they
    // only re-measure on a resize. Each style sets a different --container,
    // so the canvases change CSS width here while their backing bitmaps keep
    // the old one — blurred, mis-scaled drawings until the window is resized.
    // A resize event is what those modules already listen for. Fire it after
    // a frame so the new stylesheet has been applied before they measure.
    requestAnimationFrame(function () {
      window.dispatchEvent(new Event("resize"));
    });

    now.innerHTML = "";
    var strong = document.createElement("b");
    strong.textContent = s.n + " " + s.name;
    var em = document.createElement("i");
    em.textContent = "  " + s.note;
    now.appendChild(strong);
    now.appendChild(em);

    for (var k = 0; k < buttons.length; k++) {
      buttons[k].setAttribute("aria-pressed", k === i ? "true" : "false");
    }
  }

  // Collapsing turns the keyboard shortcuts off as well as hiding the list.
  // WCAG 2.1.4 wants single-character shortcuts to be switchable off, and
  // hiding a list while the keys still fire is not a mechanism to turn them
  // off — it just makes them invisible.
  shut.addEventListener("click", function () {
    var open = box.classList.toggle("is-shut") === false;
    shut.setAttribute("aria-expanded", open ? "true" : "false");
    shut.textContent = open ? "–" : "+";
    shut.setAttribute("aria-label",
      open ? "Collapse style switcher, and turn its keyboard shortcuts off"
           : "Expand style switcher, and turn its keyboard shortcuts on");
  });

  // Number keys jump straight to a style; [ and ] step through them. Skipped
  // while a field has focus, with any modifier held, for an event another
  // handler has already claimed, and whenever the switcher is collapsed —
  // that collapse is the off switch WCAG 2.1.4 requires for unmodified
  // character shortcuts.
  document.addEventListener("keydown", function (e) {
    if (box.classList.contains("is-shut")) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.defaultPrevented) return;
    var t = e.target;
    if (t && (t.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""))) return;

    if (e.key === "0") {
      apply(0, true);                       // the shipped base
    } else if (e.key === "d" || e.key === "D") {
      apply(1, true);                       // dossier
    } else if (e.key >= "1" && e.key <= "9" && Number(e.key) <= ACCENTS.length) {
      apply(1, true);                       // an accent implies dossier
      applyAccent(Number(e.key) - 1, true);
    } else if (e.key === "]" || e.key === "[") {
      var ad = e.key === "]" ? 1 : -1;
      apply(1, true);
      applyAccent((accentIndex() + ad + ACCENTS.length) % ACCENTS.length, true);
      return;
    } else if (false) {
      var d = 0;
      apply((indexOfCurrent() + d + STYLES.length) % STYLES.length, true);
    } else {
      return;
    }
    e.preventDefault();
  });

  document.body.appendChild(box);
  apply(indexOfCurrent(), false);
  applyAccent(accentIndex(), false);
})();
