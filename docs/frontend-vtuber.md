# 프론트엔드 VTuber 파이프라인

이 문서는 2D VTuber 효과를 위해 채팅 UI, 웹캠 캡처, 얼굴 추적, 표정 매핑, 메쉬 변형을 담당하는 브라우저 측 모듈을 설명합니다.

## UI 레이아웃
- **ChatPanel:** 왼쪽 컬럼에 스크롤 가능한 말풍선과 입력창 + 전송 버튼.
- **AvatarPanel:** 오른쪽 컬럼에 WebGL 렌더링용 `<canvas>`와 숨겨진 웹캠 입력 `<video>`를 포함.
- 기본 파일 구조 제안: `index.html`, `main.js`, `style.css`(가능하면 ES 모듈).

## 모듈
- **AvatarPreparation**
  - 아바타 `imageUrl`을 `Image` 요소로 로드한 뒤 WebGL 텍스처로 업로드.
  - 전체 이미지를 덮는 UV를 가진 시작 메쉬(사각형 또는 저해상도 그리드 등)를 정의.
- **WebcamModule**
  - `navigator.mediaDevices.getUserMedia({ video: true })`로 미디어 획득.
  - 스트림을 `<video>` 요소에 연결해 추적기가 사용할 수 있게 함.
- **FaceTrackingModule**
  - MediaPipe FaceMesh(또는 동급) 초기화 후 비디오 프레임을 입력.
  - 첫 성공 프레임을 `baseLandmarks`, 최신 프레임을 `currentLandmarks`로 노출.
  - 새 랜드마크 결과를 전달하는 콜백/훅 제공.
- **ExpressionMapper**
  - `currentLandmarks`를 `baseLandmarks`와 비교해 정규화된 파라미터(`smileAmount`, `mouthOpenAmount`, `browRaiseAmount`, `eyeOpenAmountLeft`, `eyeOpenAmountRight`)를 계산.
  - 중립 얼굴 대비 거리로 정규화해 사용자별 얼굴 크기 차이를 보정.
- **AvatarDeformer**
  - UV가 포함된 클립 공간 메쉬 정점을 유지하고, 표정 파라미터에 따라 프레임마다 재계산.
  - 입 정점을 소폭 이동해 미소/입 벌림을, 눈꺼풀 정점을 이동해 깜빡임을, 눈썹 정점을 이동해 놀람/찡그림을 표현.
  - 이동량을 작은 픽셀 범위로 클램프해 아바타 정체성을 보존.
- **WebGLRenderer**
  - 단순 버텍스/프래그먼트 셰이더: position + UV → `u_texture` 샘플링.
  - 매 프레임 변형된 정점으로 버퍼를 갱신하고 텍스처를 바인딩한 뒤 클리어 후 드로우.

## 메인 루프 예시
```javascript
async function main() {
  const gl = setupWebGL(canvas);
  let avatarTexture = await loadAvatarTexture(gl, initialImageUrl);
  const video = await setupWebcam();
  const tracker = await setupFaceMesh(onFaceResults);
  let baseLandmarks = null;
  let currentLandmarks = null;

  function onFaceResults(landmarks) {
    if (!landmarks) return;
    currentLandmarks = landmarks;
    if (!baseLandmarks) {
      baseLandmarks = cloneLandmarks(landmarks);
      initAvatarMeshFromBaseLandmarks(baseLandmarks);
    }
  }

  async function processVideo() {
    await tracker.send({ image: video });
    requestAnimationFrame(processVideo);
  }

  function render() {
    requestAnimationFrame(render);
    if (!baseLandmarks || !currentLandmarks) return;
    const expr = computeExpressionParams(baseLandmarks, currentLandmarks);
    updateAvatarMeshVertices(expr);
    drawAvatar(gl, avatarTexture);
  }

  processVideo();
  render();
}
```

## 리소스 및 장애 대응
- 비디오 해상도를 320–640px로 제한하고, 모바일에서는 `facingMode: "user"`를 요청합니다.
- 추적기가 여러 프레임 동안 얼굴을 놓치면 표현 파라미터를 서서히 중립으로 보간합니다.
- 마지막으로 성공한 아바타 텍스처를 유지하고, 이미지 로드가 실패하면 채팅에 경고를 띄우되 기존 텍스처 렌더링은 계속합니다.
- 아바타 텍스처는 가능하면 **사진풍 정면 초상**을 사용하면 눈·코·입의 위치가 명확해 저해상도 메쉬 변형에서도 안정적인 표정 연동을 얻을 수 있습니다. 필요 시 생성된 정적 이미지를 MediaPipe FaceMesh(정지 모드)로 한 번 분석해 메쉬 시드 포인트를 자동화할 수 있습니다.
