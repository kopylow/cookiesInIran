from pathlib import Path
import re

ROOT = Path("/home/antonk/projects/cookiesInIran")
SOURCE = ROOT / "cookiesInIran.txt"
TARGET = ROOT / "locales" / "de" / "manuscript.md"

def is_heading(block: str) -> bool:
    stripped = block.strip()
    return "\n" not in stripped and 5 < len(stripped) < 60

def main():
    text = SOURCE.read_text(encoding="utf-8")
    
    # Split by double newlines or more to get blocks
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    
    output = []
    for block in blocks:
        if is_heading(block):
            output.append(f"# {block}")
        else:
            block_lines = []
            for line in block.splitlines():
                stripped = line.strip()
                if stripped.startswith("•"):
                    block_lines.append(f"- {stripped.removeprefix('•').strip()}")
                else:
                    block_lines.append(stripped)
            output.append("\n".join(block_lines))
            
    # Join with double newlines between blocks (Markdown standard)
    # But wait, the existing manuscript.md doesn't have a blank line after heading.
    # Actually, it's better to have blank lines for proper Markdown rendering.
    # Let's check the existing file's style again.
    # Existing:
    # # Who you gonna call?
    # Meine Reise begann...
    
    # I will follow that style: heading followed immediately by paragraph.
    
    final_output = []
    for i, line in enumerate(output):
        final_output.append(line)
        if i < len(output) - 1:
            # If current is heading, next line starts immediately
            if line.startswith("# "):
                pass 
            else:
                # If current is paragraph, add a blank line before next block
                final_output.append("")
                
    TARGET.write_text("\n".join(final_output).strip() + "\n", encoding="utf-8")
    print(f"Updated {TARGET}")

if __name__ == "__main__":
    main()
