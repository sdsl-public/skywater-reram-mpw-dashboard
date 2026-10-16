#!/usr/bin/env python3
"""Build only the explicitly allowed static assets; never upload the repository root."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ("index.html", "styles.css", "app.js", "config.js", "data.js", "favicon.svg", ".nojekyll")

def main() -> None:
    destination = ROOT / "_site"
    for name in ASSETS:
        path = ROOT / "site" / name
        if not path.is_file() or path.is_symlink():
            raise RuntimeError(f"Missing or unsafe asset: {name}")
    if destination.exists():
        if destination.is_symlink():
            raise RuntimeError("Refusing to remove a symlinked output directory")
        shutil.rmtree(destination)
    destination.mkdir()
    for name in ASSETS:
        shutil.copy2(ROOT / "site" / name, destination / name)
    print(f"Built {len(ASSETS)} allowlisted files in {destination.name}/")

if __name__ == "__main__":
    main()
