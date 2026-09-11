# tbosier.github.io

Personal portfolio site for Taylor Bosier. Static HTML, CSS, and vanilla JS —
no build step, no dependencies. GitHub Pages serves it straight from `main`.

## Layout

```
index.html            Single-page site: hero, metrics, about, experience,
                      work, skills, education, contact
cv.html               Résumé page with an inline PDF viewer
404.html              Styled not-found page
about.html            Redirect → index.html#about  (kept so old links resolve)
portfolio.html        Redirect → index.html#work   (kept so old links resolve)
robots.txt
sitemap.xml

assets/css/styles.css Design tokens, light/dark themes, all animation
assets/js/main.js     Theme toggle, scroll reveal, counters, nav tracking
assets/resume/        The published résumé PDF
assets/images/        Portrait, favicons, social card, and the older tech
                      logos (currently unused — see note below)
```

The tech-logo PNGs in `assets/images/` are left over from the previous site.
They came from mixed sources at mixed sizes, several with baked-in white
backgrounds, so a logo strip built from them reads as a row of mismatched
boxes. The skill pills in the Toolkit section cover the same ground and look
deliberate. If you ever want the logo strip back, re-export the logos as
transparent SVGs at a consistent height first.

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
