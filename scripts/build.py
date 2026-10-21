#!/usr/bin/env python3
"""Build only approved public dashboard assets and a safe weekly-report index."""
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "index.html", "styles.css", "theme.css", "app.js", "config.js", "data.js",
    "favicon.svg", ".nojekyll", "deliverables.js", "deliverables.css",
    "skywater_weekly_report_template.html",
) + tuple(f"assets/timeline-icons/{number:02d}.webp" for number in range(1, 7))
REPORT_DIR = Path("reports/weekly")
REPORT_FEED = "report-data.js"
REPORT_JSON = "report-data.json"
REPOSITORY = "sdsl-public/skywater-reram-mpw-dashboard"
KST = timezone(timedelta(hours=9))


class ReportFields(HTMLParser):
    """Read only the two metadata fields from a saved v41 Weekly Report."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = {"author": "", "written-at": ""}
        self.active = None
        self.depth = 0

    def handle_starttag(self, tag, attrs):
        if self.active:
            self.depth += 1
        else:
            field = dict(attrs).get("id")
            if field in self.values:
                self.active, self.depth = field, 1

    def handle_endtag(self, tag):
        if self.active:
            self.depth -= 1
            if self.depth <= 0:
                self.active, self.depth = None, 0

    def handle_data(self, data):
        if self.active:
            self.values[self.active] += data


def written_timestamp(value):
    match = re.match(r"^\s*(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\s+(\d{1,2}):(\d{2})", value)
    if not match:
        return None
    try:
        return datetime(*map(int, match.groups()), tzinfo=KST).isoformat()
    except ValueError:
        return None


def git_updated_at(relative_path):
    """Last commit touching a report (full history is fetched in Pages workflow)."""
    try:
        done = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", relative_path.as_posix()],
            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, timeout=6, check=False,
        )
        stamp = done.stdout.strip()
        if done.returncode == 0 and stamp:
            return datetime.fromisoformat(stamp.replace("Z", "+00:00")).isoformat()
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return None


def report_items():
    """Index explicitly submitted HTML reports; never publish their source as a Pages asset."""
    folder = ROOT / REPORT_DIR
    if not folder.is_dir() or folder.is_symlink():
        return []
    items = []
    for path in folder.rglob("*.html"):
        if not path.is_file() or any(p.is_symlink() for p in (path, *path.parents)):
            continue
        relative = path.relative_to(ROOT)
        try:
            with path.open("r", encoding="utf-8") as source:
                head = source.read(160_000)
            if 'id="report"' not in head or 'id="author"' not in head or 'id="written-at"' not in head:
                continue
            fields = ReportFields()
            fields.feed(head)
            author = " ".join(fields.values["author"].split())[:80] or "작성자 미기록"
            recorded = written_timestamp(fields.values["written-at"])
            modified = git_updated_at(relative) or recorded
            if not modified:
                continue
            url = f"https://github.com/{REPOSITORY}/blob/main/{quote(relative.as_posix(), safe='/')}"
            items.append({
                "title": f"Weekly Report · {author}",
                "updated_at": modified,
                "url": url,
            })
        except (OSError, UnicodeError, ValueError):
            continue
    items.sort(key=lambda report: (
        datetime.fromisoformat(report["updated_at"]).timestamp(), report["url"]
    ), reverse=True)
    return items[:3]


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
    reports = report_items()
    payload = json.dumps({"reports": reports}, ensure_ascii=True, separators=(",", ":"))
    (destination / REPORT_FEED).write_text(
        "window.DASHBOARD_REPORTS = " + payload + ";\n", encoding="utf-8"
    )
    (destination / REPORT_JSON).write_text(payload + "\n", encoding="utf-8")
    print(f"Built {len(ASSETS)} allowlisted files and two feeds for {len(reports)} weekly reports")


if __name__ == "__main__":
    main()
