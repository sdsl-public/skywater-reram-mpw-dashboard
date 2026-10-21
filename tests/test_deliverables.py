"""Regression checks for approved deliverable artwork and safe public builds."""
import hashlib
import json
import importlib.util
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HASHES = {
    '01': 'be05748a6f7b1dbbcf585fc7c63a32642c5ab7bbc6ec22b217f721f8e938aa02',
    '02': '571986d0020285cc2deef0d140031213be88c968c2e738c06dd244786fdafded',
    '03': '55c7b096c6afc7901bd23727393cac093185b5df9250ff86e71b4e020500a85a',
    '04': 'e1dc2d00eaad66302d0d580fd8215649dcd03c59adbb87fecf073e6a9b885b5e',
    '05': 'af1c90fcf5e737a1e5ae5cbc700fa97b2c9c1e50abd1301ae238a691ec63043d',
    '06': 'a91f9e9e4ee82afa7ecf2fc02b61c8d916324fc30f93961b0524bc70bc4380de',
}

def builder():
    spec = importlib.util.spec_from_file_location('build_icons', ROOT / 'scripts/build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

class DeliverableTests(unittest.TestCase):
    def test_six_approved_images_and_size_budget(self):
        total = 0
        for phase, expected in HASHES.items():
            data = (ROOT / f'site/assets/timeline-icons/{phase}.webp').read_bytes()
            self.assertEqual(data[:4], b'RIFF')
            self.assertEqual(data[8:12], b'WEBP')
            self.assertEqual(hashlib.sha256(data).hexdigest(), expected)
            total += len(data)
        self.assertLess(total, 20000)

    def test_script_order_and_css_link(self):
        html = (ROOT / 'site/index.html').read_text()
        self.assertEqual(html.count('src="./deliverables.js?v=1"'), 1)
        self.assertIn('href="./deliverables.css?v=1"', html)
        self.assertLess(html.index('src="./app.js?v=summary-compact-rows-1"'), html.index('src="./deliverables.js?v=1"'))
        self.assertIn('class="section-top timeline-header"', html)
        self.assertNotIn('id="demo-toggle"', html)
        self.assertIn('id="new-report"', html)
        self.assertIn('href="./weekly_report_template.html"', html)
        self.assertIn('id="recent-reports"', html)
        self.assertIn('id="summary-title"', html)
        self.assertIn('class="updates-panel summary-panel"', html)
        self.assertNotIn('<section class="metrics"', html)
        self.assertLess(html.index('id="metrics"'), html.index('id="recent-updates"'))
        self.assertLess(html.index('id="recent-updates"'), html.index('id="recent-reports"'))
        styles = (ROOT / 'site/styles.css').read_text()
        self.assertIn('.lower-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}', styles)
        self.assertNotIn('src="./report-data.js', html)
        self.assertIn("let reportSource = {reports: []}", (ROOT / 'site/app.js').read_text())
        self.assertIn('report-data.json?refresh=', (ROOT / 'site/app.js').read_text())
        self.assertIn("window.setInterval(", (ROOT / 'site/app.js').read_text())
        self.assertIn("document.addEventListener('visibilitychange'", (ROOT / 'site/app.js').read_text())

    def test_module_syntax_and_read_only_behavior(self):
        path = ROOT / 'site/deliverables.js'
        result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        text = path.read_text()
        self.assertNotIn('fetch(', text)
        self.assertNotIn('localStorage', text)
        self.assertIn('{childList: true}', text)
        self.assertNotIn('subtree: true', text)

    def test_build_copies_only_allowlisted_files(self):
        module = builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'site', root / 'site')
            (root / 'site/never-publish.txt').write_text('not a public asset')
            module.ROOT = root
            module.main()
            result = {str(p.relative_to(root / '_site')) for p in (root / '_site').rglob('*') if p.is_file()}
            self.assertEqual(result, set(module.ASSETS) | {module.REPORT_FEED, module.REPORT_JSON})
            self.assertEqual(len(result), 19)
            self.assertIn('weekly_report_template.html', result)
            self.assertIn('report-data.js', result)
            self.assertIn('window.DASHBOARD_REPORTS = ', (root / '_site/report-data.js').read_text())
            self.assertEqual(json.loads((root / '_site/report-data.json').read_text()), {"reports":[]})
            self.assertNotIn('never-publish.txt', result)

    def test_build_refuses_missing_icon(self):
        module = builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'site', root / 'site')
            (root / 'site/assets/timeline-icons/06.webp').unlink()
            module.ROOT = root
            with self.assertRaisesRegex(RuntimeError, 'Missing or unsafe asset'):
                module.main()

    def test_build_refuses_symlinked_icon_directory(self):
        module = builder()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'site', root / 'site')
            icons = root / 'site/assets/timeline-icons'
            icons.rename(root / 'outside-icons')
            icons.symlink_to(root / 'outside-icons', target_is_directory=True)
            module.ROOT = root
            with self.assertRaisesRegex(RuntimeError, 'Missing or unsafe asset'):
                module.main()

if __name__ == '__main__':
    unittest.main()
