# AI 데이팅 앱 아바타 게임 사용 가이드

이 저장소는 **OpenAI 챗봇**과 **로컬 SD Turbo(또는 ComfyUI) 이미지 생성기**, 그리고 **p5.js 프론트엔드**를 묶어 "데이팅 앱처럼 대화하면서 실시간으로 아바타가 변하는" 데모를 만드는 예시입니다. 완전한 초보자도 따라 할 수 있도록 순서를 최대한 잘게 나누어 설명했습니다.

---

## 1. 전체 구조 이해하기

```
chat-avatar-game/
├─ package.json              # Node.js(Express) 서버 설정
├─ .env                      # OpenAI 키 저장 (직접 생성)
├─ server/                   # REST API + OpenAI/Turbo 연동 코드
├─ turbo-server/             # 로컬 이미지 생성 서버 (FastAPI 예시)
└─ public/                   # p5.js UI: 채팅 + 아바타 교체 연출
```

- **server/**: `/api/chat-avatar` 라우트가 OpenAI에 대화를 보내고, 받은 `imagePrompt`를 로컬 Turbo 서버로 전달합니다.
- **public/**: 브라우저에서 `p5.js`가 채팅 UI를 그리고, 새 아바타가 생성되면 부드럽게 교체합니다.
- **turbo-server/**: `app.py`가 간단한 FastAPI 서버로, 실제 SD Turbo나 ComfyUI HTTP API를 붙이기 위한 자리입니다.

---

## 2. 준비물

| 항목 | 권장 버전 | 설명 |
| --- | --- | --- |
| Node.js | 18 LTS 이상 | Express 서버, p5 정적 파일 호스팅 |
| npm | Node.js 설치 시 함께 제공 | 의존성 설치 명령어 |
| Python | 3.10 이상 | FastAPI 기반 Turbo 서버 실행 |
| pip/venv | Python 표준 도구 | FastAPI, uvicorn 설치 |
| OpenAI API Key | https://platform.openai.com 계정 | GPT 호출 인증 |

> ⚠️ GPU가 없어도 예제는 동작합니다. `turbo-server/app.py`가 1x1 PNG를 내려주기 때문입니다. 실제 이미지를 만들려면 SD Turbo나 ComfyUI HTTP 엔드포인트로 코드를 교체하세요.

---

## 3. 설치 순서 (Node 서버)

1. **리포지터리 다운로드**
   ```bash
   git clone <이 저장소 주소>
   cd AIfriend
   ```
2. **패키지 설치**
   ```bash
   npm install
   ```
3. **환경변수 작성**
   - 루트에 있는 `.env` 파일을 열고 한 줄을 아래처럼 채웁니다.
     ```
     OPENAI_API_KEY=sk-여기에_본인_키
     ```
   - 키는 절대 외부에 공유하지 마세요.

---

## 4. 설치 순서 (로컬 Turbo 서버)

1. **가상환경(선택)**
   ```bash
   cd turbo-server
   python -m venv .venv
   source .venv/bin/activate  # Windows는 .venv\Scripts\activate
   ```
2. **필요 패키지 설치**
   ```bash
   pip install fastapi uvicorn pydantic
   ```
3. **서버 실행**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```
4. **실제 이미지 생성기로 바꾸기**
   - `app.py`의 `generate_avatar` 함수에서 `req.prompt`를 받아 실제 SD Turbo/ComfyUI 파이프라인을 호출하고, Base64 PNG를 반환하도록 수정하면 됩니다.

---

## 5. Express 서버 실행

Turbo 서버를 띄운 뒤, 새 터미널에서 프로젝트 루트로 돌아와 실행합니다.

```bash
npm run start
```

- 서버가 올라가면 `http://localhost:3000`에서 정적 사이트(p5.js)가 서비스됩니다.
- 개발 중 자동 리로드가 필요하면 `npm run dev` (nodemon)를 사용하세요.

---

## 6. 브라우저에서 체험하기

1. `http://localhost:3000` 접속
2. 화면 왼쪽의 입력창에 간단한 인삿말을 적고 **Send** 버튼 클릭
3. 서버 흐름
   1. `/api/chat-avatar` → OpenAI → JSON(`reply`, `profile`, `imagePrompt`)
   2. `imagePrompt` → Turbo 서버 → Base64 이미지 파일 → `/public/assets/generated/` 저장
   3. 프론트엔드가 이전 아바타(`oldAvatar`)와 새 아바타(`newAvatar`)를 교차 페이드(blend) 처리
4. 채팅과 이미지가 번갈아 업데이트되는지 확인합니다.

---

## 7. 자주 묻는 질문

### Q1. OpenAI 키가 노출되면 안 된다는데, 어떻게 숨기나요?
- `.env` 파일을 `.gitignore`에 포함시키고, 배포 시에는 서버 환경변수에 직접 넣습니다. 현재 템플릿도 `.env`를 따로 커밋하지 않는 것을 가정하고 있습니다.

### Q2. Turbo 서버가 없으면 어떻게 하나요?
- `turbo-server/app.py`는 기본으로 1x1 PNG를 돌려주므로 테스트용으로 충분합니다. 실제 이미지를 원하면 ComfyUI HTTP 워크플로를 붙이고, `server/services/turboClient.js`에서 요청 주소와 응답 포맷을 맞추면 됩니다.

### Q3. npm install이 막힐 때는?
- 사내 프록시/방화벽 때문일 수 있습니다. `npm config set proxy` 등을 사용하거나, 허용된 미러 레지스트리를 지정한 뒤 다시 실행하세요.

---

## 8. 다음 단계 아이디어

- `public/sketch.js`에서 UI를 꾸미고, profile JSON을 별도 패널에 시각화
- Turbo 서버에 진짜 SD Turbo 파이프라인 연결 후, 생성된 이미지를 사용자에게 다운로드 제공
- 대화 맥락을 로컬스토리지에 저장해 새로고침 후에도 이어보기

행복한 실험 되세요! 😊
