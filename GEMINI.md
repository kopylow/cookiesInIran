# Cookies in Iran - Project Overview

"Cookies in Iran" is a memoir by Anton Kopylow detailing his travel experiences in Iran. This project is localized into multiple languages and supports both print (LaTeX) and web (HTML) outputs.

## Directory Overview

- `locales/`: The single source of truth for all content.
    - `de/manuscript.md`: German manuscript.
    - `en/manuscript.md`: English manuscript.
    - `ru/manuscript.md`: Russian manuscript.
    - `fa/manuscript.md`: Farsi manuscript.
- `tex-book/`: The LaTeX project directory for book production.
    - `main.tex`: The master LaTeX template.
- `web-landing-page/`: The website project directory.
    - `manuscript_*.html`: Auto-generated HTML fragments for the site.
- `Pics/`: Images used in the manuscript and website.
- `build.py`: The master build script for generating all outputs.
- `Kekse.txt`: Original German source manuscript (legacy).
- `TRANSLATION_GUIDE.md`: Guidelines for localization and translation.
- `Zeitenanalyse.md`: Analysis of tenses used in the manuscript.
- `kekse_im_iran_ux_blueprint.md`: UX and design blueprint for the project.

## Usage

### Generating All Outputs
To update both the LaTeX books and the website fragments for all languages, run:

```bash
python3 build.py
```

This script will:
1. Parse the Markdown files in `locales/`.
2. Generate localized LaTeX manuscripts with professional typography (no widows/orphans).
3. Compile PDFs for all languages using the appropriate engine (`pdflatex` for DE/EN, `xelatex` for RU/FA).
4. Generate HTML snippets for the landing page with RTL support for Farsi.
5. Clean up all temporary LaTeX junk files automatically.

## Development Conventions
- **Source of Truth**: Always edit the Markdown files in `locales/`.
- **Styling**: Changes to the book's layout should be made in `tex-book/main.tex`.
- **Typography**: The build script enforces strict rules against "Hurenkinder" (widows) and "Schusterjungen" (orphans).
- **Localization**: Follow the instructions in `TRANSLATION_GUIDE.md` when adding or updating languages.
