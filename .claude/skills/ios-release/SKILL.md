---
name: ios-release
description: 다챙김 iOS 앱을 App Store에 새 버전으로 내보낸다. 버전 번호 결정 → 빌드 전 검사(tsc·lint·Maestro) → 버전 PR 머지 → EAS 프로덕션 빌드 → IPA 기호 검사 → EAS Submit → App Store Connect에서 버전 생성·빌드 연결·새로운 기능 문구·심사 제출까지. "스토어에 올려줘", "배포해줘", "1.x.x 출시", "심사 제출", "새 버전 빌드", "TestFlight에 올려줘" 요청에 사용한다. JS만 바뀐 수정을 OTA로 보내는 일에는 쓰지 않는다(그건 eas update, 메모리 ota-release-flow).
---

# iOS 출시 (ios-release)

사용자 응답과 진행 보고는 한국어로 한다. 각 단계는 앞 단계가 끝난 걸 **확인한 뒤** 넘어간다. 여기 적힌 절차는 1.0.1(빌드 8 크래시 → 9)과 1.0.2(빌드 13, 위젯 익스텐션 추가)를 내보내며 실제로 겪은 것이다.

## 0. 먼저 정할 것: OTA로 되는가?

- JS·에셋만 바뀌었으면 새 바이너리가 필요 없다. `eas update`로 preview 채널에 먼저 보내고 확인 뒤 production으로 republish한다(메모리 `ota-release-flow`).
- 네이티브가 바뀌었으면(패키지 추가·삭제, `app.json` 플러그인·권한·Info.plist, 위젯 등) 이 스킬로 새 버전을 낸다.

## 1. 버전 번호 (브랜치 `chore/bump-version-x.y.z`)

- 마지막 스토어 버전 이후 main에 들어간 것을 보고 정한다(메모리 `version-numbering`).
  - 수정만: 마지막 자리 (1.0.2 → 1.0.3)
  - 새 기능: 가운데 자리 (1.0.x → 1.1.0)
- `app.json`의 `expo.version`만 바꾼다. 빌드 번호는 EAS가 올린다(`appVersionSource: remote`, `autoIncrement`). 손대지 않는다.
- 이미 심사에 올라갔거나 출시된 버전 번호는 다시 쓸 수 없다.
- `runtimeVersion` 정책이 `appVersion`이라 버전을 올리면 OTA runtime도 새로 생긴다.

## 2. 빌드 전 검사

1. **머지 상태 확인**: 이번 출시에 들어갈 PR이 모두 `MERGED`인지 `gh pr view <n> --json state`로 확인한다. 머지 전에 빌드했다가 취소한 적이 있다.
2. `npx tsc --noEmit`, `npx expo lint` (오류 0. 기존 경고는 그대로 둔다)
3. `npx expo-doctor`: "packages out of date"는 고정해 둔 것이라 무시해도 된다. 새로 생긴 경고만 본다.
4. **모듈 버전이 같이 올라가지 않았는지** 확인한다.
   - 이번 출시에서 패키지를 추가했다면 `git diff <지난 출시 커밋> -- package-lock.json`으로 다른 `expo-*` 버전이 따라 올라갔는지 본다.
   - `expo-file-system`은 `58.0.11`로 고정이다(`expo.install.exclude`). 풀지 않는다.
5. **Maestro 전체 실행**: `maestro-test` 스킬로 `.maestro/flows` 전체를 돌린다. 통과해야 넘어간다.
   - 시뮬레이터 앱이 지금 네이티브와 같아야 한다. 네이티브가 바뀌었으면 시뮬레이터용 개발 빌드를 다시 만든다.
     ```bash
     npx expo prebuild -p ios --no-install   # 플러그인이 바뀌었으면 먼저
     xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Debug -sdk iphonesimulator \
       -destination "id=<시뮬레이터 UDID>" -derivedDataPath <scratchpad>/simbuild build
     xcrun simctl install <UDID> <scratchpad>/simbuild/Build/Products/Debug-iphonesimulator/app.app
     ```
   - 보고서를 Artifact로 올리고 링크를 PR에 남긴다.
   - 사용자가 진행을 보고 싶어 하면 `watch.sh`를 **절대 경로를 넣은 `.command` 파일**로 띄운다(아래 함정 참고).
6. 버전 PR을 만들고, 사용자 승인 후 squash 머지 → `git switch main && git pull origin main`.

## 3. EAS 프로덕션 빌드

```bash
npx eas-cli@latest build -p ios --profile production --non-interactive --no-wait
```

- 시작하기 전에 `git status`가 깨끗하고 main이 머지 커밋인지 확인한다.
- **"Credentials are not set up. Run this command again in interactive mode."** 또는 Apple 로그인 질문이 나오는 경우가 있다. 배포 프로필이 만료됐거나, 새 타깃(위젯 익스텐션 등)이 생겼을 때다.
  - Apple ID 비밀번호와 2단계 인증은 사용자만 입력한다. 대신 입력하지 않는다.
  - 아래 내용의 `.command`를 만들어 `open -a Terminal <file>`로 띄우고, 사용자에게 "로그인 Y, 프로필 생성 Y"를 안내한다.
    ```bash
    #!/bin/zsh -l
    export PATH="/opt/homebrew/bin:$PATH"
    cd /Users/choeyunseong/projects/chaengkim || { echo "폴더를 못 찾았어요"; read; exit 1; }
    npx eas-cli@latest build -p ios --profile production
    echo; echo "끝났어요. Enter를 누르면 창이 닫혀요."; read
    ```
  - 한 번 만들어지면 다음부터는 `--non-interactive`로 된다.
  - 시도할 때마다 빌드 번호가 올라간다. 번호가 비어도 문제없다.
- **진행 확인은 한 번씩만** 한다. 긴 폴링 루프를 돌리지 않는다(사용자가 끊은 적 있다). 사용자가 "됐어"라고 하거나 다시 물으면 그때 확인한다.
  ```bash
  npx eas-cli@latest build:list -p ios --limit 2 --non-interactive --json \
    | python3 -c "import json,sys;[print(b['id'],b['status'],b.get('appVersion'),b.get('appBuildVersion')) for b in json.load(sys.stdin)]"
  ```

## 4. IPA 기호 검사 (제출 전 필수)

빌드 8은 실행하자마자 꺼졌다(`dyld: Symbol not found`, ExpoFileSystem 58.0.13이 ExpoModulesCore 58.0.26보다 새것). 제출 전에 IPA를 받아 검사한다.

```bash
url=$(npx eas-cli@latest build:view <BUILD_ID> --json | python3 -c "import json,sys;print(json.load(sys.stdin)['artifacts']['buildUrl'])")
mkdir -p <scratchpad>/ipa && cd <scratchpad>/ipa && curl -sL "$url" -o app.ipa && unzip -qo app.ipa
python3 .claude/skills/ios-release/scripts/check-ipa-symbols.py <scratchpad>/ipa/Payload/app.app
```

- `missing 0`이어야 제출한다.
- 위젯이 있으면 `Payload/app.app/PlugIns/ExpoWidgetsTarget.appex`도 검사 대상에 들어갔는지 출력에서 확인한다.

## 5. 제출 (EAS Submit)

```bash
npx eas-cli@latest submit -p ios --id <BUILD_ID> --profile production --non-interactive --no-wait
```

- ASC API 키가 EAS에 저장돼 있어서 로그인이 필요 없다. 처리 완료(TestFlight에 표시)까지 10~30분 걸린다.
- 사용자에게 TestFlight로 폰에서 확인해 달라고 한다. 특히 앱 실행, 이번 기능, 이전에 문제 됐던 곳을 본다.

## 6. App Store Connect에서 심사 제출 (Playwright)

사용자가 TestFlight 확인을 마쳤다고 하면 진행한다. 로그인은 사용자가 브라우저 창에서 직접 한다.

1. `https://appstoreconnect.apple.com/apps/6827037552/distribution`으로 이동한다. 로그인 화면이면 사용자에게 로그인을 부탁한다.
2. 왼쪽 "iOS 앱" 옆 **[iOS 앱 추가]**(+) → 버전 번호 입력 → [생성]
3. **이 버전에서 업그레이드된 사항**: 지난 버전 문구가 그대로 복사돼 있으니 반드시 바꾼다. 사용자에게 보이는 변화만, 한국어 "~해요" 체, 글머리표 `•`로 쓴다.
4. **빌드** → [빌드 추가] → 새 빌드 선택 → [완료]
5. **App Store 버전 출시**는 기본값 "자동으로 버전 출시", 점진적 출시는 "모든 사용자에게 즉시"다. 사용자가 다르게 원하면 바꾼다.
6. [저장] → 저장이 끝나 [심사에 추가]가 켜질 때까지 기다린다(진행 표시가 사라질 때까지).
7. [심사에 추가] → 오른쪽 "제출 초안" 패널 → **[심사를 위해 제출]**
8. 왼쪽 목록에 "x.y.z 심사 대기 중"이 보이면 끝이다.

- 지금 판매 중인 버전("배포 준비됨")과 새 버전("심사 대기 중")이 함께 보이는 게 정상이다. 승인되고 출시되면 이전 버전은 "버전 정보" 기록으로 옮겨간다.
- 중국 본토 보안 평가와 AIGC 신고 안내는 기존 앱 기준 2027-01-31까지라 제출과 상관없다.

## 7. 마무리

- 메모리 `ota-release-flow`에 "어떤 버전이 심사 중이고 어떤 버전이 판매 중인지"와 다음 스토어 빌드의 최소 버전을 갱신한다.
- 사용자에게 알린다: 제출 결과, 출시 방식, 이후 OTA는 새 runtime(버전)으로 간다는 점.

## 함정 (실제로 겪음)

| 증상 | 원인 | 대응 |
|---|---|---|
| 1.0.1 빌드 8이 실행하자마자 꺼짐 | Expo 모듈이 함께 올라가 prebuilt XCFramework와 ExpoModulesCore 버전이 어긋남 | 4단계 기호 검사. 원인 모듈 버전을 고정 |
| 로컬 dev 빌드 링크 오류 `RCTReconnectingWebSocket` | Release 빌드를 중간에 멈춰 `ios/Pods/React-Core-prebuilt`에 Release 코어가 남음(표시는 Debug) | `ios/Pods/ReactNativeCore-artifacts`의 debug tar를 그 폴더에 다시 풀기 |
| 로컬 빌드에 위젯이 빠짐 | 기존 `ios/`에 새 플러그인이 반영 안 됨 | `npx expo prebuild -p ios --no-install` |
| 로컬 빌드 "PLA Update available" | Apple 개발자 약관 갱신 미동의 | 사용자가 developer.apple.com에서 동의 |
| 로컬 빌드 "No profiles for ...ExpoWidgetsTarget" | 새 타깃 개발 프로필 없음 | `xcodebuild ... -allowProvisioningUpdates` 한 번 |
| EAS "Credentials are not set up" | 새 타깃·만료 프로필은 대화형에서만 생성 | 3단계 `.command`로 사용자가 로그인 |
| Terminal 창이 "[프로세스 완료됨]"만 보이거나 "no run in maestro-report/" | `.command`가 로그인 셸이 아니어서 `node`·`npx`를 못 찾거나, 다른 폴더에서 시작됨 | `#!/bin/zsh -l`, PATH 지정, `cd` 실패 시 멈춤, 끝에 `read` |
| Maestro 01이 "지갑"을 못 찾음 | 버튼에 `accessibilityLabel="지갑 수정"`을 붙이면 안의 글자가 따로 읽히지 않음 | 라벨은 보이는 이름, 설명은 `accessibilityHint` |

## 하지 말 것

- 머지 확인 없이 빌드하기
- Maestro 실패를 두고 빌드로 넘어가기
- IPA 검사 없이 제출하기
- Apple 계정 비밀번호·인증 코드를 대신 입력하기
- 사용자 TestFlight 확인 전에 심사 제출하기(사용자가 먼저 확인했다고 하면 진행)
- "업그레이드된 사항"을 지난 버전 문구 그대로 두기
- 긴 폴링 루프로 빌드를 기다리기
