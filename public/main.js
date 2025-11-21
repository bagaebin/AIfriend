const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const statusEl = document.getElementById('status');
const profileEl = document.getElementById('profile');
const canvas = document.getElementById('avatar-canvas');
const video = document.getElementById('webcam');
const eventFeed = document.getElementById('event-feed');
const affinityBar = document.getElementById('affinity-bar');
const affinityValue = document.getElementById('affinity-value');
const energyBar = document.getElementById('energy-bar');
const energyValue = document.getElementById('energy-value');
const vibeChips = document.getElementById('vibe-chips');
const objectiveList = document.getElementById('objective-list');
const stageLabel = document.getElementById('stage-label');

let messages = [];
let profile = {};
let avatarImageUrl = '/avatars/default.svg';
let avatarTexture = null;
let renderer = null;
let expressionSource = null;

const objectives = [
  { id: 'intro', label: '서로 자기소개 주고받기', done: false },
  { id: 'interest', label: '취향 2가지 공유하기', done: false },
  { id: 'plan', label: '데이트 분위기 정하기', done: false }
];

const gameState = {
  affinity: 32,
  energy: 70,
  stage: 1,
  tags: ['부드러운 조명', '포토 리얼 텍스처', '가벼운 아이스브레이킹'],
  events: ['게임을 시작했어요. 대화를 입력해보세요!']
};

init();

async function init() {
  await hydrateHealthStatus();
  renderer = setupRenderer(canvas);
  await loadAvatarTexture(avatarImageUrl);
  expressionSource = await setupExpressionSource(video);
  startRenderLoop();
  appendBot('안녕하세요! 취향을 알려주시면 아바타 스타일을 맞춰볼게요.');
  updateGameUI();
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  appendUser(text);
  chatInput.value = '';
  await sendToServer(text);
});

async function sendToServer(text) {
  setStatus('Calling API...');
  const payload = {
    messages: [...messages, { role: 'user', content: text }],
    currentProfile: profile,
    imageUrl: avatarImageUrl
  };

  try {
    const response = await fetch('/api/chat-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    messages.push({ role: 'user', content: text });
    messages.push({ role: 'assistant', content: data.reply });

    profile = data.profile || profile;
    avatarImageUrl = data.imageUrl || avatarImageUrl;

    appendBot(data.reply);
    renderProfile(profile);
    await loadAvatarTexture(avatarImageUrl);
    setStatus(data.source === 'openai' ? 'Ready · OpenAI live' : 'Ready · stub mode');
    if (data.meta?.fallbackReason) {
      pushEvent('시스템: OpenAI 호출 실패, 스텁으로 대체됨.');
    }
    applyGameLoop(text, data.reply);
  } catch (error) {
    console.error(error);
    appendBot('서버 호출에 실패했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    setStatus('Ready');
  }
}

function appendUser(text) {
  messages.push({ role: 'user', content: text });
  addBubble('user', text);
  pushEvent('당신: ' + text);
  applyGameLoop(text);
}

function appendBot(text) {
  addBubble('bot', text);
  pushEvent('아바타: ' + text);
}

function addBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderProfile(data = {}) {
  profileEl.innerHTML = '';
  const entries = Object.entries(data);
  if (!entries.length) return;

  entries.forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'profile__item';
    const label = document.createElement('span');
    label.textContent = key;
    const content = document.createElement('div');
    content.textContent = value;
    item.append(label, content);
    profileEl.appendChild(item);
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function pushEvent(text) {
  gameState.events.unshift(text);
  gameState.events = gameState.events.slice(0, 4);
  eventFeed.innerHTML = gameState.events.map((e) => `<div class="event-feed__item">${e}</div>`).join('');
}

function applyGameLoop(userText = '', botReply = '') {
  const sentimentBoost = computeAffinityDelta(userText, botReply);
  gameState.affinity = clamp(gameState.affinity + sentimentBoost, 0, 100);
  gameState.energy = clamp(gameState.energy - Math.max(userText.length / 120, 0.3), 0, 100);
  updateObjectives();
  updateStage();
  updateGameUI();
}

function computeAffinityDelta(userText, botReply) {
  const positiveHints = ['좋아', '멋', '고마', '행복', '재밌', '흥미', '설레'];
  const negativeHints = ['싫', '피곤', '바빠', '힘들'];
  let delta = 1;

  const normalized = (userText || '').toLowerCase();
  positiveHints.forEach((hint) => {
    if (normalized.includes(hint)) delta += 3;
  });
  negativeHints.forEach((hint) => {
    if (normalized.includes(hint)) delta -= 2;
  });

  if ((botReply || '').length > 120) delta += 1;
  if (userText.length > 80) delta += 1;
  return delta;
}

function updateObjectives() {
  objectives.forEach((obj) => {
    if (obj.id === 'intro' && messages.some((m) => m.content?.length > 0)) obj.done = true;
    if (obj.id === 'interest' && messages.filter((m) => m.role === 'user').length >= 3) obj.done = true;
    if (obj.id === 'plan' && gameState.affinity >= 75) obj.done = true;
  });
}

function updateStage() {
  if (gameState.affinity >= 75) gameState.stage = 3;
  else if (gameState.affinity >= 45) gameState.stage = 2;
  else gameState.stage = 1;

  stageLabel.textContent =
    gameState.stage === 3
      ? 'Stage 3 · 분위기 확정!'
      : gameState.stage === 2
      ? 'Stage 2 · 서로 알아가는 중'
      : 'Stage 1 · 첫 대화';
}

function updateGameUI() {
  affinityBar.style.width = `${gameState.affinity}%`;
  affinityValue.textContent = `${Math.round(gameState.affinity)}%`;
  energyBar.style.width = `${gameState.energy}%`;
  energyValue.textContent = `${Math.round(gameState.energy)}%`;

  vibeChips.innerHTML = '';
  gameState.tags.forEach((tag) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = tag;
    vibeChips.appendChild(chip);
  });

  objectiveList.innerHTML = '';
  objectives.forEach((obj) => {
    const li = document.createElement('li');
    li.className = `objective ${obj.done ? 'objective--done' : ''}`;
    li.innerHTML = `<div class="objective__check">${obj.done ? '✓' : ''}</div><div>${obj.label}</div>`;
    objectiveList.appendChild(li);
  });
}

async function hydrateHealthStatus() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('health check failed');
    const data = await res.json();
    const status = data.openai ? 'Ready · OpenAI live' : 'Ready · stub mode';
    setStatus(status);
    pushEvent(`시스템: 서버 준비 완료 (${status}).`);
    if (data.allowedOrigin && data.allowedOrigin !== '*') {
      pushEvent(`시스템: CORS 허용 도메인 ${data.allowedOrigin}`);
    }
  } catch (error) {
    console.warn('Health check failed', error);
    setStatus('Health check failed');
    pushEvent('시스템: 서버 헬스 체크에 실패했습니다.');
  }
}

async function setupExpressionSource(videoEl) {
  try {
    await setupWebcam(videoEl);
    const mediaPipeAvailable = Boolean(window.FaceLandmarker && window.FilesetResolver && window.VisionTaskRunner);
    if (!mediaPipeAvailable) {
      console.info('MediaPipe Tasks not detected; using stub expression source.');
      return createStubExpressionSource();
    }
    console.info('MediaPipe detected; initializing face tracking.');
    return await createMediaPipeExpressionSource(videoEl);
  } catch (error) {
    console.warn('Webcam unavailable, using stub expression source.', error);
    return createStubExpressionSource();
  }
}

async function setupWebcam(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  videoEl.srcObject = stream;
  await videoEl.play();
  return videoEl;
}

function createStubExpressionSource() {
  const expression = { mouthOpen: 0.0, eyeOpen: 1.0 };

  function tick() {
    const t = Date.now() / 500;
    expression.mouthOpen = 0.25 + 0.15 * Math.sin(t);
    expression.eyeOpen = 0.8 + 0.1 * Math.cos(t * 0.7);
    requestAnimationFrame(tick);
  }

  tick();
  return {
    getExpression: () => expression
  };
}

function setupRenderer(canvasEl) {
  const gl = canvasEl.getContext('webgl');
  if (!gl) {
    setStatus('WebGL not supported');
    return null;
  }

  const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;
    void main() {
      v_uv = a_uv;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;
    void main() {
      gl_FragColor = texture2D(u_texture, v_uv);
    }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const uvLocation = gl.getAttribLocation(program, 'a_uv');

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const basePositions = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, basePositions, gl.DYNAMIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  const uvs = new Float32Array([
    0, 1,
    1, 1,
    0, 0,
    1, 0
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(uvLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

  gl.clearColor(0.05, 0.08, 0.15, 1);

  return {
    gl,
    program,
    positionBuffer,
    basePositions,
    draw(mouthOpen) {
      if (!avatarTexture) return;
      const clamped = Math.min(Math.max(mouthOpen, 0), 1);
      const offset = clamped * 0.12;
      const positions = new Float32Array([
        -1, -1 + offset,
        1, -1 + offset,
        -1, 1,
        1, 1
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, avatarTexture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSrc);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(vertexShader));
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSrc);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(fragmentShader));
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  return program;
}

async function loadAvatarTexture(url) {
  if (!renderer || !renderer.gl) return;
  const gl = renderer.gl;

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  try {
    const image = await loadImage(url);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    avatarTexture = texture;
  } catch (error) {
    console.warn('Avatar image failed to load, reverting to default.', error);
    pushEvent('시스템: 아바타 이미지를 불러오지 못해 기본 이미지로 복원합니다.');
    if (url !== '/avatars/default.svg') {
      await loadAvatarTexture('/avatars/default.svg');
    }
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function startRenderLoop() {
  function frame() {
    requestAnimationFrame(frame);
    if (!renderer) return;
    const expr = expressionSource ? expressionSource.getExpression() : { mouthOpen: 0 };
    renderer.draw(expr.mouthOpen || 0);
  }
  requestAnimationFrame(frame);
}

async function createMediaPipeExpressionSource(videoEl) {
  const vision = await window.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm'
  );
  const faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
      delegate: 'GPU'
    },
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO'
  });

  const expression = { mouthOpen: 0, eyeOpen: 1 };

  async function tick() {
    if (videoEl.readyState >= 2) {
      const timestamp = performance.now();
      const result = await faceLandmarker.detectForVideo(videoEl, timestamp);
      const mouthOpen = readMouthOpen(result);
      const eyeOpen = readEyeOpen(result);
      expression.mouthOpen = mouthOpen;
      expression.eyeOpen = eyeOpen;
    }
    requestAnimationFrame(tick);
  }

  tick();
  return {
    getExpression: () => expression
  };
}

function readMouthOpen(result) {
  const blend = result?.faceBlendshapes?.[0]?.categories || [];
  const open = blend.find((c) => c.categoryName === 'mouthOpen');
  return open ? open.score : 0;
}

function readEyeOpen(result) {
  const blend = result?.faceBlendshapes?.[0]?.categories || [];
  const leftBlink = blend.find((c) => c.categoryName === 'eyeBlinkLeft');
  const rightBlink = blend.find((c) => c.categoryName === 'eyeBlinkRight');
  const blink = Math.max(leftBlink?.score || 0, rightBlink?.score || 0);
  return 1 - blink;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
