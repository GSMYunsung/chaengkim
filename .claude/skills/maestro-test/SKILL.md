---
name: maestro-test
description: 챙김 앱의 주요 화면 흐름(온보딩, 홈, 소지품, 출발/자리 뜰 때/귀가 체크, 기록 캘린더, 설정)을 iOS 시뮬레이터에서 Maestro로 자동 실행하고, 결과를 스크린샷이 담긴 보고서 한 페이지로 만든다. 스토어/TestFlight 빌드(eas build) 전에 반드시 실행한다. "화면 테스트", "E2E 테스트", "Maestro 돌려줘", "빌드 전 테스트", "회귀 테스트", "시나리오 점검" 요청에 사용한다.
---

# 화면 테스트 (maestro-test)

목표는 빌드 전에 사람이 손대지 않고 주요 흐름 13개가 그대로 동작하는지 확인하고, 결과를 **보고서 한 장**으로 보여 주는 것이다.
사용자 응답과 진행 보고는 한국어로 한다.

- 시나리오: `.maestro/flows/00-setup.yaml` ~ `12-settings.yaml` (번호 순서대로, 앞 시나리오의 앱 상태를 이어받는다)
- 실행기: `.claude/skills/maestro-test/scripts/run.sh` → 결과 `maestro-report/<시각>/report.html` (git 제외)
- 보고서 생성기: `scripts/report.py` (run.sh가 자동 호출)

## 준비 (한 번만)

| 항목 | 확인 / 설치 |
|---|---|
| Java 17, Maestro | `brew install openjdk@17 mobile-dev-inc/tap/maestro` (run.sh가 PATH를 맞춘다) |
| 시뮬레이터 개발 빌드 | 네이티브가 바뀌었으면 다시: `npx expo run:ios --device <시뮬레이터 UDID> --no-bundler` |
| Metro (8082) | expo-dev-run 스킬로 띄운다(`dev.sh metro` 또는 `tunnel`). 시뮬레이터는 `localhost:8082`로 붙는다 |

Maestro는 iOS 실기기를 지원하지 않으므로 시뮬레이터(iPhone 17 Pro 기본, `SIM=<UDID>`로 변경)에서 돌린다.

## 실행

```bash
.claude/skills/maestro-test/scripts/run.sh          # 전체 13개, 약 10~12분 → 10분 넘으면 백그라운드로 실행
.claude/skills/maestro-test/scripts/run.sh 07 08    # 일부만(상태 초기화 없음, 디버깅용)
```

run.sh가 하는 일: 시뮬레이터 부팅 → 위치를 서울(성수)로 설정, 위치 "항상" 권한 허용 → 시나리오를 순서대로 하나씩 실행(실패해도 다음으로 진행) → 시나리오별 로그와 스크린샷 저장 → `report.html` 생성.

## 결과 보고

1. `report.html`을 Artifact 도구로 **비공개 페이지로 publish**하고 링크를 준다(같은 파일 경로를 재사용하지 말고 실행마다 새 경로 → 새 링크, 또는 같은 보고서 링크를 원하면 `url`로 갱신).
2. 채팅에는 통과/실패 개수, 실패한 시나리오와 이유 한 줄씩만 쓴다.
3. 실패가 있으면 빌드로 넘어가지 않는다. 원인이 앱인지 시나리오인지 먼저 가린다.

## 실패했을 때 보는 순서

- `maestro-report/<run>/<시나리오>/log.txt`: 어떤 단계가 FAILED인지
- 같은 폴더의 `screenshots/step-*.png`: 실패 순간 화면
- 지금 화면 구조: `maestro --device <UDID> hierarchy` (요소의 실제 라벨 확인)

자주 겪은 원인과 해결:

| 증상 | 원인 | 해결 |
|---|---|---|
| 아무 것도 못 찾음, 빨간 전체 화면 | 개발 빌드의 LogBox 오류 화면 | 앱의 `console.error` 원인을 고친다(예: 시뮬레이터의 일시적 위치 오류는 무시하도록 처리됨) |
| 버튼을 못 찾음 | 아이콘 버튼은 라벨 뒤에 아이콘 문자가 붙음(`지금 출발, `) | 정규식 접두 매칭 `"지금 출발.*"` |
| 탭을 못 누름 | 탭 라벨은 `홈, tab, 1 of 4` 형식 | `"홈, tab.*"` |
| 탭을 눌렀는데 안 바뀜 | 키보드가 탭 바를 가림 | 화면 제목을 누르거나 끌어서 키보드를 닫는다 |
| 알림 창이 늦게 뜸 | 위치 조회 후 Alert | `optional` + `waitForAnimationToEnd`, 필요하면 `extendedWaitUntil` |
| 화면 맨 아래 버튼이 안 눌림 | 반쯤 가려짐 | `scrollUntilVisible` + `centerElement: true`, `retryTapIfNoChange` |
| 시각 입력이 이상함 | 커서가 가운데 | `tapOn` 에 `point: "95%,50%"` 로 끝을 누른다 |
| 뒤로 가기 | `back`은 안드로이드 전용 | `tapOn: { id: "BackButton" }` |

## 시나리오를 고치거나 추가할 때

- 사용자에게 보이는 문구(한국어)로 찾고, 아이콘만 있는 버튼은 접근성 라벨(`accessibilityLabel`)로 찾는다. 앱 쪽에 라벨이 없으면 라벨을 추가한다.
- 화면마다 `takeScreenshot: NN-설명` 을 1~2장 넣는다(보고서에 그대로 실린다).
- 새 파일은 번호 순서에 맞게 넣고, 앞 시나리오가 남긴 상태를 전제로 쓴다.
- 확인할 수 없는 것: 실제 백그라운드 위치 감지와 알림 수신, 프로덕션 빌드에서 테스트 도구가 숨는지, 지도 핀 내용. 이건 폰에서 확인한다.

## 하지 말 것

- 실패를 `optional: true`로 덮어 통과시키기 (진짜 늦게 뜨는 알림 같은 경우만 optional)
- 빌드 직전 실행을 건너뛰기
- 시나리오 실행 중 같은 시뮬레이터로 다른 작업 하기
