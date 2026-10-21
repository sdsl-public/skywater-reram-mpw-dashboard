import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("export_issues", ROOT / "scripts" / "export_issues.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
REPOSITORY = "YOUR-OWNER/YOUR-PROJECT-REPO"
BODY = """### 연구 단계

03 · 회로·어레이 설계

### 업무 유형

task / 일반 업무

### 진행 상태

in-progress / 진행 중

### 시작일

2026-10-16

### 종료일

2026-11-01

### 진행률

_No response_

### 공개 요약

공개 가능한 회로 검토 일정입니다.

### 체크리스트

- [x] 입력 자료 정리
- [ ] 결과 검토

### 내부 메모

Do not export this section or arbitrary body fields.
"""


def issue(**overrides):
    data = {"number": 7, "title": "[TASK] 설계 검토", "body": BODY,
            "labels": [{"name": "dashboard"}], "state": "open", "state_reason": None,
            "assignees": [{"login": "example-member", "email": "not-exported@example.com"}],
            "updated_at": "2026-10-16T00:00:00Z", "comments": 99, "secret": "DO_NOT_EXPORT"}
    data.update(overrides)
    return data


class ExportTests(unittest.TestCase):
    def test_approved_task(self):
        warnings = []
        task = exporter.export_issue(issue(), warnings)
        self.assertEqual(task["phase"], "03")
        self.assertEqual(task["title"], "설계 검토")
        self.assertEqual(task["status"], "in-progress")
        self.assertEqual(task["progress"], 50)
        self.assertEqual(task["progress_source"], "checklist")
        self.assertEqual(task["assignees"], ["example-member"])
        self.assertEqual(warnings, [])

    def test_unapproved_issues_are_omitted(self):
        self.assertIsNone(exporter.export_issue(issue(labels=[]), []))

    def test_pull_requests_are_omitted(self):
        self.assertIsNone(exporter.export_issue(issue(pull_request={}), []))

    def test_completed_issue(self):
        task = exporter.export_issue(issue(state="closed", state_reason="completed"), [])
        self.assertEqual((task["status"], task["progress"]), ("done", 100))

    def test_cancelled_is_not_counted_as_complete(self):
        for reason in ("not_planned", "duplicate"):
            task = exporter.export_issue(issue(state="closed", state_reason=reason), [])
            self.assertEqual((task["status"], task["progress"]), ("cancelled", 0))

    def test_manual_zero_is_respected(self):
        task = exporter.export_issue(issue(body=BODY.replace("_No response_", "0")), [])
        self.assertEqual(task["progress"], 0)
        self.assertEqual(task["progress_source"], "manual")

    def test_open_issue_never_reports_completed(self):
        for value in ("100", "100%", "200"):
            task = exporter.export_issue(issue(body=BODY.replace("_No response_", value)), [])
            self.assertEqual(task["progress"], 99)

    def test_invalid_manual_progress_uses_checklist(self):
        warnings = []
        task = exporter.export_issue(issue(body=BODY.replace("_No response_", "half")), warnings)
        self.assertEqual(task["progress"], 50)
        self.assertEqual(warnings[0]["code"], "invalid_progress")

    def test_invalid_calendar_date_is_unscheduled(self):
        warnings = []
        task = exporter.export_issue(issue(body=BODY.replace("2026-10-16", "2026-02-30")), warnings)
        self.assertIsNone(task["start"])
        self.assertEqual(warnings[0]["code"], "invalid_start")

    def test_reversed_date_range(self):
        warnings = []
        task = exporter.export_issue(issue(body=BODY.replace("2026-11-01", "2026-10-01")), warnings)
        self.assertIsNone(task["start"])
        self.assertIsNone(task["end"])
        self.assertEqual(warnings[0]["code"], "end_before_start")

    def test_unknown_dates_remain_unknown(self):
        body = BODY.replace("2026-10-16", "_No response_").replace("2026-11-01", "")
        task = exporter.export_issue(issue(body=body), [])
        self.assertIsNone(task["start"])
        self.assertIsNone(task["end"])

    def test_milestone_can_have_only_end_date(self):
        body = BODY.replace("task / 일반 업무", "milestone / 마일스톤").replace("2026-10-16", "")
        task = exporter.export_issue(issue(body=body), [])
        self.assertEqual(task["kind"], "milestone")
        self.assertIsNone(task["start"])
        self.assertEqual(task["end"], "2026-11-01")

    def test_status_label_overrides_form(self):
        task = exporter.export_issue(issue(labels=[{"name":"dashboard"},{"name":"status:blocked"}]), [])
        self.assertEqual(task["status"], "blocked")

    def test_unknown_phase_is_not_fabricated(self):
        task = exporter.export_issue(issue(body=BODY.replace("03 · 회로·어레이 설계", "arbitrary")), [])
        self.assertEqual(task["phase"], "00")

    def test_only_allowlisted_fields_are_exported(self):
        task = exporter.export_issue(issue(), [])
        raw = json.dumps(task)
        for forbidden in ("DO_NOT_EXPORT", "not-exported@example.com", "Do not export", '"body"', '"comments"'):
            self.assertNotIn(forbidden, raw)

    def test_embedded_script_payload_is_escaped(self):
        snapshot = exporter.make_snapshot([issue(title='</script><script>alert(1)</script>')], REPOSITORY)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "data.js"
            exporter.write_snapshot(snapshot, output)
            raw = output.read_text()
            self.assertNotIn("</script>", raw)
            self.assertIn("\\u003c/script>", raw)

    def test_duplicate_numbers_are_deduplicated(self):
        snapshot = exporter.make_snapshot([issue(), issue()], REPOSITORY)
        self.assertEqual(len(snapshot["tasks"]), 1)

    def test_public_repository_check(self):
        with patch.object(exporter, "api_get", return_value={"private": True}):
            with self.assertRaisesRegex(RuntimeError, "PUBLIC"):
                exporter.fetch_issues(REPOSITORY, "not-a-real-token")

    def test_pagination_reads_all_results(self):
        first = [issue(number=n) for n in range(1, 101)]
        with patch.object(exporter, "api_get", side_effect=[{"private": False}, first, [issue(number=101)]]) as api:
            result = exporter.fetch_issues(REPOSITORY, "")
            self.assertEqual(len(result), 101)
            self.assertEqual(api.call_count, 3)

    def test_api_failure_does_not_create_a_fake_empty_result(self):
        with patch.object(exporter, "api_get", side_effect=RuntimeError("API unavailable")):
            with self.assertRaises(RuntimeError):
                exporter.fetch_issues(REPOSITORY, "")

    def test_crlf_issue_form(self):
        task = exporter.export_issue(issue(body=BODY.replace("\n", "\r\n")), [])
        self.assertEqual(task["phase"], "03")
        self.assertEqual(task["progress"], 50)

    def test_fixture_is_not_marked_live(self):
        snapshot = exporter.make_snapshot([issue()], REPOSITORY, origin="fixture")
        self.assertEqual(snapshot["source"], "fixture")

    def test_leap_year_validation(self):
        warnings = []
        self.assertEqual(exporter.parse_date("2028-02-29", 1, "start", warnings), "2028-02-29")
        self.assertIsNone(exporter.parse_date("2027-02-29", 1, "start", warnings))

    def test_missing_body_is_safe(self):
        task = exporter.export_issue(issue(body=None), [])
        self.assertEqual(task["phase"], "00")
        self.assertEqual(task["progress"], 0)
        self.assertEqual(task["summary"], "")


if __name__ == "__main__":
    unittest.main()
