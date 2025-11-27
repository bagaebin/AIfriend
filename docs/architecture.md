# 시스템 아키텍처

얇은 Express 백엔드는 OpenAI 텍스트/이미지 호출을 조율하고, 브라우저는 채팅/콜 UI를 통해 생성된 초상 이미지를 표시합니다. 두 영역은 단일 JSON 엔드포인트로 최소 상태만 교환합니다.

## 상위 구성 요소
- **프론트엔드(브라우저)**
  - 채팅 UI: 말풍선 로그와 입력 박스.
  - 콜 프리뷰: 생성된 초상 이미지를 `<img>`로 표시하고, Bot 타일과 `Call to another` 버튼을 제공.
  - 헬프 모달: 작품 의도 안내를 제공해 사용자에게 맥락을 설명.
- **백엔드(Node + Express)**
  - `POST /api/chat-avatar`: 메시지와 현재 아바타 프로필을 받아 OpenAI 텍스트, 필요 시 이미지 호출 후 reply + profile + image URL을 반환.
  - 생성된 아바타 정적 호스팅(e.g., `/public/avatars/{id}.png`).

## 데이터 흐름(턴별)
1. 클라이언트가 `{ messages, currentProfile }`를 `/api/chat-avatar`로 보냅니다.
2. 서버가 system/user 프롬프트를 구성해 OpenAI 텍스트 모델을 호출 → `{ reply, profile, imagePrompt, needNewImage }` 획득.
3. `needNewImage`를 항상 true로 강제해 매 턴 OpenAI 이미지 모델을 호출하고 공개 URL을 저장/발급합니다.
4. 서버가 `{ reply, profile, imageUrl, needNewImage }`로 응답합니다.
5. 클라이언트는 reply를 채팅에 추가하고 초상 타일 이미지를 교체합니다.

## 성능 및 복원력
- **OpenAI 호출:** 렌더 루프 없이 비동기 호출로 이미지 생성을 처리하며, `needNewImage`를 항상 true로 둬 매 턴 새 이미지를 생성합니다.
- **렌더링:** 정적 초상 이미지를 `<img>`로 표시해 레이턴시와 리소스 사용을 최소화합니다.
- **대응:** OpenAI 실패 시 캐시된 profile/image와 친절한 오류 reply를 반환합니다.
- **아바타 이미지 스타일:** 랜드마크 의존을 줄였지만, 여전히 **정면에 가까운 사실적 초상**을 기본값으로 삼아 일관된 비주얼을 유지합니다.
