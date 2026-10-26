<img src="docs/readme/header.jpg" alt="Dachaengkim. 나가기 전에 한 번 더 챙김" width="100%">

<div align="center">

### 잊기 쉬운 순간에, 한 번 더 챙김.

출발할 때, 자리를 떠날 때, 집에 돌아왔을 때.<br>
물건을 두고 오기 쉬운 순간에만 짧게 확인하는 소지품 앱입니다.

![iOS](https://img.shields.io/badge/iOS-TestFlight-6A81FD?logo=apple&logoColor=white)
![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black)

</div>

<br>

<img src="docs/readme/screens-store.jpg" alt="홈, 출발 체크, 외출 중, 귀가 완료, 설정 화면" width="100%">

---

## 이런 적 있나요?

카페에서 일어나 한참 걷다가 "아, 이어폰." 학원을 나서고 나서야 떠오르는 충전기.
물건을 잃어버리는 건 대부분 **자리를 뜨는 그 순간**입니다.

챙김은 하루 종일 알림을 보내지 않습니다. 놓치기 쉬운 세 번의 순간에만 가방이 먼저 물어봐요.

<br>

## 세 번의 순간

<table>
  <tr>
    <td width="120" align="center"><img src="assets/bag/bag-packing.png" alt="" width="96"></td>
    <td>
      <h3>1. 출발할 때</h3>
      정해 둔 요일과 시각에 출발 알림이 와요.<br>
      늘 챙기는 물건은 미리 담겨 있고, 오늘 더 가져갈 물건만 골라 가방에 담으면 끝.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="assets/bag/bag-alert.png" alt="" width="96"></td>
    <td>
      <h3>2. 자리를 떠날 때</h3>
      카페, 학원, 도서관처럼 한동안 머문 곳을 떠나는 순간 <b>"두고 가는 물건은 없나요?"</b><br>
      알림에서 바로 <b>✅ 모두 챙김</b>을 누르거나, 앱에서 물건을 하나씩 확인해요.<br>
      얼마나 머문 뒤 알릴지는 10·15·30·60분 중에서 고를 수 있어요. 집은 자동으로 빠져요.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="assets/bag/bag-happy.png" alt="" width="96"></td>
    <td>
      <h3>3. 집에 돌아왔을 때</h3>
      집에 도착하면 마지막으로 모두 함께 왔는지 확인해요.<br>
      빠뜨린 물건이 있으면 돌아가서 챙긴 뒤 기록으로 남길 수 있어요.
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/readme/screen-check.png" alt="자리 뜰 때 확인" width="200">
  <img src="docs/readme/screen-calendar.png" alt="기록 캘린더" width="200">
  <img src="docs/readme/screen-map.jpg" alt="하루 동선 지도" width="200">
</p>

<br>

## 그리고 기록

<table>
  <tr>
    <td width="120" align="center"><img src="assets/bag/bag-walk.png" alt="" width="96"></td>
    <td>
      <h3>하루가 지도로 남아요</h3>
      이번 달 외출을 캘린더로 보여줘요. 외출한 날은 파란 점, 빠뜨린 날은 주황 점.<br>
      날짜를 누르면 그날 머문 곳과 동선 지도, 어디서 무엇을 확인했는지 볼 수 있어요.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="assets/bag/bag-heart.png" alt="" width="96"></td>
    <td>
      <h3>연속 챙김</h3>
      모두 챙겨서 귀가한 외출이 몇 번 이어졌는지 세어 줘요. 끊기지 않게 이어 가 보세요.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="assets/bag/bag-sleep.png" alt="" width="96"></td>
    <td>
      <h3>위치는 외출 중에만</h3>
      외출을 시작하면 위치 기록을 켜고, 귀가를 마치면 멈춰요.<br>
      기록은 기기 안에만 저장되고, 이번 달 기록만 남겨요.<br>
      챙김은 물건 자체를 감지하지 않아요. 두고 오기 쉬운 순간을 알려 주고, 확인은 직접 해요.
    </td>
  </tr>
</table>

<br>

---

<img src="assets/bag/bag-hum.png" alt="" width="72" align="right">

## 개발

Expo(React Native)로 만든 iOS 앱입니다. 화면 흐름은 Maestro로, 배포는 EAS로 합니다.

| 영역 | 사용한 것 |
| --- | --- |
| 앱 | Expo SDK 58, React Native 0.88, Expo Router |
| 위치 | `expo-location` 백그라운드 위치 + `expo-task-manager` (머문 곳 감지와 자리 뜰 때 알림) |
| 알림 | `expo-notifications` (알림에서 바로 "모두 챙김" 응답) |
| 저장 | `expo-sqlite` (기기 안 파일 하나, 서버 없음) |
| 지도와 장소 | 카카오맵 JavaScript SDK(WebView), 카카오 로컬 API(근처 상호 이름) |
| 테스트 | Maestro 화면 시나리오 13개 (`.maestro/flows`) |
| 배포 | EAS Build, EAS Update(OTA) |

### 실행하기

백그라운드 위치와 알림 액션을 쓰기 때문에 Expo Go가 아니라 개발 빌드가 필요합니다.

```bash
npm install
npx expo run:ios
```

프로젝트 루트에 `.env.local`을 만들고 카카오 앱 키 두 개를 넣습니다.

```
EXPO_PUBLIC_KAKAO_JS_KEY=   # 지도 (카카오 콘솔에 JavaScript SDK 도메인 등록 필요)
EXPO_PUBLIC_KAKAO_REST_KEY= # 근처 상호 검색
```

키가 없어도 앱은 동작합니다. 지도는 "불러오지 못했어요"로, 장소 이름은 기기의 주소로 대신 보여줍니다.

### 테스트

```bash
npx tsc --noEmit
npx expo lint
maestro test .maestro/flows   # iOS 시뮬레이터, 빌드 전 필수
```

### 저장 구조

모든 데이터는 기기 안의 SQLite 파일 `chaengkim.db` 하나에 저장됩니다.

```mermaid
erDiagram
    items {
        TEXT id PK
        TEXT name "소지품 이름"
        INTEGER price "가격(원)"
        INTEGER isDefault "출발할 때 기본 포함"
        INTEGER createdAt
    }
    sessions {
        TEXT id PK
        INTEGER startedAt "외출 시작"
        INTEGER endedAt "귀가 (null = 외출 중)"
        TEXT trigger "schedule | manual"
        TEXT itemIds "가져간 물건 (JSON)"
    }
    stays {
        TEXT id PK
        TEXT sessionId FK
        REAL anchorLat "머문 기준점"
        REAL anchorLng
        INTEGER arrivedAt
        INTEGER leftAt
        TEXT placeId FK "근처 저장 장소"
        TEXT customName "직접 붙인 이름"
    }
    leave_logs {
        TEXT id PK
        TEXT stayId FK
        REAL dwellMin "머문 분"
        TEXT notifiedBy "A | B"
        INTEGER notifiedAt
        REAL distanceFromAnchorM
        TEXT userReportedDelay "now | 1-3 | 3-5 | 5+"
        TEXT action "allChecked | opened | ignored"
        TEXT recoveredItemIds "돌아가서 챙긴 물건 (JSON)"
    }
    places {
        TEXT id PK
        TEXT name "집, 회사…"
        REAL lat
        REAL lng
        INTEGER radiusM
        TEXT kind "home | trusted | saved"
        TEXT extraItemIds "추가로 챙길 물건 (JSON)"
    }
    departure_schedules {
        TEXT id PK
        INTEGER weekday "0(일) ~ 6(토)"
        TEXT time "08:30"
        INTEGER enabled
    }
    app_state {
        TEXT key PK "onboarded, testMode, dwellMin, 가게 없음 표시…"
        TEXT value
    }

    sessions ||--o{ stays : "머문 기록"
    stays ||--o| leave_logs : "자리 뜰 때 알림"
    places |o--o{ stays : "장소 연결"
    sessions }o..o{ items : "itemIds"
    leave_logs }o..o{ items : "recoveredItemIds"
    places }o..o{ items : "extraItemIds"
```

### 외출 한 번의 흐름

```mermaid
flowchart LR
    A([출발 체크]) -->|sessions 생성| B[외출 중]
    B -->|위치 변화| C[(stays<br/>머문 기록)]
    C -->|머문 뒤 떠남| D{{자리 뜰 때 알림}}
    D -->|leave_logs 기록| B
    C -.->|근처 저장 장소| P[(places)]
    B -->|귀가 체크| E([sessions.endedAt<br/>외출 종료])
```

### 머문 곳 이름 정하는 순서

```mermaid
flowchart LR
    S[stays 한 줄] --> N1{customName<br/>있음?}
    N1 -->|예| R([직접 붙인 이름])
    N1 -->|아니오| N2{placeId<br/>있음?}
    N2 -->|예| R2([저장 장소 이름])
    N2 -->|아니오| R3([근처 상호 검색<br/>카카오, 저장하지 않음])
```
