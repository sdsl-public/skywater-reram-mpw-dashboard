# 업무 번호 관리 — SkyWater ReRAM MPW

## 번호 형식과 원본 연결

대시보드의 업무 번호는 `PP-NNN` 형식입니다. `PP`는 연구 단계의 두 자리 번호(01~06, 미분류는 00), `NNN`은 그 단계 안의 세 자리 순번(001~999)입니다.

GitHub의 원래 Issue 번호와 URL은 변경하지 않습니다. 예를 들어 `01-001`은 [Issue #2](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/2)에 연결됩니다. 기존 댓글, 담당자, 일정, 상태, 진행률 및 관련 Issue 링크를 보존합니다.

타임라인, 업무 목록, 칸반, 최근 업무 업데이트와 상세 팝업에는 프로젝트 업무 번호를 표시합니다. 번호로 검색할 수 있으며 기본 업무 정렬은 연구 단계와 업무 번호 순입니다. 최근 업데이트는 기존처럼 최근 수정 시각 순으로 표시합니다.

## 현재 번호표

| 업무 번호 | 업무명 | 원본 GitHub Issue |
|---|---|---|
| 01-001 | ReRAM 칩 관련 자료 수집 | [#2](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/2) |
| 01-002 | ReRAM 칩 스펙 설정 | [#1](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/1) |
| 02-001 | EDA Environment Setup | [#3](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/3) |
| 02-002 | PDK Setup & Validation | [#8](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/8) |
| 02-003 | Device & ReRAM Model Validation | [#9](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/9) |
| 02-004 | RTL Verification & Synthesis Setup | [#10](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/10) |
| 02-005 | Layout & Verification Flow Setup | [#11](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/11) |
| 03-001 | Fullchip RTL Design | [#4](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/4) |
| 03-002 | Peripheral Circuit Design | [#5](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/5) |
| 03-003 | ReRAM Array Design | [#6](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/6) |
| 03-004 | Fullchip Integration | [#7](https://github.com/sdsl-public/skywater-reram-mpw-dashboard/issues/7) |

기존 `EDA 설치` Issue #3을 `02-001 EDA Environment Setup`으로 확장하고 `02-002`~`02-005` 네 업무를 새로 등록했습니다. 기존 #3의 일정은 유지했습니다. 신규 네 업무는 대기 / 진행률 0% / 일정·담당자 미정으로 등록했습니다.

## 새 업무 등록

1. 해당 단계의 열린 업무와 종료된 업무를 모두 확인하고 마지막 사용 번호 다음 순번을 정합니다. 번호는 자동 발급되지 않습니다.
2. 업무 등록 양식의 **연구 단계**와 **업무 번호**를 입력합니다. 예: 단계 `02`, 업무 번호 `02-006`.
3. 제목은 `[TASK] 02-006 업무명` 형식을 권장합니다. 제목과 업무 번호 필드를 모두 사용하면 두 값이 같아야 합니다.
4. 관리자가 공개 내용을 확인한 뒤 `dashboard` 라벨을 붙이면 대시보드에 게시됩니다.

이 번호표 작성 시점의 다음 번호는 `01-003`, `02-006`, `03-005`입니다. 04~06단계의 첫 업무는 각각 `04-001`, `05-001`, `06-001`부터 시작합니다. 등록 전에 실제 Issue 목록을 다시 확인하세요.

## 유지 규칙

- 완료·취소·정렬·일정 변경으로 기존 번호를 바꾸지 않습니다. 종료된 업무 번호도 다시 사용하지 않습니다.
- 번호는 화면의 행 위치나 GitHub Issue 생성 순서에서 매번 계산하지 않고, Issue 제목 또는 본문의 `### 업무 번호`에 저장된 값을 사용합니다.
- 기존 업무는 제목에 번호가 있으면 인식합니다. 새 양식에서는 업무 번호 필드가 필수입니다.
- 중복 번호, 잘못된 형식, 단계와 다른 번호, 제목·본문 번호 불일치는 데이터 추출 검사에서 오류로 처리합니다. 문제를 고치기 전에는 새 배포를 중단하고 기존 공개 페이지를 유지합니다.
- 업무 단계를 옮길 때는 관리자가 대상 단계의 새 번호를 정하고 제목·업무 번호·연구 단계를 함께 갱신합니다. 이전 번호는 변경 이력에 남기고 재사용하지 않습니다.
- 번호가 없는 과거 자료는 호환성을 위해 GitHub Issue 번호로 표시됩니다. 현재 등록된 11개 업무는 모두 새 번호가 지정되어 있습니다.
- 현재 번호 중복 검사는 `dashboard` 라벨이 붙은 공개 대상 Issue를 기준으로 합니다. 관리자 검토 시 미승인 및 삭제된 업무에서 이미 사용한 번호도 재사용하지 않도록 확인하세요.

## 검증

`tests/test_task_codes.py`는 코드 형식·단계 일치, 제목/본문 일치, 중복, 정렬, 기존 번호의 안정성 및 원본 Issue 링크 유지를 검사합니다. 기존 일정·진행률·공개 범위 검증도 유지됩니다.

이 번호 체계는 SkyWater ReRAM MPW 저장소에만 적용했습니다. 다른 프로젝트와 템플릿은 변경하지 않았습니다.
