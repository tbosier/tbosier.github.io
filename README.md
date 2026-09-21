# tbosier.github.io

Personal portfolio site for Taylor Bosier. Static HTML, CSS and vanilla JS.
No build step, no dependencies. GitHub Pages serves it straight from `main`.

## Layout

```
index.html            Single page: hero, metrics, decision systems, about,
                      experience, work, skills, education, contact
cv.html               Resume page with an inline PDF viewer
404.html              Styled not-found page
about.html            Redirect to index.html#about  (old links)
portfolio.html        Redirect to index.html#work   (old links)
pre-ai/               The site as it stood in May 2025, kept verbatim and
                      shown behind the Pre-AI switch. Marked noindex.
robots.txt
sitemap.xml

assets/css/styles.css Design tokens, one locked palette, light and dark, all layout
assets/css/door.css   The collapse sequence and the consent terminal
assets/js/main.js     Every behavior; one module per feature, no dependencies
assets/js/door.js     The door: kills the page, boots a tty, waits for a keystroke
brain/                Taylor's Brain. A separate page with its own design
                      system; see below. Marked noindex.
resume/               The LaTeX source the PDF is built from
assets/resume/        The published resume PDF
assets/images/        Portrait, favicons, social card
```

## The decision systems

Four tools under one tabbed section, in this order. The first three compute.
The fourth does not, and the page says so.

- **Capacity** (computes) is a two-stage stochastic program with recourse over
  400 sampled demand scenarios. The capacity constraint binds only the first
  stage, so the second stage separates by lane and the Lagrangian decomposes:
  bisect on the scalar dual until the per-lane newsvendor quantiles sum to the
  fleet. Reports EVPI and VSS off the same scenario set. It leads the tabs
  because it is the strongest of the four.
- **Pricing** (computes) is a three-level Normal hierarchy fitted by empirical
  Bayes. Within-lane sums of squares give sigma-squared; tau-squared comes from
  a weighted moment equation solved by bisection, *not* from the variance of
  the lane means, which would count thin lanes' sampling noise as real spread.
  The quote is the precision-weighted blend.
- **Dispatch** (computes) is a pickup-and-delivery problem. Candidate routes
  are built by randomized cheapest insertion under precedence, capacity and a
  range limit; a greedy pass then covers every order with a disjoint subset of
  them. It is a heuristic with no LP relaxation and therefore no optimality
  gap, and the panel copy says that outright. Do not call it set partitioning.
  It does not always cover all eleven orders (seeds 51, 62, 68 and 98 serve
  ten); the readout reports the shortfall and the copy says it can happen.
  Time windows, service times and hours-of-service are not modeled. Nothing
  that is not enforced may be displayed as though it were a constraint.
- **Contracts** (does **not** compute) is a hand-authored six-beat walkthrough
  of the *shape* of a contract retrieval pipeline. Every constant at the top of
  `initContracts` (chunk count, token counts, eligible revenue, tier rate, the
  customer) is invented, and must stay invented. No employer's corpus size,
  customer, or commercial terms belong on that canvas or anywhere else on this
  site. The panel carries a disclosure saying the data is not real, and the
  section intro names it as the exception to the other three. If you change
  those numbers, or make this panel compute for real, update both.

Every number in the first three readouts is measured off the solution being
drawn. If you change a model, check the readout still agrees with the picture.

## Taylor's Brain

The site serves two readers. `index.html` is Taylor as observed from outside:
ordered, concise, and enough for a hiring manager in forty-five seconds. At the
bottom of it is one marked exit, `[ enter Taylor's brain ]`, and everything past
that door is allowed to be art.

**The weirdness is opt-in, and the opt-in is real.** Clicking the door does not
navigate. It desaturates the portfolio, removes its navigation, fades it to
black, and boots a terminal that runs a fake `pacman` sync and then asks
`Continue? [y/N]:`. There is no button. The visitor types `y` on a physical
keyboard, or on a phone taps the black once to raise the on-screen one, and
types it there. `n` and `Escape` both print `reasonable.` and put the portfolio
back exactly as it was. Anything else prints `error: expected a decision.` and
asks again — and a key pressed while that prompt is reprinting is held, not
dropped, with Escape always taking priority over anything queued.

**The exit is never not available, and that is a load-bearing claim.** Escape
aborts at any point in the roughly sixteen-second boot, not only once the
prompt appears; on a touch device a tap on the black does the same. A refusal
tags its own cleanup, so pressing the door again during the 1.5s restore does
not leave the new run's terminal hidden. And a `pageshow` handler puts the page
back if a browser restores it from the back/forward cache mid-sequence.

`brain/` is a single page of eight rooms, one mounted at a time from
`data-room` on `<html>`, each an independently scrolling field with its own
ground, its own entrance and its own personality. It deliberately does **not**
share `styles.css`: a darkroom that followed your light-mode preference would
not be a darkroom.

- **Fig. 001**, the map. A branching ink drawing that is a fresh draw on every
  visit. The spine of each limb is a discrete Brownian bridge pinned at the
  origin and at that limb's terminal, with excursions past ±105 user units
  clipped so an unlucky draw cannot leave the plate — which is why the caption
  says *clipped* and not just *bridge*. The side growth is a branching process
  with Poisson(λ) offspring and λ = 1.75 × 0.62 per generation. Note that this
  is **not** subcritical: the first two generations have mean 1.75 and 1.09,
  and only from the third does the mean fall below one. Termination is
  guaranteed by the four-generation cap and a segment budget, not by the
  criticality, and the caption says so. The seven terminals are *not* sampled —
  they are the navigation. The seed is printed under the plate, and
  `?seed=<n>` reproduces a draw you liked.
- **Uncertainty** — a posterior that breathes. The pointer supplies the data:
  across is the sample mean, up is the sample size. Conjugate normal update
  with known variance: prior N(0,1), each observation carrying variance 1, so
  the posterior precision is 1+n and the mean is n·x̄/(1+n). The band is the
  central 89% interval, drawn at z = 1.5982, the 0.945 normal quantile. Four
  scraps carry real writing; a fifth is blank on purpose.
- **Photographs** — a contact sheet, cursor replaced by a working loupe.
- **Machines** — a schematic of a forecasting pipeline with components you can
  inspect. **Every figure on that plate is invented and the plate says so.**
  The shape is real; the numbers are not, and no employer's data belongs there.
- **Familiars** — the cats, hung as a formal exhibition.
- **Current obsession** — Rust, as a man page crossed with a photocopied zine.
  Replace this room when the obsession changes; that is the point of it.
- **Opinions nobody requested** — one opinion, argued properly, with the paper
  that supports it *and* the paper that contradicts it, and a live exhibit that
  demonstrates the claim rather than asserting it.
- **Things which currently have no purpose** — a dead end, and a note to future
  Taylor kept in `localStorage` and sent nowhere.

There is also a curated shell on `` ` `` or the `$_` in the corner. `cd math`
and friends are real navigation. `sudo rm -rf self-doubt` asks for a password
and, whatever you type, reports that self-doubt remains installed.

**Placeholder media.** The contact sheet pulls from `picsum.photos` and the cats
from `cataas.com`, both at runtime, both with an `onerror` fallback that says so
on the plate. Swap the photographs for real negatives when they are scanned;
the captions are already the real thing.

**Constraints that still apply in here.** Reduced motion collapses every
entrance and every transition — including, pointedly, the one chart that is
arguing in favour of animation, which then says on the page that it has just
undercut itself. Nothing uses `innerHTML` for text. No employer's data, corpus,
customer or commercial term appears anywhere, exactly as on the front of the
site.

## Working on it

There is nothing to install. To preview locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Open a file, edit it, refresh. That's the whole workflow.

## Updating the résumé

The résumé is authored in LaTeX at `resume/tbosier_resume2.tex`, in this repo,
so the source and the published PDF version together. Build it and copy the
result to where Pages serves it:

```sh
cd resume && pdflatex -interaction=nonstopmode tbosier_resume2.tex && cd ..
cp resume/tbosier_resume2.pdf assets/resume/tbosier_resume2.pdf
```

The build artifacts `pdflatex` leaves in `resume/` are gitignored; the PDF is
committed only at `assets/resume/`, so there is one published copy and no
second one drifting behind it.

**It fits on one page, and the preamble is tuned so it only just does.** Adding
a bullet will push Education onto page two. Check the page count before
committing:

```sh
pdfinfo assets/resume/tbosier_resume2.pdf | grep Pages
```

Then bump the "Last updated" line in `cv.html`. Both the nav button and the
hero's download button point at `assets/resume/tbosier_resume2.pdf`.

## Conventions

- **Nothing confidential.** No employer's corpus sizes, customer names,
  contract terms, or internal counts, on the page, in the résumé, or in a
  canvas constant. Describe the work and the method; leave the scale vague.

- **Colors, spacing, radii, easing** are CSS custom properties at the top of
  `styles.css`. Change a token, not a rule.
- **Dark mode** redefines only the tokens under `:root[data-theme="dark"]`.
  An inline script in each page's `<head>` sets the attribute before first
  paint so the page never flashes the wrong theme.
- **Animation** is opt-in per element: add `class="reveal"` and it fades up
  when scrolled into view. Wrap a group in `data-stagger="80"` to cascade its
  direct `.reveal` children 80ms apart.
- **Reduced motion** is honored globally: every animation collapses to its
  finished state under `prefers-reduced-motion: reduce`. Test it before adding
  anything new.
- **Metrics** count up from zero: `data-count="1200"` with optional
  `data-prefix`, `data-suffix`, and `data-decimals`.
- **Palettes** are token sets. Each one owns a light and a dark pair, written
  as `:root[data-palette="x"]:not([data-theme="dark"])` and
  `:root[data-palette="x"][data-theme="dark"]` so both sit at the same
  specificity. Anything filled with `--brand` takes its text color from
  `--on-brand`, never a hard-coded white: in dark palettes `--brand` is light.
- **Canvas modules** must survive being measured at zero size, because a panel
  inside a closed tab reports no dimensions. Defer first paint until a real
  measurement arrives rather than returning early.

## Adding a project

Copy any `<article class="card reveal reveal--scale">` block in the `#work`
section, swap the icon path, title, description, and `.tag` list. The grid
reflows on its own.

## Adding a photography section later

The page is sectioned so this drops in without restructuring: add a
`<section class="section" id="photos">` following the pattern of `#work`, and
add a matching `<li>` to the nav list in both `index.html` and `cv.html`.
Active-section tracking picks up any nav link whose `href` starts with `#`
and points at a real element, so no JS changes are needed.
