# SkyWater ReRAM MPW · Project dashboard

공개 읽기 전용 연구 프로젝트 현황판입니다. 업무 편집은 GitHub Issues에서 진행합니다.

- 대시보드: https://sdsl-public.github.io/skywater-reram-mpw-dashboard/
- 디자인 예시: https://sdsl-public.github.io/skywater-reram-mpw-dashboard/?demo=1
- 업무 등록: https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/new?template=task.yml

## 주요 웹사이트 링크 관리

대시보드의 **업무 현황 / 최근 업무 업데이트 / 최근 리포트 업데이트** 아래에
**주요 웹사이트 (QUICK LINKS)**가 표시됩니다. `site/config.js`의 `projectLinks`를
직접 편집하여 링크 이름과 URL, 짧은 설명을 수정하거나 추가·삭제할 수 있습니다.

```javascript
projectLinks: [
  {name: 'Project Repository', url: 'https://github.com/sdsl-public/skywater-reram-mpw-dashboard', description: 'Source code and documentation'},
  {name: 'Research Laboratory', url: 'https://sdsl.cau.ac.kr/', description: 'Semiconductor Device and System Laboratory'},
],
```

`name`과 `url`은 필수이며 `description`은 선택입니다. HTTP(S) 주소만 허용하고 새 탭에서 열립니다.
등록 순서는 화면 표시 순서와 같습니다. 수정 후 GitHub에 커밋하면 자동으로 다시 배포됩니다.
**이곳은 공개 대시보드이므로 비공개 링크나 민감한 정보를 등록하지 마세요.**

## 사용 방법

1. 프로젝트 업무 양식으로 Issue를 작성합니다. 날짜가 미정이면 비워 둡니다.
2. 저장소 관리자가 `dashboard` 라벨을 붙이면 현황판에 표시됩니다. 라벨이 없으면 Issues → Labels에서 생성하세요.
3. 담당자는 Assignees, 일정·상태·진행률은 Issue 본문에서 수정합니다.
4. 완료는 Completed로 닫고, 취소는 Not planned로 닫습니다.
5. Issue 변경 또는 main 업데이트 후 `Publish public dashboard`가 새 스냅샷을 배포합니다. 6시간 간격 및 수동 실행도 지원합니다.

## 프로젝트 기간과 보기

프로젝트 전체 기간은 **2026년 10월 1일 ~ 2027년 9월 30일**입니다. `site/config.js`의 `projectStart`, `projectEnd`에서 관리합니다. 시작일보다 앞선 종료일은 오류로 처리합니다.

기본 타임라인은 전체 12개월을 표시합니다. `전체`는 전체 기간, `월`은 6개월 확대, `주`는 3개월 확대 보기입니다. 이전·다음 이동은 프로젝트 기간 안으로 제한되며, `오늘`은 해당 날짜가 보이도록 이동합니다. 실제 Issue에 입력한 날짜와 진행률은 프로젝트 기간 설정 변경으로 수정하지 않습니다. 예시 일정만 명시된 프로젝트 기간에 맞춰 배치됩니다.

PC 화면에서는 단계 제목 18px, 업무 이름 15~16px, 주요 버튼·날짜 14~16px, 상세 본문 16px로 표시합니다. 글자 크기와 함께 행 높이, 버튼, 행간과 텍스트 대비를 조정했습니다. 모바일은 기존 반응형 구성을 유지하며 일정표 내부에서 가로로 스크롤할 수 있습니다.

## 화면

Amplect의 타임라인 스타일에서 영감을 얻어 독립적으로 구현했습니다. 중앙 정렬의 큰 제목, 가벼운 글꼴, 어두운 바탕, 민트·블루 그라데이션과 가는 구분선을 사용합니다. 영문은 Urbanist, 한글은 Noto Sans KR을 Google Fonts에서 불러오며, 네트워크가 차단되면 시스템 글꼴로 대체합니다. 원본 사이트의 독점 폰트 파일이나 코드를 복제하지 않았습니다.

타임라인·목록·조회용 칸반, 단계 접기/펼치기, 검색, 담당자·상태 필터, 상세 패널과 모바일 보기를 제공합니다. 예시 모드는 실제 데이터와 분리되며 가상 업무를 GitHub에 생성하지 않습니다. 실제 일정과 진행률은 임의로 채우지 않습니다.

## 배포

Settings → Pages → Source를 GitHub Actions로 설정합니다. `.github/workflows/pages.yml`은 검증 후 `site/`의 허용된 8개 파일만 빌드해 배포합니다. 기존 시각 테마는 `theme.css`, 가독성 조정은 `styles.css`에 분리되어 있습니다. GitHub Projects의 별도 날짜·상태 필드는 자동으로 읽지 않습니다.

```sh
python3 -m unittest discover -s tests -v
node --check site/app.js
python3 scripts/build.py
python3 -m http.server --directory site 8000
```

## 공개 정보 주의

이 저장소와 모든 Issue는 공개됩니다. PDK, NDA 자료, 비공개 회로 설계, 토큰, 비밀번호, 미공개 연구 결과는 업로드하지 마세요. `dashboard` 라벨은 현황판 노출만 제어하며 Issue 자체를 비공개로 만들지 않습니다. 토큰은 Actions의 기본 인증으로만 사용하고 웹페이지에는 포함하지 않습니다. SkyWater 공식 웹사이트가 아닌 독립 연구 프로젝트 현황판입니다.
