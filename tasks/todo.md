# Tasks: 송년 보물찾기 V1

Plan: tasks/plan.md · Spec: SPEC.md

---

## Phase 1: 위험 검증 PoC

### Task 1: 프로젝트 뼈대 + 프록시 경유 연결 확인
**Description:** Vite + three.js 클라이언트와 Node + Socket.IO 서버를 만든다. 서버는 localhost:8080에서 빌드된 화면과 소켓을 같이 서빙한다. 화면에는 평평한 바닥과 연결 상태(websocket / polling) 표시만 있다.

**Acceptance criteria:**
- [x] `npm run dev`, `npm run build`, `npm start`, `npm test`가 동작
- [ ] 폰에서 프록시 주소로 접속하면 3D 바닥이 보이고 연결 방식이 표시됨

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: 폰으로 프록시 주소 접속, 표시가 `websocket`인지 확인 (polling이면 프록시 설정 이슈로 보고)

**Dependencies:** None
**Files likely touched:** `package.json`, `vite.config.js`, `server/index.js`, `client/index.html`, `client/src/main.js`
**Estimated scope:** M

### Task 2: 조이스틱 이동 + 3인칭 카메라
**Note:** 가로 모드 전용 (세로면 회전 안내). Orca 브라우저 모바일 에뮬레이션으로 검증, 실기기 iOS 확인은 Checkpoint 1에서.

**Description:** 왼쪽 가상 조이스틱으로 캐릭터(임시 캡슐)를 움직이고, 오른쪽 드래그로 카메라를 돌린다. 카메라는 캐릭터 뒤를 따라간다.

**Acceptance criteria:**
- [x] 한 손가락 조이스틱 + 다른 손가락 드래그를 동시에 해도 둘 다 동작 (멀티터치)
- [x] 이동 방향이 카메라 기준 (조이스틱 위 = 카메라가 보는 쪽)
- [ ] 화면 스크롤, 확대, 길게 눌러 선택 같은 브라우저 기본 동작이 안 일어남

**Verification:**
- [x] Manual check: iOS Safari (Android 미확인)

**Dependencies:** Task 1
**Files likely touched:** `client/src/game/controls.js`, `client/src/game/camera.js`, `client/src/main.js`, `shared/constants.js`
**Estimated scope:** M

### Task 3: 임시 맵 + 충돌 + 스폰 광장 제한
**Description:** shared/map.js에 약 100m x 100m 맵을 박스 건물로 정의하고 화면에 그린다. 플레이어(원)와 박스의 2D 충돌을 구현한다. 대기 중에는 스폰 광장 반경 밖으로 못 나간다.

**Acceptance criteria:**
- [x] 건물을 뚫고 지나갈 수 없고, 벽을 따라 미끄러지듯 이동
- [x] 대기 상태에서는 스폰 광장 밖으로 못 나감
- [x] 충돌 함수 단위 테스트 (정면 충돌, 모서리, 미끄러짐)

**Verification:**
- [x] Tests pass: `npm test -- collision`
- [ ] Manual check: 폰으로 벽에 비스듬히 부딪쳐보기

**Dependencies:** Task 2
**Files likely touched:** `shared/map.js`, `shared/collision.js`, `client/src/game/world.js`, `tests/collision.test.js`
**Estimated scope:** M

### Task 4: 입장 + 멀티플레이 동기화 + 재접속
**Description:** 닉네임 입력 후 입장, 10Hz 위치 전송과 브로드캐스트, 다른 플레이어 보간 표시, 닉네임 중복 처리, 토큰 재접속을 만든다.

**Acceptance criteria:**
- [x] 두 폰이 서로의 캐릭터가 부드럽게 움직이는 것을 봄
- [x] 닉네임 1~12자 검증, 중복이면 숫자 붙임, 속도 상한 초과 이동은 서버가 거부
- [x] 새로고침해도 같은 플레이어로 복귀 (단위 테스트로 점수 유지 확인)

**Verification:**
- [x] Tests pass: `npm test -- game`
- [ ] Manual check: 폰 2대, 한 대 새로고침 후 같은 닉네임과 위치로 복귀

**Dependencies:** Task 3
**Files likely touched:** `server/game.js`, `server/index.js`, `client/src/net.js`, `client/src/game/players.js`, `tests/game.test.js`
**Estimated scope:** M

### Task 5: 부하 테스트 봇
**Description:** socket.io-client로 가짜 플레이어 N명을 만들어 맵을 돌아다니게 하고 지연을 측정한다.

**Acceptance criteria:**
- [x] `npm run loadtest -- --url <URL> --bots 45`가 동작하고 평균, 최대 지연을 출력
- [x] 봇이 폰 화면에도 보임

**Verification:**
- [ ] Manual check: 프록시 주소로 봇 45개 + 폰 2대, 폰 FPS 표시 확인

**Dependencies:** Task 4
**Files likely touched:** `scripts/loadtest.js`, `package.json`
**Estimated scope:** S

## Checkpoint 1: 연결과 성능 (2026-11-23 통과)
- [x] `npm test` 통과
- [x] 실제 iPhone(사내 Wi-Fi, http://<LAN IP>:8080)에서 접속, 봇과 서로 보임. Android 실기기는 미확보로 미확인
- [x] 봇 45개 + iPhone에서 60fps 고정, 3분간 끊김 0, RTT 최대 7.4ms, 스냅샷 간격 최대 136ms
- [x] 가로 전용 + 홈 화면 추가(웹앱) 시 전체화면 iPhone에서 확인
- [x] 사용자 확인 후 진행

---

## Phase 2: 게임 루프 완성

### Task 6: 관리자 화면 + 시작/리셋 + 타이머
**Description:** `/admin?token=` 화면에 접속자 수, 시작, 리셋, 남은 시간을 보여준다. 서버가 상태(대기 → 진행 → 종료)와 타이머를 관리한다.

**Acceptance criteria:**
- [x] 토큰이 틀리면 화면과 소켓 명령 모두 거부
- [x] 시작하면 모든 폰에서 동시에 이동 제한이 풀리고 남은 시간이 표시됨
- [x] 리셋하면 점수, 타이머가 초기화되고 모두 스폰 광장으로 복귀

**Verification:**
- [x] Tests pass: `npm test -- game` (상태 전이, 토큰 검사)
- [x] Manual check: 노트북 관리자 화면 + 폰 2대

**Dependencies:** Task 4
**Files likely touched:** `client/admin.html`, `client/src/admin.js`, `server/game.js`, `server/index.js`, `tests/game.test.js`
**Estimated scope:** M

### Task 7: 보물 + 줍기 버튼 + 선착순 판정 + 실시간 순위
**Description:** 보물을 임시 도형으로 표시하고, 2m 안에 들어가면 줍기 버튼을 띄운다. 서버가 거리와 선착순을 판정하고, 관리자 화면에 실시간 순위를 띄운다.

**Acceptance criteria:**
- [x] 동시 요청 시 정확히 한 명만 획득 (단위 테스트)
- [x] 획득된 보물은 모든 폰에서 즉시 사라지고 내 점수가 오름
- [x] 순위: 점수 내림차순, 동점이면 먼저 도달한 사람이 위 (단위 테스트)

**Verification:**
- [x] Tests pass: `npm test -- game`
- [x] Manual check: 폰 2대가 같은 보물을 동시에 탭

**Dependencies:** Task 6
**Files likely touched:** `server/game.js`, `client/src/game/treasures.js`, `client/src/admin.js`, `shared/map.js`, `tests/game.test.js`
**Estimated scope:** M

### Task 8: 게임 종료 + 최종 순위
**Description:** 시간이 다 되거나 보물 40개가 다 발견되면 종료한다. 이동을 멈추고 큰 화면에 최종 순위, 폰에 내 순위를 보여준다.

**Acceptance criteria:**
- [x] 두 종료 조건 모두 동작 (단위 테스트)
- [x] 종료 후 줍기 요청 거부
- [x] 큰 화면에서 1~3위 강조 + 전체 순위, 폰에 "N위 / 보물 M개"

**Verification:**
- [x] Tests pass: `npm test -- game`
- [x] Manual check: GAME_SECONDS=60으로 한 판

**Dependencies:** Task 7
**Files likely touched:** `server/game.js`, `client/src/admin.js`, `client/src/main.js`, `tests/game.test.js`
**Estimated scope:** S

### Task 9: 3분 힌트 (비프음 + 가장자리 발광)
**Description:** 남은 시간 3:00부터 가장 가까운 미발견 보물이 25m 안이면 거리에 비례해 비프 간격과 화면 가장자리 발광을 바꾼다.

**Acceptance criteria:**
- [x] 3:00 전에는 힌트 없음, 3:00에 켜짐
- [x] 가까워질수록 비프가 빨라지고 발광이 진해짐, 25m 밖에서는 조용
- [x] iOS에서 소리가 남 (입장 탭 시 오디오 활성화), 무음 모드에서도 발광은 보임

**Verification:**
- [x] Manual check: iOS 실기기 (Android 미확인)

**Dependencies:** Task 7
**Files likely touched:** `client/src/game/hint.js`, `client/src/main.js`, `shared/constants.js`
**Estimated scope:** S

### Task 10: 카메라 벽 충돌 (실내 가림)
**Description:** 카메라와 캐릭터 사이에 벽이 있으면 카메라를 캐릭터 쪽으로 당긴다. 임시 맵에 들어갈 수 있는 건물 하나를 추가해 검증한다.

**Acceptance criteria:**
- [x] 실내에 들어가면 카메라가 벽 밖으로 나가지 않음
- [x] 바깥에서 벽 너머 실내 보물이 보이지 않음

**Verification:**
- [x] Manual check: 폰으로 실내 출입 반복

**Dependencies:** Task 3
**Files likely touched:** `client/src/game/camera.js`, `shared/map.js`
**Estimated scope:** S

## Checkpoint 2: 한 판 완주 (2026-11-23 통과, 사용자 플레이테스트)
- [x] `npm test` 통과, `npm run build` 성공
- [x] GAME_SECONDS=300으로 사람이 처음부터 최종 순위까지 한 판 완주
- [x] 사용자 확인 후 진행

---

## Phase 3: 비주얼 고도화

> 2026-11-23 사용자 결정: 스타일 B. 고도화 순서 1 조명/분위기 → 2 손맛 → 3 소리 → 5 후처리(블룸·색보정) → 4 밀리는 소품(물리). 5, 4는 후순위.
> 진행: 맵(집 28채 중 실내 6채, 망루 3개, 계단·2층 높이 이동), 보물 40개 수작업 배치 + 도달 가능성 BFS 테스트, 1·2·3 구현 완료. 실기기 확인 대기.

### Task 11: 에셋 후보 조사 + 비교 화면 + 사용자 선택
**Description:** CC0 겨울/마을/캐릭터 팩 후보(Kenney, Quaternius 등)를 받아 라이선스를 확인하고, 같은 장면에 놓은 비교 스크린샷을 만든다.

**Acceptance criteria:**
- [x] 후보 2~3개 조합의 스크린샷과 각 팩 라이선스 원문 확인
- [x] 사용자가 1개 조합 선택
- [x] `public/assets/LICENSE.md`에 출처와 라이선스 기록

**Verification:**
- [x] Manual check: 사용자 승인

**Dependencies:** Checkpoint 2
**Files likely touched:** `public/assets/`, `public/assets/LICENSE.md`
**Estimated scope:** S

### Task 12: 캐릭터 모델 + 애니메이션 + 이름표
**Description:** 캡슐을 선택한 캐릭터로 바꾸고 대기/달리기 애니메이션, 플레이어별 색상, 이름표를 붙인다.

**Acceptance criteria:**
- [ ] 40명이 보여도 중급 폰 30fps 이상 (봇으로 측정)
- [x] 이동 속도에 따라 대기/달리기 전환

**Verification:**
- [ ] Manual check: 봇 45개 + 폰 FPS

**Dependencies:** Task 11
**Files likely touched:** `client/src/game/players.js`, `client/src/game/assets.js`
**Estimated scope:** M

### Task 13: 겨울 마을 레벨 디자인
**Description:** 임시 박스를 실제 건물과 소품으로 바꾸고, 들어갈 수 있는 건물, 골목, 2층 발코니/망루를 배치한다. 충돌 박스를 모델에 맞춘다.

**Acceptance criteria:**
- [x] 충돌 박스와 보이는 모델이 어긋나지 않음 (끼임, 허공 벽 없음)
- [x] 들어갈 수 있는 건물 5채 이상, 계단으로 오르는 2층 공간 2곳 이상
- [ ] 사용자가 폰으로 둘러보고 승인

**Verification:**
- [x] Tests pass: `npm test` (스폰 광장과 보물 좌표가 충돌 박스 안에 없는지 검사)
- [ ] Manual check: 맵 전체 한 바퀴

**Dependencies:** Task 11
**Files likely touched:** `shared/map.js`, `client/src/game/world.js`, `tests/map.test.js`
**Estimated scope:** M

### Task 14: 분위기 연출 (조명, 안개, 눈, 보물 효과)
**Description:** 겨울 저녁 조명, 안개, 눈 파티클, 보물 반짝임과 획득 효과, 효과음을 넣는다.

**Acceptance criteria:**
- [x] 실시간 그림자 없이도 입체감 있는 조명
- [ ] 연출을 모두 켜도 중급 폰 30fps 이상

**Verification:**
- [ ] Manual check: 사용자 승인 + 폰 FPS

**Dependencies:** Task 13
**Files likely touched:** `client/src/game/world.js`, `client/src/game/effects.js`, `client/src/game/treasures.js`
**Estimated scope:** M

### Task 15: 성능 최적화 패스
**Description:** 다운로드 크기, 드로우콜(화면 한 번 그릴 때 GPU 호출 수), 텍스처 메모리를 재고 예산 안으로 줄인다.

**Acceptance criteria:**
- [ ] 첫 다운로드 15MB 이하, LTE에서 10초 안에 플레이 가능
- [ ] 중급 폰 평균 30fps 이상, iOS Safari 15분 연속 플레이 중 크래시 없음

**Verification:**
- [ ] Build succeeds: `npm run build` 후 dist 크기 확인
- [ ] Manual check: 실기기 15분 플레이

**Dependencies:** Task 14
**Files likely touched:** `public/assets/`, `client/src/game/assets.js`, `vite.config.js`
**Estimated scope:** M

### Task 15a: 실기기 피드백 개선 (2026-11-24 iPhone 테스트)
**Description:** iPhone + 봇 45명 테스트에서 나온 문제 4가지. 결과: 초반 47fps → 흩어지면 59~60fps, 소리/계단/보물 정상.

**Acceptance criteria:**
- [x] 달릴 때 발소리가 덜 경박하게: 달리기 중엔 발소리 간격을 늘리고 음높이·볼륨을 낮춤
- [x] 다른 플레이어 걷기 모션이 부드럽게: 서버 스냅샷 버퍼 보간(약 100ms 뒤를 재생) + 속도 기반 애니메이션 전환에 히스테리시스
- [x] 이동 중에도 "줍기" 버튼이 한 번에 눌림: click 대신 pointerdown, 버튼 터치 영역 확대, 범위를 벗어나도 잠깐 유지
- [x] 실내에 들어가면 카메라가 자연스럽게 1인칭으로 전환, 나오면 3인칭 복귀 (내 캐릭터는 1인칭에서 숨김)

**Verification:**
- [ ] Manual check: iPhone + 봇 45명으로 네 항목 재확인

**Dependencies:** Task 14
**Files likely touched:** `client/src/main.js`, `client/src/game/players.js`, `client/src/game/camera.js`, `client/src/game/fx.js`, `client/index.html`
**Estimated scope:** M

### Task 15b: 후처리 (블룸, 색보정) — 후순위
**Acceptance criteria:**
- [x] 가로등·창문 불빛이 은은하게 번짐, 색감 보정 (UnrealBloomPass 반해상도 + 따뜻한 색보정/비네트, three.js 내장)
- [x] iPhone 봇 45명에서 50fps대 유지 확인 (2026-11-24). 4초 구간 2번 연속 40fps 미만이면 그 폰은 자동으로 끔

### Task 15c: 밀리는 소품 (물리) — 후순위
**Acceptance criteria:**
- [x] 눈덩이 12개는 구르고, 썰매 4개는 미끄러지고, 작은 눈사람 5개는 흔들리며 밀림 (자체 원형 물리, 벽에 튕김, 서로 충돌, 부딪힘 소리). 보물 3m 안에는 두지 않음 (테스트)
- [ ] iPhone 성능 예산 유지

### Task 15d: UI 테마 정리 (2026-11-24 사용자 요청: "AI 티" 제거)
- [x] 폰 HUD: 종이 선물 태그 점수, 매달린 나무 간판 타이머(마지막 1분 빨강), 리본 토스트, 빨간 오너먼트 줍기 버튼, 솔방울색 음소거 버튼, 이모지 → SVG
- [x] 입장/결과/회전 안내 화면: 종이 카드 + 바느질 테두리, 리본 제목
- [x] 큰 화면: 간판 타이머, 리본 상태, 종이 순위판(금·은·동 메달), 최종 순위 시상대
- [x] 폰트 Jua (OFL) 자체 호스팅, 필요한 글자 조각만 다운로드
- [ ] Manual check: iPhone에서 가독성·터치 확인

### Task 15e: 선물 퀴즈 (2026-11-24 사용자 요청)
- [x] 선물마다 고정 문제, 문제 수만큼 선물 배치 (숨김 자리 60곳, 전부 도달 가능 테스트)
- [x] 열기 → 문제 + 보기, 20초 타이머, 맞히면 획득 / 틀리면 그 사람만 영구 제외 / 잠금 없이 선착순
- [x] 틀리면 정답 + 설명을 작은 알림으로, 도전한 선물은 어둡게 표시
- [x] 문제 관리 페이지 (추가/수정/삭제, 객관식 2~6지선다·OX), 서버 검증, 게임 중 저장 차단, 시작 시 최소 25개 검증
- [x] 예시 문제 27개 (체리 문제는 정답을 실제 값으로 바꿔야 함)
- [ ] Manual check: iPhone에서 퀴즈 가독성·터치, 실제 팀 문제 입력

### Task 15f: 데스크탑 조작 + 게임 방법 안내 (2026-11-24 사용자 요청)
- [x] UA로 데스크탑 판별(터치 되는 Mac = iPad는 모바일): 조이스틱 없이 WASD + 드래그 시점, 근처에서 F로 열기
- [x] 퀴즈 보기에 키캡 1~6 표시(데스크탑만), 숫자키로 답하기
- [x] 대기 중 "게임 방법" 카드: 입장 시 한 번 자동, 버튼으로 다시 열기, 시작하면 닫힘, 기기별 설명
- [ ] Manual check: 실제 키보드로 F/숫자키, iPhone에서 안내 카드 가독성

## Checkpoint 3: 비주얼 승인
- [ ] 실기기 30fps 이상, 다운로드 15MB 이하
- [ ] 사용자가 실제 폰으로 보고 비주얼 승인

---

## Phase 4: 행사 준비

### Task 16: 보물 40개 배치 + 난이도 튜닝
**Description:** 가림 위주 원칙(실내, 골목, 물체 뒤/밑, 2층)으로 보물 40개를 배치한다.

**Acceptance criteria:**
- [x] 40개 모두 걸어서 도달 가능하고 2m 안에 설 수 있음 (테스트)
- [ ] 리허설에서 15분 안에 전부 발견되지 않을 정도의 난이도

**Verification:**
- [x] Tests pass: `npm test -- map`
- [ ] Manual check: 리허설 결과로 조정

**Dependencies:** Task 13
**Files likely touched:** `shared/map.js`, `tests/map.test.js`
**Estimated scope:** S

### Task 17: 리허설 + 행사 당일 운영 문서
**Description:** 사람 5명 이상 + 봇 35개로 프록시 경유 15분 풀 리허설을 하고, 당일 실행 순서(서버 실행, QR, 시작, 리셋)를 README에 정리한다.

**Acceptance criteria:**
- [ ] 리허설에서 SPEC 성공 기준 1~8 확인
- [ ] README만 보고 관리자가 혼자 진행 가능

**Verification:**
- [ ] Manual check: 리허설 1회

**Dependencies:** Task 15, Task 16
**Files likely touched:** `README.md`
**Estimated scope:** S

## Checkpoint 4: 출시 준비 완료
- [ ] SPEC.md 성공 기준 1~8 전부 충족
- [ ] 15분 풀 리허설 1회 완료
