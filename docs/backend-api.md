# 백엔드 API 및 OpenAI 오케스트레이션

백엔드는 단일 Express 서비스로, 대화 상태와 아바타 생성을 관리합니다. 이 사양은 프론트엔드 소비자가 이해하기 쉽도록 하면서 OpenAI 사용에 대한 가드레일을 제공합니다.

## 엔드포인트: POST /api/chat-avatar
**요청 본문**
```json
{
  "messages": [
    { "role": "user" | "assistant", "content": "..." }
  ],
  "currentProfile": { "nickname": "...", "personalityVibe": "...", "hair": "...", "face": "...", "clothing": "...", "background": "...", "colorPalette": "...", "camera": "portrait" | "half-body" | "bust", "extraNotes": "..." }
}
```

**응답 본문**
```json
{
  "reply": "사용자에게 보여줄 assistant 메시지",
  "profile": { "nickname": "...", "personalityVibe": "...", "hair": "...", "face": "...", "clothing": "...", "background": "...", "colorPalette": "...", "camera": "portrait" | "half-body" | "bust", "extraNotes": "..." },
  "imageUrl": "/public/avatars/<id>.png",
  "needNewImage": true
}
```

## OpenAI 텍스트 호출
- **모델:** `gpt-4.1-mini`(또는 동급 Chat/Responses API).
- **시스템 프롬프트 역할:**
  - 친근한 데이팅 상대이자 아바타 디자이너로 롤플레이.
  - JSON 래퍼 `{ reply, profile, imagePrompt, needNewImage }`만 반환.
- **needNewImage 규칙:** 외형(머리/얼굴/의상/배경)이 실질적으로 바뀔 때만 true.

## OpenAI 이미지 호출
- **트리거:** 텍스트 호출 결과 `needNewImage === true`일 때.
- **모델:** `gpt-image-1-mini`(또는 `gpt-image-1`).
- **프롬프트:** 텍스트 응답의 `imagePrompt`; “정면 초상 또는 상반신, 중립 조명, 눈·코·입이 선명”을 강조하며 **사진에 가까운 사실적 스타일**을 기본값으로 합니다. (스타일이 지나치게 회화적이면 랜드마크 기반 변형/트래킹 정합도가 떨어질 수 있음.)
- **권장 페이로드:**
```json
{
  "model": "gpt-image-1-mini",
  "prompt": "<imagePrompt>",
  "size": "1024x1024"
}
```
- **출력 처리:** `/public/avatars/<timestamp>.png` 등에 저장하고 공개 URL을 반환.
- **선택적 후처리:** 필요하다면 생성된 정적 이미지를 MediaPipe FaceMesh(정지 이미지 모드)로 한 번 돌려 메쉬 초기 정렬을 보정할 수 있으나, 기본 워크플로는 수동 메쉬 정의를 사용합니다.

## 오류 처리 및 대체 동작
- OpenAI 호출을 try/catch로 감싸고, 실패 시 마지막 `profile`과 `imageUrl`을 돌려주며 대화식 사과 메시지를 `reply`에 포함합니다.
- 요청 ID와 함께 OpenAI 오류를 로깅하고, 스택 트레이스는 클라이언트에 노출하지 않습니다.
- 요청 본문 검증(messages 배열, 선택적 profile 객체)을 강제해 비정상 페이로드가 모델에 도달하지 않도록 합니다.
