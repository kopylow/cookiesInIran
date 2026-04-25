# Cookies in Iran - Project Overview

"Cookies in Iran" is a memoir by Anton Kopylow detailing his travel experiences in Iran with a 1993 Mercedes W124. The narrative focuses on a complex legal ordeal involving vehicle impoundment, customs regulations, and his interactions with the Iranian justice system.

## Directory Overview

This directory contains the manuscript for the book in both raw text and LaTeX formats, along with automation scripts for processing the content.

### Key Files
- `cookiesInIran.txt`: The primary source manuscript (in German).
- `Kekse.txt`: A detailed timeline and summary of the events described in the book (in German).
- `missing.txt`: Notes and chapter ideas.
- `tex-book/`: The LaTeX project directory for book production.
    - `main.tex`: The master LaTeX file.
    - `manuscript.tex`: The auto-generated LaTeX content (do not edit directly).
    - `generate_manuscript.py`: Python script to convert `cookiesInIran.txt` into LaTeX format.
    - `wordcount.tex`: Auto-generated file containing the manuscript's word count.

## Usage

### Generating the Manuscript
To update the LaTeX manuscript from the source text, run the generation script from the root directory:

```bash
python3 tex-book/generate_manuscript.py
```

This script will:
1. Read `cookiesInIran.txt`.
2. Escape LaTeX special characters.
3. Identify chapters based on line length and formatting.
4. Update `tex-book/manuscript.tex` and `tex-book/wordcount.tex`.

### Compiling the Book
After generating the manuscript, navigate to the `tex-book/` directory and compile the PDF:

```bash
cd tex-book
pdflatex main.tex
```
*(Note: You may need to run it twice for the table of contents to update correctly.)*

## Development Conventions
- **Source of Truth**: Always edit `cookiesInIran.txt` for content changes.
- **LaTeX Formatting**: Any changes to the book's layout, fonts, or styling should be made in `tex-book/main.tex`.
- **Automation**: If the chapter detection logic in `generate_manuscript.py` needs adjustment, ensure it continues to handle German special characters and LaTeX escapes properly.
