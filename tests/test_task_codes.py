"""Stable public task IDs; GitHub issue numbers remain internal link identifiers."""
import importlib.util
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('task_code_exporter', ROOT / 'scripts/export_issues.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
REPO = 'sdsl-public/skywater-reram-mpw-dashboard'


def issue(number=1, code='01-001', phase='01', field=None, **changes):
    body = f'### 연구 단계\n\n{phase} · 연구 단계\n\n### 진행 상태\n\nplanned / 대기\n\n### 진행률\n\n10\n'
    if field is not None:
        body += f'\n### 업무 번호\n\n{field}\n'
    value = dict(number=number, title=f'[TASK] {code} Test task' if code else '[TASK] Test task',
                 body=body, state='open', labels=[{'name':'dashboard'}], assignees=[])
    value.update(changes)
    return value


class TaskCodeTests(unittest.TestCase):
    def test_code_is_separate_from_github_identity(self):
        task = exporter.export_issue(issue(number=27), [])
        self.assertEqual((task['task_code'], task['number'], task['id']), ('01-001', 27, 'issue-27'))
        self.assertEqual(task['title'], 'Test task')
        self.assertEqual(task['progress'], 10)
        self.assertIsNone(task['start'])

    def test_form_field_without_title_prefix(self):
        task = exporter.export_issue(issue(code='', field='01-012'), [])
        self.assertEqual(task['task_code'], '01-012')
        self.assertEqual(task['title'], 'Test task')

    def test_bracketed_title_prefix(self):
        task = exporter.export_issue(issue(title='[TASK] [01-002] Test task'), [])
        self.assertEqual((task['task_code'], task['title']), ('01-002', 'Test task'))

    def test_phase_mismatch_and_zero_rejected(self):
        for code in ('02-001', '01-000', '07-001'):
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, 'invalid task code'):
                exporter.export_issue(issue(code=code), [])

    def test_malformed_field_rejected(self):
        for value in ('1-001', '01-1', '01-1000', 'javascript:alert(1)'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                exporter.export_issue(issue(code='', field=value), [])

    def test_conflicting_title_and_field_rejected(self):
        with self.assertRaisesRegex(ValueError, 'differs'):
            exporter.export_issue(issue(field='01-002'), [])

    def test_duplicate_codes_rejected_including_closed_tasks(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate task code'):
            exporter.make_snapshot([issue(number=1), issue(number=2, state='closed')], REPO)

    def test_same_issue_pagination_duplicate_is_not_code_collision(self):
        snapshot = exporter.make_snapshot([issue(), issue()], REPO)
        self.assertEqual(len(snapshot['tasks']), 1)

    def test_sort_by_code_not_issue_number_or_dates(self):
        first = issue(number=2, code='01-001')
        second = issue(number=1, code='01-002')
        snapshot = exporter.make_snapshot([second, first], REPO)
        self.assertEqual([t['number'] for t in snapshot['tasks']], [2, 1])

    def test_removal_does_not_renumber_remaining_tasks(self):
        task = exporter.make_snapshot([issue(number=10, code='02-004', phase='02')], REPO)['tasks'][0]
        self.assertEqual(task['task_code'], '02-004')

    def test_legacy_missing_code_is_safe(self):
        self.assertIsNone(exporter.export_issue(issue(code=''), [])['task_code'])

    def test_unapproved_code_does_not_enter_public_snapshot(self):
        snapshot = exporter.make_snapshot([issue(), issue(number=2, labels=[])], REPO)
        self.assertEqual(len(snapshot['tasks']), 1)

    def test_browser_helpers_and_original_issue_link(self):
        app = (ROOT / 'site/app.js').read_text(encoding='utf-8')
        start = app.index('  const validTaskCode = ')
        end = app.index('  const realTasks = ', start)
        script = "const assert=require('node:assert/strict');\n"
        script += "const statuses={planned:{},done:{},cancelled:{}};const parseDay=x=>x||null;const phaseById=id=>({id});const repositoryUrl='https://github.com/example/repo';\n"
        script += app[start:end]
        script += """
const task=normalizeTask({number:7,phase:'03',task_code:'03-004',title:'Integration'});
assert.equal(taskLabel(task),'03-004');
assert.equal(task.url,'https://github.com/example/repo/issues/7');
assert.equal(task.id,'issue-7');
const cached=normalizeTask({number:2,phase:'01',title:'01-001 Literature'});
assert.equal(cached.task_code,'01-001');assert.equal(cached.title,'Literature');
const rows=[normalizeTask({number:1,phase:'01',task_code:'01-002'}),cached].sort(compareTaskCodes);
assert.deepEqual(rows.map(t=>taskLabel(t)),['01-001','01-002']);
assert.equal(taskCaption(cached),'01-001 · Literature');
assert.equal(normalizeTask({number:9,phase:'01',task_code:'02-003'}).task_code,null);
"""
        result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("${t.task_code||''} ${t.title}", app)
        self.assertIn('data-copy-issue="${task.number}"', app)


if __name__ == '__main__':
    unittest.main()
