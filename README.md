# SkyWater ReRAM MPW · Project dashboard

공개 읽기 전용 연구 프로젝트 현황판입니다. 업무 편집은 GitHub Issues에서 진행합니다.

- 대시보드: https://sdsl-public.github.io/skywater-reram-mpw-dashboard/
- 디자인 예시: https://sdsl-public.github.io/skywater-reram-mpw-dashboard/?demo=1
- 업무 등록: https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/new?template=task.yml

## 사용 방법

1. 프로젝트 업무 양식으로 Issue를 작성합니다. 날짜가 미정이면 비워 둡니다.
2. 저장소 관리자가 `dashboard` 라벨을 붙이면 현황판에 표시됩니다. 라벨이 없으면 Issues → Labels에서 생성하세요.
3. 담당자는 Assignees, 일정·상태·진행률은 Issue 본문에서 수정합니다.
4. 완료는 Completed로 닫고, 취소는 Not planned로 닫습니다.
5. Issue 변경 또는 main 업데이트 후 `Publish public dashboard`가 새 스냅샷을 배포합니다. 6시간 간격 및 수동 실행도 지원합니다.

## 화면

Amplect의 타임라인 스타일에서 영감을 얻어 독립적으로 구현했습니다. 중앙 정렬의 큰 제목, 가벼운 글꼴, 어두운 바탕, 민트·블루 그라데이션과 가는 구분선을 사용합니다. 영문은 Urbanist, 한글은 Noto Sans KR을 Google Fonts에서 불러오며, 네트워크가 차단되면 시스템 글꼴로 대체합니다. 원본 사이트의 독점 폰트 파일이나 코드를 복제하지 않았습니다.

타임라인·목록·조회용 칸반, 단계 접기/펼치기, 검색, 담당자·상태 필터, 상세 패널과 모바일 보기를 제공합니다. 예시 모드는 실제 데이터와 분리되며 가상 업무를 GitHub에 생성하지 않습니다. 실제 일정과 진행률은 임의로 채우지 않습니다.

## 배포

Settings → Pages → Source를 GitHub Actions로 설정합니다. `.github/workflows/pages.yml`은 검증 후 `site/`의 허용된 7개 파일만 빌드해 배포합니다. GitHub Projects의 별도 날짜·상태 필드는 자동으로 읽지 않습니다.

```sh
python3 -m unittest discover -s tests -v
node --check site/app.js
python3 scripts/build.py
python3 -m http.server --directory site 8000
```

## 공개 정보 주의

이 저장소와 모든 Issue는 공개됩니다. PDK, NDA 자료, 비공개 회로 설계, 토큰, 비밀번호, 미공개 연구 결과는 업로드하지 마세요. `dashboard` 라벨은 현황판 노출만 제어하며 Issue 자체를 비공개로 만들지 않습니다. 토큰은 Actions의 기본 인증으로만 사용하고 웹페이지에는 포함하지 않습니다. SkyWater 공식 웹사이트가 아닌 독립 연구 프로젝트 현황판입니다.
