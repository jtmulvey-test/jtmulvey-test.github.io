# Eshana Bethur — research website

Static site for GitHub Pages. No frameworks, no npm, no build tooling beyond
one Python script. Two pages: **Research** (`index.html`) and **Contact**
(`contact.html`). The publication list lives at the bottom of the research
page — there is no separate publications page.

## How to add content

Everything on the research page comes from the `content/` folder. One folder
per card:

```
content/01-silver-dna-duplexes/
├── card.md      ← card title + intro blurb
├── 1.png        ← slide 1 media
├── 1.md         ← slide 1 text
├── 2.mp4
├── 2-poster.jpg ← optional poster frame for video
├── 2.md
└── ...
```

Three rules:

1. **The number is the order.** `1`, `2`, `3` … appear in that order.
2. **The extension is the type.** `.mp4/.webm/.mov` render as video,
   `.png/.jpg/.webp/.gif` as images.
3. **The matching `.md` is the text.** `1.md` describes `1.png`.

Card order on the page follows folder name, so keep the `NN-` prefix.

### `card.md`

```markdown
---
title: "Silver-mediated DNA duplexes"
description: "One or two sentences, roughly fifty words, that set up the card."
---
```

### `1.md` (one per slide)

```markdown
---
title: "Duplex formation"
journal: "ACS Nano"
journal_link: "https://doi.org/10.1021/acsnano.3c08008"
description: "What this dataset shows, in a sentence or two."
alt: "Screen-reader description of the image or video"
data: "Eshana Bethur"
---
```

`journal` and `journal_link` are optional — leave them `""` for unpublished
data. Any extra field (like `data:` above) renders as a small "Label: value"
credit line, and the name is mirrored into `data/people.json` where you can
paste a profile URL to turn it into a link.

## Publishing a change

```
python build.py
git add . && git commit -m "add cryo-EM dataset" && git push
```

`build.py` regenerates `data/manifest.json` and copies publication TOC figures
from `content/TOC_images/` into `assets/img/publications/`. Run it before every
commit — this repo has no GitHub Action, so nothing regenerates the manifest
for you. Never edit `manifest.json` by hand.

To preview locally:

```
python build.py
python -m http.server 8000
# open http://localhost:8000
```

## Other content

| What | Where |
|---|---|
| Publication cards | `data/publications.json` |
| Full citation list | the `.cv-pubs` block in `index.html` |
| Publication TOC figures | `content/TOC_images/<exact paper title>.png` |
| Scholar / ORCID / LinkedIn / email | `data/links.json` |
| Colors, fonts, spacing | `assets/css/base.css` (the `:root` block) |
| Page copy outside the cards | `index.html`, `contact.html` |

## Media guidelines

GitHub Pages caps a published site at **1 GB** and any single file at
**100 MB**. Compress before committing:

```bash
ffmpeg -i raw.mov -vf "scale=1280:-2" -c:v libx264 -crf 24 -preset slow \
       -pix_fmt yuv420p -an 1.mp4
ffmpeg -i 1.mp4 -frames:v 1 1-poster.jpg
```

Videos autoplay muted and looped, so keep them short (3–10 s) and drop the
audio track.

## Deploying

1. Push this folder to a repo named `<username>.github.io`.
2. Settings → Pages → Source: `main`, folder `/ (root)`.

`.nojekyll` is already present so Pages serves the files as-is.

## Placeholder content — replace before launch

Everything below is filler, labelled as such in the corner of each image:

- **`content/01-*` and `content/02-*`** — two cards of filler datasets.
- **`content/TOC_images/`** — four filler TOC figures.
- **`data/links.json`** — email, LinkedIn and Scholar are real. Add GitHub or
  ORCID rows if she wants them.
- **Site URL** — `eshanabethur.github.io` is a guess. Search the HTML files
  for it once the real repo name is known; it appears in the canonical and
  Open Graph tags.
- **`assets/img/site/og-image.png`** — generated placeholder.
