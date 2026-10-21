# Research Project Dashboard — reusable project starter

An independent, read-only research dashboard built on GitHub Issues and GitHub Pages.
Based on the Amplect-inspired SkyWater dashboard UI, with all original project Issues,
Weekly Report submissions, and source-specific labels removed.

## What is included

- 6-phase interactive timeline (full project, 6-month and 3-month zoom)
- Issues-driven tasks with status, assignees, dates, progress, filters and detail panels
- One-line project summary, latest 8 tasks and latest 8 weekly reports
- A4 Weekly Report authoring, local HTML save, read-only Pages viewing
- Safe public-only issue export and sanitized published report HTML
- Responsive desktop/mobile layout, 6 optional timeline illustration icons
- GitHub Actions tests and Pages deployment

## Set up a NEW repository

1. Create an **empty public** repository (without GitHub-generated README or .gitignore).
   Source project operational data should not be copied. Public is required for the
   supported GitHub Free Pages + Issue export workflow.
2. Copy this template branch into it, creating a **new root commit** instead of copying
   the original repository's commit history:

   ```bash
   git clone --branch research-project-template-kit --single-branch https://github.com/sdsl-public/skywater-reram-mpw-dashboard.git new-dashboard
   cd new-dashboard
   git checkout --orphan main
   git add -A
   git commit -m "Initialize research project dashboard"
   git remote set-url origin https://github.com/OWNER/NEW-REPOSITORY.git
   git push -u origin main
   ```

   Replace OWNER/NEW-REPOSITORY with the newly created GitHub repository.
   When published in a separate `research-project-dashboard-template` repository,
   mark that repository **Settings → General → Template repository** and use
   **Use this template → Create a new repository** instead.

3. Edit `site/config.js`: project title, two-line hero title, subtitle, team,
   copyright year, start/end, time zone and six phases. On a standard
   `owner.github.io/repository` URL the repository is detected automatically.
   For a custom domain or local viewing, replace the fallback value
   `YOUR-OWNER/YOUR-PROJECT-REPO` in that same file.
4. If you rename the six phase titles, update the matching dropdown text
   in `.github/ISSUE_TEMPLATE/task.yml` (phase IDs 01 through 06 must stay stable).
5. Create a GitHub Issue label named `dashboard` and enable Issues.
   Submit tasks with **Issues → New issue → 프로젝트 업무**.
   Label `dashboard` explicitly before public display; closed issues use
   Done/Cancelled according to the GitHub closing reason.
6. In **Settings → Pages**, choose Source: **GitHub Actions**.
   Then **Actions → Publish public dashboard → Run workflow** (or push a change).
   Allow GitHub Actions as needed for deployment. Enable Pages on the new public repo.

The published URL is normally:
`https://OWNER.github.io/NEW-REPOSITORY/`.
Set repository variable `DASHBOARD_SITE_URL` for a custom domain (and configure
`site/config.js` repository fallback).

## Weekly Reports

Create a completed HTML report with the dashboard's **리포트 생성** link.
The editor picks up the project title and organization from `site/config.js` and
saves a standalone HTML report. Upload it under `reports/weekly/YYYY-MM/`.
The repo build validates the report and publishes only a script-free, read-only
copy for the dashboard's **최근 리포트 업데이트** area. Deleted reports disappear
after the next successful Pages build; the dashboard refreshes the feed periodically.

## Development and verification

Python 3.11+ and Node.js 20+; third-party Python packages are not required:

```bash
python3 -m unittest discover -s tests -v
node --check site/app.js
node tests/test_report_refresh.js
node tests/test_summary_layout.js
python3 scripts/build.py
python3 -m http.server --directory _site 8000
```

For local report URLs set `GITHUB_REPOSITORY=OWNER/REPOSITORY` when building.

## Security and caveats

**All repository contents, Issues and published reports are public.**
Do not upload restricted research materials, vendor PDKs, license files,
credentials, unreleased results or internal customer information.
The `dashboard` label only controls dashboard visibility — not Issue privacy.
Report HTML is sanitized and run as a read-only page, without its editor scripts.
Published data includes summary metadata and source URLs.
For private reports, use an access-controlled document service instead.

Only the six bundled artwork icon files are distributed; there are no
proprietary fonts or external paid UI code. Their descriptive titles can be
replaced through `site/config.js`.
