#!/usr/bin/env python3
"""Build only approved public dashboard assets and a safe weekly-report index."""
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
import os
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
    "weekly_report_template.html",
) + tuple(f"assets/timeline-icons/{number:02d}.webp" for number in range(1, 7))
REPORT_DIR = Path("reports/weekly")
REPORT_FEED = "report-data.js"
REPORT_JSON = "report-data.json"
# The workflow supplies GITHUB_REPOSITORY for every template-generated repository.
# DASHBOARD_SITE_URL may optionally override the default Pages project URL.
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "YOUR-OWNER/YOUR-PROJECT-REPO")
if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", REPOSITORY):
    raise RuntimeError("GITHUB_REPOSITORY must be in owner/repository format")
_owner, _name = REPOSITORY.split("/", 1)
_site_path = "" if _name.lower() == f"{_owner}.github.io".lower() else f"{_name}/"
PUBLIC_SITE = (os.environ.get("DASHBOARD_SITE_URL") or f"https://{_owner}.github.io/{_site_path}").rstrip("/") + "/"
MAX_REPORT_BYTES = 8_000_000
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



class ReadOnlyArticle(HTMLParser):
    """Conservatively render saved report content; discard all executable markup.

    Only the trusted template's CSS is reused. User HTML contributes text,
    known layout elements, and small embedded PNG/JPEG/WebP images.
    """
    TAGS = frozenset({
        "article", "header", "section", "h2", "p", "span", "div",
        "strong", "small", "b", "i", "em", "u", "sup", "sub",
        "footer", "ol", "ul", "li", "figure", "img", "figcaption",
        "br", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    })
    VOID = frozenset({"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"})
    IDS = frozenset({
        "report", "author", "written-at", "purpose", "results", "conclusion",
        "report-figure", "report-image", "figure-caption", "references",
        "references-block", "purpose-heading", "results-heading",
        "conclusion-heading",
    })

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.stack = []
        self.skipped = []
        self.active = False
        self.complete = False

    def handle_starttag(self, tag, attrs):
        if self.complete:
            return
        values = dict(attrs)
        if not self.active:
            if tag == "article" and values.get("id") == "report":
                self.active = True
                self.stack.append("article")
                self.output.append('<article class="sheet" id="report">')
            return
        if self.skipped:
            if tag not in self.VOID:
                self.skipped.append(tag)
            return
        if tag not in self.TAGS or tag == "article":
            if tag not in self.VOID:
                self.skipped.append(tag)
            return
        safe_attrs = []
        element_id = values.get("id", "")
        if element_id in self.IDS:
            safe_attrs.append(('id', element_id))
        classes = values.get("class", "")
        if isinstance(classes, str) and re.fullmatch(r"[a-zA-Z0-9_ \t-]{1,180}", classes):
            safe_attrs.append(('class', classes))
        if values.get("data-empty") in ("true", "false"):
            safe_attrs.append(('data-empty', values["data-empty"]))
        if tag == "figure" and "hidden" in values:
            safe_attrs.append(('hidden', None))
        if tag == "img":
            source = values.get("src", "")
            if (isinstance(source, str) and len(source) <= MAX_REPORT_BYTES and
                re.fullmatch(r"data:image/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+", source)):
                safe_attrs.append(('src', source))
            alt = values.get("alt", "")
            if isinstance(alt, str):
                safe_attrs.append(('alt', alt[:300]))
        serialized = "".join(
            f" {name}" if value is None
            else f' {name}="{html_escape(value, quote=True)}"'
            for name, value in safe_attrs
        )
        self.output.append(f"<{tag}{serialized}>")
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if not self.active:
            return
        if self.skipped:
            if tag in self.skipped:
                while self.skipped:
                    closed = self.skipped.pop()
                    if closed == tag:
                        break
            return
        if tag in self.stack:
            while self.stack:
                closed = self.stack.pop()
                self.output.append(f"</{closed}>")
                if closed == tag:
                    break
            if tag == "article":
                self.active = False
                self.complete = True

    def handle_data(self, data):
        if self.active and not self.skipped:
            self.output.append(html_escape(data, quote=False))

    def result(self):
        return "".join(self.output) if self.complete else None


def readonly_page(template_head, article_html, title):
    """Build a standalone, script-free report using only trusted template CSS."""
    assert template_head.startswith("<!doctype html>")
    safe_title = html_escape(title, quote=True)
    header = re.sub(
        r"<title>[^<]*</title>", f"<title>{safe_title}</title>",
        template_head, count=1
    )
    policy = (
        "default-src 'none'; script-src 'none'; object-src 'none'; "
        "style-src 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; img-src data:; "
        "connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"
    )
    return (
        header +
        '\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">\n' +
        '<style id="readonly-report">'
        'body{padding-top:16px}'
        '@media print{body{padding-top:0!important}}'
        '.screen-only,.media-tools,.mini-time{display:none!important}'
        '.field:hover{background-color:transparent!important}'
        '.field[data-empty="true"]::before{content:none!important}'
        '</style>\n</head><body>\n' +
        article_html +
        '\n</body></html>\n'
    )


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


def collect_reports():
    """Collect valid reports and safe HTML fragments, newest first."""
    folder = ROOT / REPORT_DIR
    if not folder.is_dir() or folder.is_symlink():
        return []
    items = []
    for path in folder.rglob("*.html"):
        if not path.is_file() or any(p.is_symlink() for p in (path, *path.parents)):
            continue
        if path.stat().st_size > MAX_REPORT_BYTES:
            continue
        relative = path.relative_to(ROOT)
        try:
            content = path.read_text(encoding="utf-8")
            if ('id="report"' not in content or 'id="author"' not in content
                or 'id="written-at"' not in content):
                continue
            parser = ReadOnlyArticle()
            parser.feed(content)
            body = parser.result()
            if not body:
                continue
            fields = ReportFields()
            fields.feed(content)
            author = " ".join(fields.values["author"].split())[:80] or "작성자 미기록"
            recorded = written_timestamp(fields.values["written-at"])
            modified = git_updated_at(relative) or recorded
            if not modified:
                continue
            # The Pages URL shows the rendered report; GitHub source stays separate.
            url = PUBLIC_SITE + quote(relative.as_posix(), safe="/")
            items.append({
                "title": f"Weekly Report · {author}",
                "updated_at": modified,
                "url": url,
                "_relative": relative,
                "_body": body,
            })
        except (OSError, UnicodeError, ValueError):
            continue
    items.sort(key=lambda report: (
        datetime.fromisoformat(report["updated_at"]).timestamp(), report["url"]
    ), reverse=True)
    return items


def report_items():
    """Public-facing index contains metadata only, limited to eight reports."""
    return [
        {key: item[key] for key in ("title", "updated_at", "url")}
        for item in collect_reports()[:8]
    ]

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
    collected = collect_reports()
    template_head = (source / "weekly_report_template.html").read_text(
        encoding="utf-8"
    ).split("</head>", 1)[0]
    for item in collected:
        target = destination / item["_relative"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            readonly_page(template_head, item["_body"], item["title"]),
            encoding="utf-8"
        )
    reports = [
        {key: item[key] for key in ("title", "updated_at", "url")}
        for item in collected[:8]
    ]
    payload = json.dumps({"reports": reports}, ensure_ascii=True, separators=(",", ":"))
    (destination / REPORT_FEED).write_text(
        "window.DASHBOARD_REPORTS = " + payload + ";\n", encoding="utf-8"
    )
    (destination / REPORT_JSON).write_text(payload + "\n", encoding="utf-8")
    print(f"Built {len(ASSETS)} allowlisted files and two feeds for {len(collected)} read-only weekly reports")


if __name__ == "__main__":
    main()
