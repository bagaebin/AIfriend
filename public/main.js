const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const portraitImage = document.getElementById('portrait-image');
const callResetButton = document.getElementById('call-reset');
const helpButton = document.getElementById('help-button');
const helpClose = document.getElementById('help-close');
const helpModal = document.getElementById('help-modal');

let messages = [];
let profile = {};
let avatarImageUrl = '/avatars/default.svg';

init();

function init() {
  setPortrait(avatarImageUrl);
  appendBot('Hello');
  chatForm.addEventListener('submit', handleSubmit);
  callResetButton.addEventListener('click', resetSession);
  helpButton.addEventListener('click', openHelp);
  helpClose.addEventListener('click', closeHelp);
  helpModal.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal__backdrop')) closeHelp();
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  appendUser(text);
  chatInput.value = '';
  await sendToServer(text);
}

async function sendToServer(text) {
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
    profile = data.profile || profile;
    avatarImageUrl = data.imageUrl || avatarImageUrl;

    appendBot(data.reply);
    setPortrait(avatarImageUrl);
  } catch (error) {
    console.error(error);
    appendBot('지금은 연결이 불안정한가 봐. 잠시 뒤에 다시 이야기해 볼까?');
  }
}

function appendUser(text) {
  messages.push({ role: 'user', content: text });
  addBubble('user', text);
}

function appendBot(text) {
  messages.push({ role: 'assistant', content: text });
  addBubble('bot', text);
}

function addBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setPortrait(url) {
  portraitImage.src = url;
}

// [Note] 초기 인사 여러 개 지정해 새로운 사람과 대화하는 것처럼 느껴질 것.
function resetSession() {
  messages = [];
  profile = {};
  avatarImageUrl = '/avatars/default.svg';
  chatLog.innerHTML = '';
  setPortrait(avatarImageUrl);
  appendBot('Hi');
  chatInput.focus();
}

function openHelp() {
  helpModal.classList.add('open');
  helpModal.setAttribute('aria-hidden', 'false');
}

function closeHelp() {
  helpModal.classList.remove('open');
  helpModal.setAttribute('aria-hidden', 'true');
}
