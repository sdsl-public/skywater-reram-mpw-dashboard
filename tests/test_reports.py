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
            folder = root / "reports/weekly/2026"
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
            self.assertIn("/blob/main/reports/weekly/2026/newer.html", reports[0]["url"])

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
            self.assertTrue(reports[0]["url"].startswith("https://github.com/sdsl-public/"))


if __name__ == "__main__":
    unittest.main()
