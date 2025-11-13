let chatLog = [];
let currentProfile = null;
let oldAvatar = null;
let newAvatar = null;
let blendT = 1;
let inputBox;
let sendBtn;
let isSending = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  inputBox = createInput("");
  positionInputs();

  sendBtn = createButton("Send");
  sendBtn.mousePressed(sendMessage);
  sendBtn.position(inputBox.x + inputBox.width + 10, height - 50);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionInputs();
}

function positionInputs() {
  if (!inputBox) return;
  inputBox.position(20, height - 50);
  inputBox.size(Math.min(360, width - 120));
  if (sendBtn) {
    sendBtn.position(inputBox.x + inputBox.width + 10, height - 50);
  }
}

function draw() {
  background(15);
  drawChat();
  drawAvatar();
}

function drawChat() {
  fill(255);
  textSize(16);
  let y = 30;
  for (let msg of chatLog) {
    const label = msg.from === "user" ? "You" : "Bot";
    text(`${label}: ${msg.text}`, 20, y);
    y += 22;
  }

  if (isSending) {
    text("...생각 중...", 20, y + 10);
  }
}

function drawAvatar() {
  push();
  translate(width * 0.45, 0);
  const targetWidth = width * 0.55;

  if (oldAvatar) {
    tint(255, 255);
    image(oldAvatar, 0, 0, targetWidth, height);
  }

  if (newAvatar) {
    tint(255, blendT * 255);
    image(newAvatar, 0, 0, targetWidth, height);
  }

  if (blendT < 1) {
    blendT += 0.02;
  }

  noTint();
  pop();
}

async function sendMessage() {
  const text = inputBox.value().trim();
  if (!text || isSending) return;

  inputBox.value("");
  chatLog.push({ from: "user", text });
  isSending = true;

  try {
    const res = await fetch("/api/chat-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatLog, currentProfile })
    });

    if (!res.ok) {
      throw new Error("Failed to send message");
    }

    const data = await res.json();
    chatLog.push({ from: "bot", text: data.reply });
    currentProfile = data.profile;

    oldAvatar = newAvatar;
    loadImage(data.imageUrl, (img) => {
      newAvatar = img;
      blendT = 0;
    });
  } catch (error) {
    console.error(error);
    chatLog.push({ from: "bot", text: "앗, 잠시 문제가 생겼어. 다시 시도해 줄래?" });
  } finally {
    isSending = false;
  }
}
