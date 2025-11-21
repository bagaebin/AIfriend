# 세션 흐름 및 프롬프트

이 가이드는 대화, 아바타 프로필 진화, 이미지 갱신 주기를 어떻게 설계해 매끄럽고 비용 효율적인 경험을 유지할지 설명합니다.

## 대화 리듬
1. 짧은 인사와 함께 이름/닉네임을 묻습니다.
2. 2–4턴 동안 분위기, 색감, 머리, 의상, 배경 무드 등 스타일 단서를 모읍니다.
3. 가벼운 데이팅 톤의 대화를 이어가며 가끔 시각적 선택을 확인합니다.

## 프로필 JSON 계약
```json
{
  "nickname": "string",
  "personalityVibe": "string",
  "hair": "string",
  "face": "string",
  "clothing": "string",
  "background": "string",
  "colorPalette": "string",
  "camera": "portrait" | "half-body" | "bust",
  "extraNotes": "string"
}
```

## 아바타 이미지를 갱신할 때
- **새 이미지 생성:** 매 턴 강제로 새 이미지를 생성해 최신 대화 내용을 즉시 반영합니다.
- **기존 이미지 재사용:** 사용하지 않습니다(needNewImage를 항상 true로 유지).

## 텍스트 모델 프롬프트 규칙
- 시스템 프롬프트는 모델에게 다음을 지시합니다:
  - 기본적으로 부드럽고 친근한 톤의 한국어로 대화.
  - 응답은 2–4문장으로 간결하게 유지하며 항상 `{ reply, profile, imagePrompt, needNewImage }` JSON 래퍼를 반환.
  - `imagePrompt`는 영어로 작성하고, 정면 초상/상반신, 중립 조명, 눈·코·입이 명확히 보이도록 요청.

## 프론트엔드/백엔드 상호작용 루프
1. 프론트엔드는 매 사용자 메시지 이후 `messages`와 `currentProfile`을 `/api/chat-avatar`로 전송합니다.
2. 백엔드는 업데이트된 profile과 매 턴 새로운 `imageUrl`을 반환합니다.
3. 프론트엔드는 채팅 로그를 갱신하고 `needNewImage`가 항상 true이므로 아바타 텍스처를 매 턴 교체한 뒤 VTuber 변형을 지속합니다.

## 로깅 및 텔레메트리(선택)
- 비용 모니터링을 위해 이미지 재생성 횟수를 기록.
- 랜드마크 누락 빈도를 수집해 추적기 설정을 조정.
- 변형 파이프라인 회귀를 잡기 위해 평균 렌더 프레임 시간을 기록.
