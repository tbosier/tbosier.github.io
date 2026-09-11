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

assets/css/styles.css Design tokens, four palettes, light and dark, all layout
assets/js/main.js     Every behaviour; one module per feature, no dependencies
assets/resume/        The published resume PDF
assets/images/        Portrait, favicons, social card
```

## The decision systems

Three tools under one tabbed section, each a real computation run in the
browser rather than a recording:

- **Dispatch** is a pickup and delivery problem. Candidate routes (columns)
  are built by randomised cheapest insertion under precedence, capacity and a
  range limit, then a set partitioning pass takes a least cost cover. Three
  views: the map, the instance as a table, and driver to order assignment.
- **Pricing** fits a logistic bid response model to past wins and losses by
  random walk Metropolis, then maximises expected revenue over the posterior
  to choose a quote.
- **Contracts** ingests a synthetic corpus, chunks it, embeds each chunk as a
  topic mixture, and answers a semantic query by cosine similarity, then ties
  the retrieved rebate terms to a customer volume.

Every number in those readouts is measured off the solution being drawn. If
you change a model, check the readout still agrees with the picture.

## Working on it

There is nothing to install. To preview locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Open a file, edit it, refresh. That's the whole workflow.

## Updating the résumé

The résumé is authored in LaTeX in a **separate** directory
(`../texResumes/tbosier_resume2.tex`) and the compiled PDF is copied into this
repo so GitHub Pages can serve it. After recompiling:

```sh
cp ../texResumes/tbosier_resume2.pdf assets/resume/tbosier_resume2.pdf
```

Then bump the "Last updated" line in `cv.html`. Both the nav button and the
hero's download button point at `assets/resume/tbosier_resume2.pdf`.

## Conventions

- **Colours, spacing, radii, easing** are CSS custom properties at the top of
  `styles.css`. Change a token, not a rule.
- **Dark mode** redefines only the tokens under `:root[data-theme="dark"]`.
  An inline script in each page's `<head>` sets the attribute before first
  paint so the page never flashes the wrong theme.
- **Animation** is opt-in per element: add `class="reveal"` and it fades up
  when scrolled into view. Wrap a group in `data-stagger="80"` to cascade its
  direct `.reveal` children 80ms apart.
- **Reduced motion** is honoured globally — every animation collapses to its
  finished state under `prefers-reduced-motion: reduce`. Test it before adding
  anything new.
- **Metrics** count up from zero: `data-count="35000"` with optional
  `data-prefix`, `data-suffix`, and `data-decimals`.
- **Palettes** are token sets. Each one owns a light and a dark pair, written
  as `:root[data-palette="x"]:not([data-theme="dark"])` and
  `:root[data-palette="x"][data-theme="dark"]` so both sit at the same
  specificity. Anything filled with `--brand` takes its text colour from
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
and points at a real element — no JS changes needed.
