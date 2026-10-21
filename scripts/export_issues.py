#!/usr/bin/env python3
"""Export an allowlisted, read-only snapshot of approved public GitHub Issues.

Only the Python standard library is required. A failed API request fails the build;
it never replaces a working deployment with a misleading empty snapshot.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

APPROVAL_LABEL = "dashboard"
PHASES = {"00", "01", "02", "03", "04", "05", "06"}
OPEN_STATUSES = {"planned", "in-progress", "review", "blocked"}
REPO_PATTERN = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")
API_ROOT = "https://api.github.com"


def sections(body: str) -> dict[str, str]:
    """Read GitHub Issue Form headings without executing Markdown or HTML."""
    result = {}
    for match in re.finditer(r"^###\s+([^\r\n]+)\r?\n(.*?)(?=^###\s+|\Z)", body, re.M | re.S):
        value = match.group(2).strip()
        result[match.group(1).strip()] = "" if value in {"_No response_", "No response", "_응답 없음_"} else value
    return result


def parse_date(value: str, number: int, field: str, warnings: list[dict]) -> str | None:
    value = value.strip()
    if not value:
        return None
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Expected YYYY-MM-DD")
        parsed = dt.date.fromisoformat(value)
        if not 2000 <= parsed.year <= 2100:
            raise ValueError("Year outside supported range")
        return parsed.isoformat()
    except ValueError:
        warnings.append({"issue": number, "code": f"invalid_{field}"})
        return None


def export_issue(issue: dict, warnings: list[dict]) -> dict | None:
    """Return a compact task. All unlisted fields, comments and attachments are dropped."""
    if "pull_request" in issue:
        return None
    labels = {str(label.get("name", "") if isinstance(label, dict) else label) for label in issue.get("labels", [])}
    if APPROVAL_LABEL not in labels:
        return None
    number = issue.get("number")
    if not isinstance(number, int) or isinstance(number, bool) or number < 1:
        raise ValueError("GitHub returned an invalid issue number")
    values = sections(str(issue.get("body") or ""))
    phase = values.get("연구 단계", "")[:2]
    if phase not in PHASES:
        phase = "00"
    if issue.get("state") == "closed":
        status = "cancelled" if issue.get("state_reason") in {"not_planned", "duplicate"} else "done"
    else:
        match = re.match(r"(planned|in-progress|review|blocked)\b", values.get("진행 상태", ""))
        status = match.group(1) if match else "planned"
        for candidate in ("blocked", "review", "in-progress", "planned"):
            if f"status:{candidate}" in labels:
                status = candidate
                break
    start = parse_date(values.get("시작일", ""), number, "start", warnings)
    end = parse_date(values.get("종료일", ""), number, "end", warnings)
    if start and end and end < start:
        warnings.append({"issue": number, "code": "end_before_start"})
        start = end = None
    checklist = [{"done": m.group(1).lower() == "x", "text": m.group(2).strip()[:300]}
                 for m in re.finditer(r"^\s*[-*]\s+\[([ xX])\]\s+(.+)$", values.get("체크리스트", ""), re.M)][:100]
    raw_progress = values.get("진행률", "").strip()
    progress_source = "manual"
    if raw_progress and re.fullmatch(r"\d{1,3}\s*%?", raw_progress):
        progress = min(100, int(raw_progress.rstrip("% ")))
    else:
        if raw_progress:
            warnings.append({"issue": number, "code": "invalid_progress"})
        progress_source = "checklist"
        progress = round(100 * sum(item["done"] for item in checklist) / len(checklist)) if checklist else 0
    if status == "done":
        progress = 100
        progress_source = "issue-completed"
    elif status == "cancelled":
        progress = 0
        progress_source = "cancelled"
    else:
        progress = min(progress, 99)
    assignees = [str(person["login"])[:100] for person in issue.get("assignees", []) if person.get("login")][:20]
    return {
        "id": f"issue-{number}", "number": number,
        "title": re.sub(r"^\[TASK\]\s*", "", str(issue.get("title") or "제목 없음"), flags=re.I)[:300],
        "phase": phase, "status": status,
        "kind": "milestone" if values.get("업무 유형", "").startswith("milestone") else "task",
        "start": start, "end": end, "progress": progress, "progress_source": progress_source,
        "assignees": assignees, "summary": values.get("공개 요약", "")[:1600],
        "checklist": checklist, "updated_at": issue.get("updated_at"),
    }


def api_get(path: str, token: str) -> object:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Research-Public-Dashboard"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    for attempt in range(3):
        try:
            request = urllib.request.Request(API_ROOT + path, headers=headers)
            with urllib.request.urlopen(request, timeout=35) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in {500, 502, 503, 504} and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"GitHub API HTTP {error.code}; snapshot was not published.") from None
        except urllib.error.URLError:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError("GitHub API connection failed; snapshot was not published.") from None
    raise RuntimeError("GitHub API retry limit reached")


def fetch_issues(repository: str, token: str) -> list[dict]:
    repo = api_get(f"/repos/{repository}", token)
    if not isinstance(repo, dict) or repo.get("private") is not False:
        raise RuntimeError("Refusing to export: this dashboard is configured for a PUBLIC source repository only.")
    results: list[dict] = []
    for page in range(1, 101):
        query = urllib.parse.urlencode({"state": "all", "labels": APPROVAL_LABEL, "per_page": 100, "page": page, "sort": "created", "direction": "asc"})
        payload = api_get(f"/repos/{repository}/issues?{query}", token)
        if not isinstance(payload, list):
            raise RuntimeError("Unexpected GitHub Issues API response")
        results.extend(payload)
        if len(payload) < 100:
            return results
    raise RuntimeError("More than 10,000 matching Issues; refusing to silently truncate the snapshot.")


def make_snapshot(issues: list[dict], repository: str, *, origin: str = "github-issues") -> dict:
    warnings: list[dict] = []
    by_number = {}
    for issue in issues:
        task = export_issue(issue, warnings)
        if task is not None:
            by_number[task["number"]] = task
    tasks = sorted(by_number.values(), key=lambda t: (t["phase"], t["start"] or "9999-12-31", t["number"]))
    return {"schema_version": 1, "repository": repository,
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "source": origin, "tasks": tasks, "warnings": warnings}


def write_snapshot(snapshot: dict, output: Path) -> None:
    payload = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text("// Generated public snapshot; do not edit by hand.\nwindow.DASHBOARD_DATA = " + payload + ";\n", encoding="utf-8")
    temporary.replace(output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", "YOUR-OWNER/YOUR-PROJECT-REPO"))
    parser.add_argument("--output", type=Path, default=Path("site/data.js"))
    parser.add_argument("--fixture", type=Path, help="Offline fixture, for tests only; never use for a production deployment")
    args = parser.parse_args()
    if not REPO_PATTERN.fullmatch(args.repository):
        parser.error("--repository must be owner/repository")
    if args.fixture:
        issues = json.loads(args.fixture.read_text(encoding="utf-8"))
    else:
        issues = fetch_issues(args.repository, os.environ.get("GITHUB_TOKEN", ""))
    if not isinstance(issues, list):
        raise ValueError("Expected a JSON array of Issues")
    snapshot = make_snapshot(issues, args.repository, origin="fixture" if args.fixture else "github-issues")
    write_snapshot(snapshot, args.output)
    print(f"Public snapshot: {len(snapshot['tasks'])} task(s), {len(snapshot['warnings'])} validation warning(s).")
    for warning in snapshot["warnings"]:
        print(f"::warning::Issue #{warning['issue']}: {warning['code']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
