const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const portrait = document.getElementById('portrait');
const portraitImage = document.getElementById('portrait-image');
const callResetButton = document.getElementById('call-reset');
const helpButton = document.getElementById('help-button');
const helpClose = document.getElementById('help-close');
const helpModal = document.getElementById('help-modal');

let messages = [];
let profile = {};
let avatarImageUrl = null;
let lastImagePrompt = '';
let latestImageRequestId = 0;

init();

function init() {
  setPortrait(avatarImageUrl);
  appendBot("Hey there—I'm already on the line with you. What's on your mind?");
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
  const removeTyping = showBotTyping();
  const payload = {
    messages: [...messages, { role: 'user', content: text }],
    currentProfile: profile,
    imageUrl: avatarImageUrl,
    lastImagePrompt
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
    lastImagePrompt = data.imagePrompt || lastImagePrompt;

    appendBot(data.reply);

    if (data.needNewImage && lastImagePrompt) {
      requestAvatarImage(lastImagePrompt);
    } else {
      setPortrait(avatarImageUrl);
    }
  } catch (error) {
    console.error(error);
    appendBot("Looks like the connection glitched. Let's try again in a moment.");
  } finally {
    removeTyping();
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
  const hasImage = Boolean(url);
  portrait.classList.toggle('has-image', hasImage);

  if (hasImage) {
    portraitImage.src = url;
    portraitImage.removeAttribute('hidden');
  } else {
    portraitImage.setAttribute('hidden', 'hidden');
    portraitImage.removeAttribute('src');
  }
}

// [Note] 초기 인사 여러 개 지정해 새로운 사람과 대화하는 것처럼 느껴질 것.
function resetSession() {
  messages = [];
  profile = {};
  avatarImageUrl = null;
  lastImagePrompt = '';
  latestImageRequestId = 0;
  chatLog.innerHTML = '';
  setPortrait(avatarImageUrl);
  appendBot("Hey, I'm here whenever you want to dive in again.");
  chatInput.focus();
}

async function requestAvatarImage(imagePrompt) {
  const requestId = ++latestImageRequestId;
  avatarImageUrl = null;
  setPortrait(null);

  try {
    const response = await fetch('/api/generate-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: imagePrompt })
    });

    if (!response.ok) {
      throw new Error(`Image request failed: ${response.status}`);
    }

    const data = await response.json();

    if (requestId !== latestImageRequestId) return;

    avatarImageUrl = data.imageUrl || null;
    setPortrait(avatarImageUrl);
  } catch (error) {
    console.error(error);
    if (requestId === latestImageRequestId) {
      avatarImageUrl = null;
      setPortrait(null);
    }
  }
}

function openHelp() {
  helpModal.classList.add('open');
  helpModal.setAttribute('aria-hidden', 'false');
}

function closeHelp() {
  helpModal.classList.remove('open');
  helpModal.setAttribute('aria-hidden', 'true');
}

function showBotTyping() {
  const div = document.createElement('div');
  div.className = 'bubble bot typing';

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  div.appendChild(dots);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;

  return () => {
    if (div.parentNode) {
      div.parentNode.removeChild(div);
    }
  };
}
