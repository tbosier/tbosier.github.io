/* ==========================================================================
   THE DOOR

   Kills the portfolio, boots a terminal, and refuses to proceed until the
   visitor physically types `y`. No button. A keystroke, or nothing.

   The one rule this file exists to protect: the visitor must be able to get
   back. Escape, `n`, and anything that goes wrong all return the page to
   exactly the state it was in before the door was touched. The sequence is
   theatre; the exit is not.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var btn = document.querySelector("[data-door-open]");
  if (!btn) return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* older browsers: keep the full sequence */ }

  /* Scale every beat by one factor so reduced motion shortens the sequence
     without deleting it. The story still happens; it just does not dawdle. */
  var T = reduced ? 0.06 : 1;
  var ms = function (n) { return Math.max(1, Math.round(n * T)); };

  /* ---- the field ------------------------------------------------------ */

  var tty = document.createElement("pre");
  tty.className = "tty";
  tty.hidden = true;
  tty.setAttribute("role", "log");
  tty.setAttribute("aria-live", "polite");
  tty.setAttribute("aria-label", "Terminal");

  var out = document.createElement("code");
  out.className = "tty__out";
  tty.appendChild(out);

  /* Touch devices have no keyboard until something asks for one, and a
     mobile browser only raises it for a focus() that happens *inside* a real
     user gesture. The prompt arrives fifteen seconds after the click, so that
     gesture is long gone — which means the visitor has to supply a new one.

     So the sink is not a hidden 1px input. It is a transparent field the size
     of the whole terminal: tapping anywhere on the black is the gesture, and
     the keyboard comes up. 16px because anything smaller makes iOS zoom the
     viewport on focus. */
  var sink = document.createElement("input");
  sink.type = "text";
  sink.setAttribute("autocomplete", "off");
  sink.setAttribute("autocorrect", "off");
  sink.setAttribute("autocapitalize", "none");
  sink.setAttribute("spellcheck", "false");
  sink.setAttribute("enterkeyhint", "go");
  sink.setAttribute("aria-label", "Type y to continue, or n to go back");
  sink.className = "tty__sink";
  tty.appendChild(sink);

  var ghost = document.createElement("div");
  ghost.className = "tty__ghost";
  ghost.setAttribute("aria-hidden", "true");

  document.body.appendChild(tty);
  document.body.appendChild(ghost);

  /* ---- writing -------------------------------------------------------- */

  var cancelled = false;
  var timers = [];

  function wait(n) {
    return new Promise(function (resolve) {
      timers.push(setTimeout(resolve, ms(n)));
    });
  }

  /* On a phone the boot sequence is taller than the screen, so the field
     scrolls and has to keep the newest line in view. */
  function follow() { tty.scrollTop = tty.scrollHeight; }

  function line(tone) {
    var el = document.createElement("span");
    el.className = "tty__line" + (tone ? " tty__line--" + tone : "");
    out.appendChild(el);
    follow();
    return el;
  }

  /* Types one line character by character, then breaks. `speed` is ms per
     character; reduced motion collapses it to a single paint. */
  function type(text, tone, speed) {
    var el = line(tone);
    if (reduced || speed === 0) {
      el.textContent = text + "\n";
      return Promise.resolve(el);
    }
    var per = speed || 11;
    return new Promise(function (resolve) {
      var i = 0;
      (function step() {
        if (cancelled) return resolve(el);
        /* Two or three glyphs a tick reads as typing but does not cost a
           frame per character on a long line. */
        i = Math.min(text.length, i + 1 + (Math.random() < 0.35 ? 1 : 0));
        el.textContent = text.slice(0, i);
        follow();
        if (i >= text.length) {
          el.textContent = text + "\n";
          follow();
          return resolve(el);
        }
        timers.push(setTimeout(step, per));
      })();
    });
  }

  /* A pacman-style progress line that fills in place. */
  function bar(name) {
    var el = line("dim");
    var pad = "                          ".slice(name.length);
    if (reduced) {
      el.textContent = " " + name + pad + "100%\n";
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var pct = 0;
      (function step() {
        if (cancelled) return resolve();
        pct = Math.min(100, pct + 9 + Math.floor(Math.random() * 26));
        el.textContent = " " + name + pad + (pct < 100 ? " " : "") + pct + "%\n";
        follow();
        if (pct >= 100) return resolve();
        timers.push(setTimeout(step, 46));
      })();
    });
  }

  var caret = null;
  function showCaret(after) {
    hideCaret();
    caret = document.createElement("i");
    caret.className = "tty__caret";
    caret.setAttribute("aria-hidden", "true");
    (after || out).appendChild(caret);
  }
  function hideCaret() {
    if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
    caret = null;
  }

  /* ---- the sequence --------------------------------------------------- */

  var PACKAGES = [
    "bayesian-inference", "cats", "stochastic-control", "rust",
    "photography", "espresso", "byzantium", "decision-theory",
    "weird-computers", "urbanism", "marginalia", "unfinished-essays",
    "cast-iron", "film-grain", "optimization", "opinions-nobody-requested"
  ];

  function packageBlock() {
    /* Wrapped the way pacman wraps. Two to a line on a phone, four on a
       laptop, so the list never reflows into soup. */
    var per = window.innerWidth < 620 ? 2 : 4;
    var lines = [];
    for (var i = 0; i < PACKAGES.length; i += per) {
      lines.push("    " + PACKAGES.slice(i, i + per).join("  "));
    }
    lines[lines.length - 1] += "  ...";
    return lines;
  }

  var coarse = false;
  try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}

  /* The boot sequence takes about sixteen seconds. Leaving it with no way
     out until the prompt appears would mean the portfolio is gone, unclickable
     and uncancellable, for all of it. So an abort listener covers the whole
     run: Escape at any point, or a click anywhere on the black on a device
     with no Escape key, puts the page back immediately. */
  function onAbort(ev) {
    if (ev.type === "keydown") {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
    }
    if (accepting || rearming) return;   /* the prompt owns the keys by then */
    restore();
  }

  function watchForAbort(on) {
    var fn = on ? "addEventListener" : "removeEventListener";
    window[fn]("keydown", onAbort, true);
    tty[fn]("click", onAbort);
  }

  async function run() {
    /* 1. the portfolio desaturates and loses its navigation */
    root.setAttribute("data-stage", "dying");
    tty.hidden = false;
    watchForAbort(true);
    await wait(2200);
    if (cancelled) return;

    /* 2. nothing, for a beat */
    root.setAttribute("data-stage", "void");
    await wait(1500);
    if (cancelled) return;

    /* 3. a machine wakes up */
    root.setAttribute("data-stage", "tty");
    await wait(800);

    await type("Arch Linux 6.18.7-arch1-1 (tty1)", "dim", 7);
    await type("");
    await wait(420);
    await type("taylor@tbosier ~ $ view-brain", "loud", 38);
    await wait(900);
    await type("");

    await type(":: Synchronizing cognitive databases...", null, 7);
    await bar("core");
    await bar("extra");
    await bar("multilib");
    await wait(260);
    await type("resolving dependencies...", "dim", 6);
    await wait(340);
    await type("looking for conflicting thoughts...", "dim", 6);
    await wait(520);
    await type("");
    await type("Packages (17):", null, 8);
    var block = packageBlock();
    for (var i = 0; i < block.length; i++) {
      await type(block[i], "dim", 4);
    }
    await type("");
    await type("Total Download Size:      ∞", "dim", 6);
    await type("Total Installed Size:     unclear", "dim", 6);
    await wait(700);
    await type("");

    await type("Taylor's brain appears to be...", null, 30);
    await wait(1100);
    await type("interesting.", "warn", 60);
    await wait(900);
    await type("");
    await type("Proceeding may expose you to unfinished ideas,", "dim", 9);
    await type("excessive marginalia, photographs of cats,", "dim", 9);
    await type("mathematical notation, and opinions that nobody", "dim", 9);
    await type("requested.", "dim", 9);
    await type("");
    if (cancelled) return;

    prompt(true);
  }

  /* ---- the gate ------------------------------------------------------- */

  var runId    = 0;       /* which run a pending cleanup belongs to */
  var cleanup  = 0;       /* the pending cleanup timer */
  var wired    = false;   /* the listeners are attached */
  var accepting = false;  /* a prompt is live and wants a key right now */
  var rearming  = false;  /* between "expected a decision" and the next prompt */
  var buffered  = null;   /* the key they pressed during that gap */
  var tapHint   = null;

  async function prompt(first) {
    if (cancelled) return;
    if (!first) await wait(260);
    var el = await type("Continue? [y/N]: ", null, 18);
    showCaret(el);
    wire();
    accepting = true;
    rearming = false;

    if (coarse) {
      /* The keyboard cannot be summoned from here — a mobile browser only
         raises it inside a real gesture, and the click that started all this
         was fifteen seconds ago. So ask for one more tap, and say so. */
      sink.classList.add("is-live");
      if (!tapHint) {
        tapHint = line("dim");
        tapHint.textContent = "\n(tap anywhere, then type y or n)\n";
      }
      /* Harmless on the devices that allow it, ignored on the ones that
         don't. Costs nothing to try. */
      try { sink.focus({ preventScroll: true }); } catch (e) {}
    }

    /* A key pressed while the terminal was busy re-printing the prompt is
       not a key the visitor should have to press twice. */
    if (buffered !== null) {
      var b = buffered;
      buffered = null;
      decide(b);
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    window.addEventListener("keydown", onKey, true);
    sink.addEventListener("input", onSinkInput);
    tty.addEventListener("pointerdown", onTap);
  }

  function unwire() {
    wired = false;
    accepting = false;
    rearming = false;
    buffered = null;
    window.removeEventListener("keydown", onKey, true);
    sink.removeEventListener("input", onSinkInput);
    tty.removeEventListener("pointerdown", onTap);
    sink.classList.remove("is-live");
    sink.value = "";
    try { sink.blur(); } catch (e) {}
  }

  /* Every tap on the black is a fresh gesture, so every tap is another
     chance to get the keyboard up. */
  function onTap() {
    if (!coarse || (!accepting && !rearming)) return;
    try { sink.focus({ preventScroll: true }); } catch (e) { sink.focus(); }
  }

  function onSinkInput() {
    var v = sink.value;
    sink.value = "";
    if (v) feed(v.slice(-1));
  }

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = ev.key;
    if (k === "Escape") { ev.preventDefault(); return feed("n", true); }
    if (k === "Enter")  { ev.preventDefault(); return feed("\n"); }
    if (k.length !== 1) return;   /* Shift, Tab, arrows: not a decision */
    ev.preventDefault();
    feed(k);
  }

  function feed(ch, cancelling) {
    if (accepting) return decide(ch);
    if (!rearming) return;
    /* A cancellation always wins. Otherwise someone who typed a stray key
       and then hit Escape would find the stray key had taken their slot and
       the Escape had been thrown away — which, on this particular page,
       would send them somewhere they had just declined to go. */
    if (cancelling) { buffered = ch; return; }
    if (buffered === null) buffered = ch;
  }

  async function decide(ch) {
    if (!accepting) return;
    accepting = false;
    hideCaret();

    var c = ch.toLowerCase();

    /* Enter alone is the default, and the default is capital N. */
    if (c === "\n") c = "n";

    /* Echo what they actually pressed, onto the prompt line. */
    var lines = out.querySelectorAll(".tty__line");
    var last = lines[lines.length - 1];
    if (last) last.textContent = "Continue? [y/N]: " + (ch === "\n" ? "" : ch) + "\n";

    if (c === "y") { unwire(); watchForAbort(false); return accept(); }
    if (c === "n") { unwire(); return refuse(); }

    /* Not a decision. The prompt takes about a second to come back, and a
       key pressed inside that second is held rather than dropped. */
    rearming = true;
    await wait(360);
    await type("error: expected a decision.", "bad", 14);
    prompt(false);
  }

  async function refuse() {
    await wait(420);
    await type("");
    await type("reasonable.", "ok", 70);
    await wait(1400);
    restore();
  }

  async function accept() {
    await wait(520);
    await type("");
    await type("oh no.", "warn", 90);
    await wait(1200);
    root.setAttribute("data-stage", "leaving");
    out.textContent = "";
    showCaret();
    await wait(900);
    /* sessionStorage, not a query string: the brain should not carry a
       "?consented" in a shared link, and a shared link should still work. */
    try { sessionStorage.setItem("brain:consented", "1"); } catch (e) {}
    window.location.href = "brain/";
  }

  /* ---- coming back ---------------------------------------------------- */

  function restore() {
    cancelled = true;
    timers.forEach(clearTimeout);
    timers = [];
    unwire();
    watchForAbort(false);
    hideCaret();
    tapHint = null;
    root.removeAttribute("data-stage");

    /* The cleanup runs 1.5s later, and the door is focusable again the moment
       the attribute comes off — so a quick second press can start a new run
       inside that window. Tag the cleanup with its run and let it do nothing
       if a newer one has started, or it will hide the new run's terminal and
       leave a live prompt on an invisible page. */
    var mine = runId;
    clearTimeout(cleanup);
    cleanup = setTimeout(function () {
      if (mine !== runId) return;
      tty.hidden = true;
      out.textContent = "";
      cancelled = false;
      try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
    }, ms(1500));
  }

  /* ---- the pointer that stops being a pointer -------------------------- */

  var gx = 0, gy = 0, tx = 0, ty = 0, ticking = false;

  function onMove(ev) {
    tx = ev.clientX; ty = ev.clientY;
    if (reduced) return;          /* no lagging cursor if motion is declined */
    if (!root.hasAttribute("data-stage") || ticking) return;
    ticking = true;
    requestAnimationFrame(glide);
  }

  function glide() {
    /* Lags the mouse by a fixed fraction each frame. Nothing about this is
       responsive, and that is the point. */
    gx += (tx - gx) * 0.12;
    gy += (ty - gy) * 0.12;
    ghost.style.transform = "translate(" + (gx - 4) + "px," + (gy - 8) + "px)";
    if (Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4) {
      requestAnimationFrame(glide);
    } else {
      ticking = false;
    }
  }

  window.addEventListener("mousemove", onMove, { passive: true });

  /* ---- ignition -------------------------------------------------------- */

  btn.addEventListener("click", function () {
    if (root.hasAttribute("data-stage")) return;
    runId++;
    clearTimeout(cleanup);
    out.textContent = "";
    cancelled = false;
    run();
  });

  /* S1: a browser may restore this document from its back/forward cache with
     the portfolio still blurred and the terminal still up, and none of the
     listeners from that session alive. Put the page back. */
  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted) return;
    runId++;
    clearTimeout(cleanup);
    timers.forEach(clearTimeout);
    timers = [];
    unwire();
    watchForAbort(false);
    hideCaret();
    tapHint = null;
    cancelled = false;
    root.removeAttribute("data-stage");
    tty.hidden = true;
    out.textContent = "";
  });
})();
