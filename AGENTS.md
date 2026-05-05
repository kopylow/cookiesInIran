# AGENTS.md

## What this is

A memoir ("Kekse im Iran" / "Cookies in Iran") localized into 4 languages (DE, EN, RU, FA) with two outputs: print PDFs and a web landing page. This is a content project, not software — there are no tests, linting, or CI.

## Source of truth

Always edit `locales/{lang}/manuscript.md`. Never edit generated files.

- `locales/de/manuscript.md` — German (the original)
- `locales/en/manuscript.md` — English
- `locales/ru/manuscript.md` — Russian
- `locales/fa/manuscript.md` — Farsi

## Build

```bash
python3 build.py
```

This does everything: parses Markdown, generates LaTeX manuscripts, compiles PDFs, generates HTML fragments for the landing page, and cleans up temp files.

- DE/EN use `pdflatex` internally (via xelatex call); RU/FA require `xelatex` with font support
- Farsi requires `xepersian` LaTeX package
- PDF output filenames are auto-renamed to the localized title (e.g. `Kekse_im_Iran.pdf`)
- HTML fragments land in `web-landing-page/manuscript_{lang}.html`

## Key files

- `tex-book/main.tex` — LaTeX template (book layout, A5, typography). Edit here for styling changes, not in build.py
- `web-landing-page/index.html` + `main.js` + `styles.css` — the landing page
- `TRANSLATION_GUIDE.md` — translation rules: no `*` for emphasis, no em-dashes, preserve "Ghostbusters" refs, "Taarof", Mercedes W124
- `Zeitenanalyse.md` — German tense analysis: Präteritum for narrative, Präsens for high-tension chapters
- `kekse_im_iran_ux_blueprint.md` — UX spec: tense-driven UI state machine (Präsens = cold/claustrophobic, Präteritum = warm/fluid), airlock images between chapters

## Content conventions

- Chapters start with `# Title` (H1 = LaTeX `\chapter`)
- Lists use `- item` (auto-converted to `\begin{itemize}` / `<ul>`)
- No `*` asterisks for emphasis anywhere in manuscripts
- No em-dashes `—`; use `:` or `,` instead
- Present-tense chapters are tagged in HTML with `data-tense="present"` (chapters 2, 12, 17, 18, 20, 22 — see `present_indices` in build.py:100)

## Layout for book changes

Edit `tex-book/main.tex`. The build script strips babel/inputenc/fontenc/lmodern from the template and injects language-specific setup. Do not add those packages back to the template.

## Web landing page

- Images between chapters are in `Pics/` (1-24.jpg). The HTML generator maps chapter indices to image filenames in `build.py:101-102`
- RTL is automatic for Farsi (`dir="rtl"`)
- Language/theme state is managed client-side in `main.js`
