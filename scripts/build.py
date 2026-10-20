#!/usr/bin/env python3
"""Build only explicitly allowed public files, including six approved phase icons."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "index.html", "styles.css", "theme.css", "app.js", "config.js", "data.js",
    "favicon.svg", ".nojekyll", "deliverables.js", "deliverables.css",
    "skywater_weekly_report_template.html",
) + tuple(f"assets/timeline-icons/{number:02d}.webp" for number in range(1, 7))

def main() -> None:
    source = ROOT / "site"
    destination = ROOT / "_site"
    for name in ASSETS:
        path = source / name
        if not path.is_file() or any(p.is_symlink() for p in (path, *path.parents)):
            raise RuntimeError(f"Missing or unsafe asset: {name}")
        if path.suffix == '.webp':
            data = path.read_bytes()
            if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
                raise RuntimeError(f"Invalid image asset: {name}")
    if destination.exists():
        if destination.is_symlink():
            raise RuntimeError("Refusing to remove a symlinked output directory")
        shutil.rmtree(destination)
    destination.mkdir()
    for name in ASSETS:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, target)
    print(f"Built {len(ASSETS)} allowlisted files in {destination.name}/")

if __name__ == "__main__":
    main()
