from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "cookiesInIran.txt"
TARGET = ROOT / "tex-book" / "manuscript.tex"

def escape_latex(text: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in text)

def is_heading(block: str) -> bool:
    # A block is a heading if it's single-line and not too long or short
    stripped = block.strip()
    return "\n" not in stripped and 5 < len(stripped) < 60

def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    word_count = len(text.split())
    
    # Save word count to a separate LaTeX file
    stats_file = ROOT / "tex-book" / "wordcount.tex"
    stats_file.write_text(rf"\newcommand{{\wordcount}}{{{word_count:,}}}" + "\n", encoding="utf-8")

    # Split by double newlines or more
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]

    output = []
    for block in blocks:
        if is_heading(block):
            escaped = escape_latex(block)
            output.append(rf"\chapter*{{{escaped}}}")
            output.append(rf"\addcontentsline{{toc}}{{chapter}}{{{escaped}}}")
            output.append("")
        else:
            paragraph_lines = []
            bullet_lines = []

            def flush_paragraph() -> None:
                if paragraph_lines:
                    normalized = " ".join(paragraph_lines)
                    output.append(escape_latex(normalized))
                    output.append("")
                    paragraph_lines.clear()

            def flush_bullets() -> None:
                if bullet_lines:
                    output.append(r"\begin{itemize}")
                    for bullet in bullet_lines:
                        output.append(rf"  \item {escape_latex(bullet)}")
                    output.append(r"\end{itemize}")
                    output.append("")
                    bullet_lines.clear()

            for line in block.splitlines():
                stripped = line.strip()
                if not stripped:
                    flush_paragraph()
                    flush_bullets()
                    continue
                if stripped.startswith("•"):
                    flush_paragraph()
                    bullet_lines.append(stripped.removeprefix("•").strip())
                else:
                    flush_bullets()
                    paragraph_lines.append(stripped)

            flush_paragraph()
            flush_bullets()

    TARGET.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
