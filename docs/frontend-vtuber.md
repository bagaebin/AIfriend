# 프론트엔드 VTuber 파이프라인

이 문서는 좌측 채팅·우측 콜 프리뷰로 구성된 현재 프론트엔드의 구조와, 대화 맥락을 바탕으로 초상 이미지를 갱신하는 흐름을 설명합니다. 웹캠/페이스트래킹 요소는 제거하고, 생성된 초상 이미지를 정적 타일로 표기합니다.

## UI 레이아웃
- **ChatPanel:** 왼쪽 컬럼에 스크롤 가능한 말풍선 영역과 입력창 + `Send` 버튼.
- **CallPreview:** 오른쪽 상단은 생성된 인물 초상 이미지(사용자 모습 가정), 하단은 카메라를 끈 Bot 타일과 `Call to another` 버튼으로 세션 리셋.
- **Help Modal:** 우측 상단 `help` 버튼을 누르면 작품 의도를 설명하는 모달을 표시.
- 기본 파일 구조: `public/index.html`, `public/main.js`, `public/style.css`.

## 모듈
- **Chat Module**
  - `chat-log`에 말풍선을 추가하고, `chat-form` 제출 시 서버에 메시지와 현재 프로필을 전달.
  - `Call to another` 클릭 시 메시지, 프로필, 초상 이미지를 초기화하고 새 인사 메시지를 표시.
  - 대기 중에는 말풍선에 `...` 로딩 인디케이터를 표시하고, 응답은 항상 영어로 전달한다.
- **Portrait Display**
  - 서버가 반환한 `imagePrompt`를 바탕으로 `/api/generate-avatar`에 별도 요청해 최신 이미지가 준비되면 `<img id="portrait-image">`에 반영한다.
  - 이미지가 없거나 생성 중일 땐 어두운 배경 위에 `bot-avatar` + `bot-label`로 구성된 프리뷰 타일을 보여준다.
- **Help Modal**
  - `help` 버튼으로 작품 의도 안내를 띄우고, 배경 클릭 또는 닫기 버튼으로 숨김.

## 인터랙션 루프 요약
1. 사용자가 메시지를 입력하고 제출하면 `messages`, `currentProfile`, `imageUrl`, `lastImagePrompt`를 `/api/chat-avatar`로 전송한다.
2. 서버는 JSON 형태의 대화 답변과 `imagePrompt`, `needNewImage`를 돌려주며, 프론트는 즉시 채팅 버블을 그린 뒤 필요할 때만 `/api/generate-avatar`로 이미지를 생성한다.
3. 이미지 생성 응답은 가장 마지막으로 요청된 프롬프트에 대해서만 반영해 최신 초상만 유지한다.
4. `Call to another` 버튼으로 세션을 초기화해 새로운 대화를 시작할 수 있다.

## 리소스 및 장애 대응
- 이미지가 없거나 생성에 실패하면 기본 초상 대신 어두운 배경의 프리뷰 타일을 노출해 끊김 없이 대화를 이어간다.
- 브라우저 의존 리소스를 최소화했으므로 네트워크 오류만 감지하면 되며, 헬프 모달은 오프라인에서도 동작한다.
