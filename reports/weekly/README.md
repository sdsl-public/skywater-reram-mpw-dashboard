# Weekly Report 제출 안내

SkyWater ReRAM MPW 대시보드의 **리포트 생성** 버튼을 눌러 Weekly Report를 작성한 다음, **HTML 저장**으로 내려받은 파일을 이 폴더에 업로드합니다.

## 제출 절차

1. [리포트 작성 양식](https://sdsl-public.github.io/skywater-reram-mpw-dashboard/skywater_weekly_report_template.html)에서 필수 항목을 작성합니다.
2. HTML 저장 버튼으로 파일을 내려받습니다.
3. `reports/weekly/YYYY-MM/` 형식의 월별 폴더(예: `reports/weekly/2026-10/`)에 **작성 완료 HTML 파일**을 업로드합니다. 연도와 월이 한눈에 보이고 폴더가 시간순으로 정렬됩니다.

> **폴더 유지:** Git은 빈 폴더를 저장하지 않습니다. 월별 폴더가 비어 있어도 유지하려면 `.gitkeep` 파일을 남겨두세요. 샘플 HTML을 삭제해도 `.gitkeep`은 삭제하지 않습니다.
4. GitHub의 변경 사항을 `main`에 반영하면 다음 Pages 배포에서 대시보드의 **최근 리포트 업데이트** 목록이 자동 갱신됩니다. 최근 변경된 8개 보고서가 표시되며, 항목을 누르면 **GitHub Pages의 읽기 전용 HTML 보고서**가 새 탭에서 열립니다.

**공개 주의:** 이 저장소와 최근 업데이트 목록은 모두 공개됩니다. PDK 원본, 접근 자격정보, 비공개 회로도, 미공개 연구결과 등 민감한 자료를 업로드하지 마세요. 대시보드는 보고서 원본에 포함된 JavaScript·편집 도구·이벤트 핸들러를 제거한 **읽기 전용 사본**만 GitHub Pages에 게시합니다. 원본 HTML은 GitHub 저장소에 보관되며, 양쪽 모두 공개된다는 점에 유의하세요.
