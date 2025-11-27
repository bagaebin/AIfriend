# 시스템 아키텍처

얇은 Express 백엔드는 OpenAI 텍스트/이미지 호출을 조율하고, 브라우저는 실시간 얼굴 추적과 WebGL 기반 아바타 변형을 수행합니다. 두 영역은 단일 JSON 엔드포인트로 최소 상태만 교환합니다.

## 상위 구성 요소
- **프론트엔드(브라우저)**
  - 채팅 UI: 말풍선 로그와 입력 박스.
  - VTuber 뷰포트: WebGL로 구동되는 `<canvas>`; 서버가 새 이미지를 주면 아바타 텍스처를 교체.
  - 웹캠 & 트래킹: 랜드마크용 MediaPipe FaceMesh(또는 동급)와 경량 표정 매핑/메쉬 워핑.
- **백엔드(Node + Express)**
  - `POST /api/chat-avatar`: 메시지와 현재 아바타 프로필을 받아 OpenAI 텍스트, 필요 시 이미지 호출 후 reply + profile + image URL을 반환.
  - 생성된 아바타 정적 호스팅(e.g., `/public/avatars/{id}.png`).

## 데이터 흐름(턴별)
1. 클라이언트가 `{ messages, currentProfile }`를 `/api/chat-avatar`로 보냅니다.
2. 서버가 system/user 프롬프트를 구성해 OpenAI 텍스트 모델을 호출 → `{ reply, profile, imagePrompt, needNewImage }` 획득.
3. `needNewImage`를 항상 true로 강제해 매 턴 OpenAI 이미지 모델을 호출하고 공개 URL을 저장/발급합니다.
4. 서버가 `{ reply, profile, imageUrl, needNewImage }`로 응답합니다.
5. 클라이언트는 reply를 채팅에 추가하고, `needNewImage`가 항상 true이므로 매 턴 아바타 텍스처를 교체하며, 웹캠 기반 표정으로 프레임마다 메쉬 변형을 유지합니다.

## 성능 및 복원력
- **OpenAI 호출:** 렌더 루프 밖에서 이미지 생성을 처리하며, `needNewImage`를 항상 true로 둬 매 턴 새 이미지를 생성합니다.
- **트래킹:** 320–640px 비디오 입력에서 FaceMesh를 실행하고 랜드마크가 없을 땐 부드럽게 프레임을 건너뜁니다.
- **렌더링:** 20–30fps를 목표로 하고, 눈·입·눈썹 등 핵심 영역만 제한된 이동량으로 변형해 과도한 왜곡을 막습니다.
- **대응:** 트래킹이 여러 프레임 실패하면 중립 포즈로 점진 복귀하고, OpenAI 실패 시 캐시된 profile/image와 친절한 오류 reply를 반환합니다.
- **아바타 이미지 스타일:** MediaPipe로 추출한 표정 파라미터를 안정적으로 적용하기 위해 기본 생성 스타일은 **정면에 가까운 사실적 초상**을 권장합니다. (과도한 만화풍은 랜드마크 정합도를 낮출 수 있음.)
