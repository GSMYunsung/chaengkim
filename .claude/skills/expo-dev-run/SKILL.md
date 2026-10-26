---
name: expo-dev-run
description: 챙김 Expo 앱을 연결된 아이폰에서 개발 모드(dev client + Metro 8082)로 실행한다. 네이티브 재빌드가 필요한지 판단해 필요할 때만 `expo run:ios`로 다시 빌드하고, 아니면 Metro만 띄워 설치된 개발 빌드를 이 Mac의 Metro에 연결해 연다. "개발모드로 실행해줘", "폰에 띄워줘", "로컬로 켜줘", "재연결해줘", "개발빌드 해줘", "Metro 켜줘", "No script URL", "흰 화면/연결 끊김" 같은 요청에 사용한다. 스토어 배포나 EAS 클라우드 빌드에는 쓰지 않는다.
---

# 개발 모드로 실행 (expo-dev-run)

목표는 **설치된 개발 빌드가 이 Mac의 Metro(포트 8082)에서 JS를 받아 실행되는 상태**를 만들고, 그 연결을 눈으로 확인하는 것이다.
사용자 응답과 진행 보고는 한국어로 한다.

모든 단계는 `scripts/dev.sh`로 한다. 경로: `.claude/skills/expo-dev-run/scripts/dev.sh` (아래에서는 `dev.sh`).

| 명령 | 하는 일 |
|---|---|
| `dev.sh status` | 기기, Mac IP, Metro, 폰 접속 상태 |
| `dev.sh free` | 8082를 쓰는 Metro 종료 (이 프로젝트 것일 때만) |
| `dev.sh metro` | Metro 실행 (포그라운드 → **백그라운드로 실행**) |
| `dev.sh tunnel` | Metro를 Expo 터널로 실행 (공용 Wi-Fi용, **백그라운드로 실행**) |
| `dev.sh wait` | Metro 준비될 때까지 대기 |
| `dev.sh launch` | 폰에서 앱을 이 Mac의 Metro 주소로 열기 (터널이면 터널 주소를 자동 사용) |
| `dev.sh verify` | 폰이 Metro에 접속했는지 25초간 확인 (터널 모드는 exit 6 → Metro 로그의 `iOS Bundled`로 확인) |
| `dev.sh build` | 네이티브 재빌드 + 설치 + Metro (포그라운드, 수 분 → **백그라운드로 실행**) |

## 1. 상태부터 본다

`dev.sh status`를 실행하고 결과로 다음을 판단한다.

- **device가 비어 있음** → 폰이 연결·페어링되지 않았다. 케이블 연결과 잠금 해제를 요청하고 멈춘다.
- **mac ip가 비어 있음** → Mac이 IPv6 전용 핫스팟 등에 붙어 있다. 폰이 Mac에 접속할 주소가 없으니 "Mac과 폰을 같은 Wi-Fi에 연결해 달라"고 요청한다. 재빌드로는 해결되지 않는다.
- **Metro가 다른 프로젝트 것**(cwd가 이 프로젝트가 아님) → 건드리지 않는다. `PORT=다른번호`를 쓸지 사용자에게 묻는다. 포트 8081은 다른 폴더(`~/프로젝트/chaengkim`)가 쓰고 있어서 이 프로젝트는 8082를 쓴다.
- **Metro가 이미 이 프로젝트로 떠 있고 phone conn이 있음** → 이미 연결돼 있다. 그대로 보고하고 끝낸다.

## 2. 네이티브 재빌드가 필요한지 판단한다

개발 빌드는 한 번 설치하면 JS 수정만으로 계속 쓴다. **재빌드는 아래 중 하나일 때만** 한다.

- 네이티브 코드가 있는 패키지를 추가·삭제했다 (`expo install`/`npm uninstall` 후)
- `app.json`의 `plugins`, `ios.infoPlist`, 권한, 번들 ID 등 네이티브 설정을 바꿨다
- 앱이 폰에 설치돼 있지 않다 (`launch`가 exit 4 / "is not installed")
- `expo-dev-client`가 없는 옛 빌드라 서버 선택 화면이 안 뜬다

그 외(화면, 로직, `.env.local` 변경 등)는 **재빌드하지 않는다**. `.env.local`의 `EXPO_PUBLIC_*` 값을 바꿨다면 Metro만 재시작하면 된다.

## 3-A. 재빌드가 필요 없을 때 (대부분)

1. Metro가 없거나 재시작이 필요하면: `dev.sh free` → `dev.sh metro`를 **백그라운드로 실행** → `dev.sh wait`
2. `dev.sh launch`
3. `dev.sh verify`

## 3-B. 재빌드가 필요할 때

1. `dev.sh free` (Metro가 8082를 잡고 있으면 빌드가 포트를 못 쓴다)
2. `dev.sh build`를 **백그라운드로 실행**하고, 로그에서 `error(s)`, `Build failed`, `CommandError`, `Complete 100%`, `iOS Bundled`를 지켜본다. 이 명령이 Metro도 같이 띄운다.
3. 설치(`Complete 100%`) 후 `dev.sh launch` → `dev.sh verify`

## 3-C. 같은 Wi-Fi인데도 연결이 안 될 때 (터널)

`status`의 mac ip가 **공인 IP**(192.168/10/172.16–31 대역이 아님)이면 학교·카페 같은 공용망이라 기기 간 통신이 막혀 있을 가능성이 크다. 이 경우 로컬 네트워크 권한이나 재빌드로는 해결되지 않는다. USB 링크(169.254.x)도 동작하지 않았다.

1. `dev.sh free` → `dev.sh tunnel`을 **백그라운드로 실행**하고, 로그에 `Waiting on ...on.expo.app`이 뜰 때까지 기다린다. SDK 58은 Expo 자체 터널이라 `@expo/ngrok` 설치가 필요 없다.
2. `dev.sh launch`: 터널 주소를 manifest에서 읽어서 자동으로 연다.
3. Metro 로그에 `iOS Bundled`가 찍히면 연결된 것이다. 리로드는 LAN보다 느리다. 터널을 재시작하면 주소가 바뀔 수 있으니 다시 `launch`한다.

대안: 아이폰 개인용 핫스팟에 Mac을 연결하면 LAN 방식(3-A)으로 쓸 수 있다.

## 4. 확인하고 보고한다

`verify`가 접속 주소를 출력하고 Metro 로그에 `iOS Bundled`가 찍혀야 "연결됨"이라고 보고한다. 보고에는 연결 경로(Mac IP ↔ 폰 IP), Fast Refresh 여부, 재빌드했는지를 넣는다.

## 문제별 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| `launch` exit 3 / device is locked | 폰 잠김 | 잠금 해제 요청 후 다시 `launch` |
| `launch` exit 4 / is not installed | 앱이 지워짐 | 3-B로 재빌드 |
| `verify` exit 5 | 폰이 다른 네트워크이거나 로컬 네트워크 권한 꺼짐 | 같은 Wi-Fi 연결, 설정 → 개인정보 보호 및 보안 → 로컬 네트워크 → 챙김 켜기 요청. 재빌드하지 않는다 |
| 위를 다 해도 exit 5, mac ip가 공인 IP | 공용 Wi-Fi가 기기 간 통신을 차단 | 3-C 터널 모드 |
| `verify` exit 6 | 터널 모드라 lsof로 확인 불가 | Metro 로그의 `iOS Bundled`로 확인 |
| 앱에 "No script URL" | 앱이 Metro를 못 찾음 (네트워크 문제) | `launch`로 주소를 넘겨 다시 열기. 그래도 안 되면 위 네트워크 확인 |
| 수정이 폰에 반영 안 됨 | Metro가 `CI=1`로 떠서 리로드가 꺼짐 | `free` 후 `metro`로 다시 띄우기. **`CI=1`을 절대 붙이지 않는다** |
| `--port and --no-bundler are mutually exclusive` | 두 옵션 동시 사용 | `build`(=`--port`만)를 쓴다 |
| `npm install` ERESOLVE (react-dom peer) | 기존의 선택적 peer 충돌 | `npm install --legacy-peer-deps` |
| Metro 로그에 `iOS Bundled`가 안 찍힘 | 폰이 접속 안 함 | `verify` 결과에 따라 위 표대로 |

## 하지 말 것

- `ios/` 폴더를 직접 고치지 않는다 (CNG로 생성된다).
- 다른 프로젝트의 Metro(8081)를 종료하지 않는다.
- 연결 문제를 재빌드로 풀려고 하지 않는다. 재빌드는 2번 조건일 때만.
- Release 빌드(`--configuration Release`)는 개발 모드가 아니다. 사용자가 Mac 없이 들고 다니는 빌드를 원할 때만 쓴다.
