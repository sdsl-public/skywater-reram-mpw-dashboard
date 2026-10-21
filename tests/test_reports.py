"""Weekly report index tests: explicit source directory, metadata and safe links."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_builder():
    spec = importlib.util.spec_from_file_location("weekly_report_build", ROOT / "scripts/build.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReportIndexTests(unittest.TestCase):
    def test_index_reads_saved_report_metadata_and_sorts_latest_first(self):
        module = load_builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "reports/weekly/2026-10"
            folder.mkdir(parents=True)
            html = ('<article class="sheet" id="report">'
                    '<span id="author">{author}</span>'
                    '<span id="written-at">{date}</span></article>')
            (folder / "older.html").write_text(html.format(author="김연구", date="2026.10.19 11:00 (KST)"), encoding="utf-8")
            (folder / "newer.html").write_text(html.format(author="박실험", date="2026.10.20 13:30 (KST)"), encoding="utf-8")
            module.ROOT = root
            reports = module.report_items()
            self.assertEqual(len(reports), 2)
            self.assertEqual(reports[0]["title"], "Weekly Report · 박실험")
            self.assertEqual(reports[0]["updated_at"], "2026-10-20T13:30:00+09:00")
            self.assertEqual(reports[0]["url"], module.PUBLIC_SITE+"reports/weekly/2026-10/newer.html")


    def test_report_feed_contains_only_latest_eight(self):
        module = load_builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "reports/weekly/2026-10"
            folder.mkdir(parents=True)
            for day in range(1, 11):
                (folder / f"{day:02d}.html").write_text(
                    '<article id="report">'
                    f'<span id="author">Author {day:02d}</span>'
                    f'<span id="written-at">2026.10.{day:02d} 10:00 (KST)</span>'
                    '</article>',
                    encoding="utf-8"
                )
            module.ROOT = root
            listed = module.report_items()
            self.assertEqual(len(listed), 8)
            self.assertEqual(listed[0]["title"], "Weekly Report · Author 10")
            self.assertEqual(listed[-1]["title"], "Weekly Report · Author 03")

    def test_unapproved_html_files_are_not_indexed_or_published(self):
        module = load_builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "reports/weekly"
            folder.mkdir(parents=True)
            (folder / "random.html").write_text("<html><body>Not a weekly report</body></html>", encoding="utf-8")
            module.ROOT = root
            self.assertEqual(module.report_items(), [])

    def test_report_authors_are_data_not_html_markup(self):
        module = load_builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "reports/weekly"
            folder.mkdir(parents=True)
            (folder / "safe.html").write_text(
                '<article id="report"><span id="author">A &amp; B</span>'
                '<span id="written-at">2026.10.20 14:30 (KST)</span></article>',
                encoding="utf-8"
            )
            module.ROOT = root
            reports = module.report_items()
            self.assertEqual(reports[0]["title"], "Weekly Report · A & B")
            self.assertTrue(reports[0]["url"].startswith(module.PUBLIC_SITE))


    def test_read_only_view_removes_scripts_events_and_editor_controls(self):
        module = load_builder()
        malicious = (
            '<html><head><script>alert("outside")</script></head><body>'
            '<article class="sheet" id="report" onclick="alert(1)">'
            '<header><span id="author" contenteditable="true">Sample</span>'
            '<span id="written-at">2026.10.21 14:12 (KST)</span></header>'
            '<section class="report-section"><h2>Purpose</h2>'
            '<div class="field text" id="purpose" onclick="hack()">'
            'Safe &amp; complete<script>alert("inside")</script> Report</div>'
            '<iframe src="https://untrusted.example"></iframe>'
            '<input type="file"><span>Text after an input element</span>'
            '<img src="https://untrusted.example/p.png" onerror="hack()" alt="unsafe">'
            '<img src="data:image/png;base64,iVBORw0KGgo=" alt="embedded">'
            '</section></article></body></html>'
        )
        parser = module.ReadOnlyArticle()
        parser.feed(malicious)
        fragment = parser.result()
        self.assertIsNotNone(fragment)
        view = module.readonly_page(
            '<!doctype html><html><head><title>Old title</title>',
            fragment, 'Test report'
        )
        self.assertIn('script-src \'none\'', view)
        self.assertIn('Safe &amp; complete Report', view)
        self.assertIn('Text after an input element', view)
        self.assertNotIn('<input', view)
        self.assertIn('data:image/png;base64,iVBORw0KGgo=', view)
        self.assertNotIn('<script', view)
        self.assertNotIn('<iframe', view)
        self.assertNotIn('onclick=', view)
        self.assertNotIn('onerror=', view)
        self.assertNotIn('contenteditable=', view)
        self.assertNotIn('https://untrusted.example', view)


if __name__ == "__main__":
    unittest.main()
