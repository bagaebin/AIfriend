const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
const chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const allowedOrigin = process.env.ALLOWED_ORIGIN || null;

const openai = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
console.log(`[config] OpenAI key ${hasOpenAIKey ? 'detected' : 'missing; using stub responses'}`);
console.log(`[config] Chat model: ${chatModel}, Image model: ${imageModel}`);
if (allowedOrigin) {
  console.log(`[config] CORS limited to: ${allowedOrigin}`);
}

const baseProfile = {
  nickname: 'Lumen',
  personalityVibe: 'playful and curious',
  hair: 'medium-length with soft highlights',
  face: 'friendly, softly lit portrait',
  clothing: 'casual, light streetwear',
  background: 'subtle studio bokeh',
  colorPalette: 'warm pastels with teal accents',
  camera: 'portrait',
  extraNotes: 'maintain clear facial features for rigging'
};

const corsOptions = allowedOrigin ? { origin: allowedOrigin } : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    openai: hasOpenAIKey,
    chatModel,
    imageModel,
    allowedOrigin: allowedOrigin || '*'
  });
});

app.post('/api/chat-avatar', async (req, res) => {
  const { messages = [], currentProfile = {}, imageUrl = null, lastImagePrompt = '' } = req.body || {};

  const mergedProfile = { ...baseProfile, ...currentProfile };
  const prompt = buildPrompt(mergedProfile, lastImagePrompt);
  const hasOpenAI = Boolean(openai);

  try {
    let designResult;
    try {
      designResult = hasOpenAI
        ? await fetchDesignFromOpenAI(prompt, messages)
        : buildStubDesign(mergedProfile);
    } catch (designError) {
      console.error('Design step failed, falling back to stub.', designError);
      designResult = buildStubDesign(mergedProfile, designError.message);
    }

    const needNewImage = designResult.needNewImage && hasMeaningfulPromptChange(lastImagePrompt, designResult.imagePrompt);
    const forceFirstImage = !imageUrl;
    const shouldGenerateImage = hasOpenAI && (forceFirstImage || needNewImage);

    let nextImageUrl = imageUrl;
    let meta = designResult.meta || null;

    if (shouldGenerateImage) {
      try {
        nextImageUrl = await generateAvatarImage(designResult.imagePrompt);
      } catch (imageError) {
        console.error('Image generation failed; keeping previous image.', imageError);
        meta = {
          ...(meta || {}),
          imageError: imageError.message || 'image generation failed'
        };
      }
    }

    res.json({
      reply: designResult.reply,
      profile: designResult.profile,
      imagePrompt: designResult.imagePrompt,
      needNewImage: shouldGenerateImage ? false : needNewImage,
      imageUrl: nextImageUrl,
      source: designResult.source || (hasOpenAI ? 'openai' : 'stub'),
      meta
    });
  } catch (error) {
    console.error('Error in /api/chat-avatar', error);
    res.status(500).json({
      reply: 'Something went wrong, but I am still here. Can we try that again in a moment?',
      profile: mergedProfile,
      imagePrompt: prompt,
      needNewImage: false,
      imageUrl,
      source: hasOpenAI ? 'openai' : 'stub'
    });
  }
});

app.post('/api/generate-avatar', async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'image prompt is required' });
  }

  if (!openai) {
    return res.status(200).json({ imageUrl: null, source: 'stub', error: 'image generation unavailable' });
  }

  try {
    const imageUrl = await generateAvatarImage(prompt);
    res.json({ imageUrl, source: 'openai' });
  } catch (error) {
    console.error('Error generating avatar image', error);
    res.status(500).json({ error: 'avatar generation failed' });
  }
});

function buildPrompt(profile, lastImagePrompt = '') {
  return `You are already on a call and greeted the other person once. Continue the conversation naturally without repeating introductions, even if they greet again. Speak only in English, in a natural and warm dating tone, and never mention image generation, prompts, or avatars. Your only output must be valid JSON in this exact shape:\n\n{
  "reply": "...natural English chat reply...",
  "profile": {
    "nickname": "...",
    "personalityVibe": "...",
    "hair": "...",
    "face": "...",
    "clothing": "...",
    "background": "...",
    "colorPalette": "...",
    "camera": "portrait | half-body | bust",
    "extraNotes": "..."
  },
  "imagePrompt": "English front-facing portrait prompt based on the chat, invisible to the user",
  "needNewImage": true | false
}

Rules:\n- Keep \"reply\" to 2-4 short, friendly sentences as if on a relaxed video call.\n- Avoid meta language about AI, rendering, or images.\n- Do not greet like it's the first meeting again; pick up the thread naturally even if the user just said hi.\n- Still update the \"profile\" fields to reflect the personality and look implied by the chat.\n- Build \"imagePrompt\" in English for a photorealistic, front-facing or bust portrait with neutral lighting and clear features; this prompt is not shown to the user.\n- Set needNewImage to true only when the appearance meaningfully changes enough to warrant a fresh portrait.\n- If the new imagePrompt is essentially the same as the previous one, set needNewImage to false.\n\nPrevious image prompt for reference (may be empty):\n${lastImagePrompt}\n\nCurrent profile reference:\n${JSON.stringify(profile, null, 2)}`;
}

function hasMeaningfulPromptChange(previousPrompt = '', nextPrompt = '') {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const prev = normalize(previousPrompt);
  const next = normalize(nextPrompt);

  if (!next) return false;
  if (!prev) return true;

  return prev !== next;
}

async function fetchDesignFromOpenAI(prompt, messages) {
  const systemMessage = { role: 'system', content: prompt };
  const chatMessages = [systemMessage, ...messages.map((m) => ({ role: m.role || 'user', content: m.content }))];

  const completion = await openai.chat.completions.create({
    model: chatModel,
    messages: chatMessages,
    response_format: { type: 'json_object' }
  });

  const rawContent = completion.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON: ${error.message}. Raw content: ${rawContent}`);
  }
  return {
    reply: parsed.reply,
    profile: parsed.profile,
    imagePrompt: parsed.imagePrompt,
    needNewImage: Boolean(parsed.needNewImage),
    source: 'openai'
  };
}

async function generateAvatarImage(imagePrompt) {
  console.log('[avatar] requesting image with model:', imageModel);

  try {
    const imageResponse = await openai.images.generate({
      model: imageModel,              // 예: 'gpt-image-1'
      prompt: imagePrompt,
      size: '1024x1024',
      // 2711 error 해결
      // response_format: 'b64_json',
    });

    const data0 = imageResponse.data?.[0];
    const b64 = data0?.b64_json;

    if (!b64) {
      console.error('[avatar] No b64_json in imageResponse:', JSON.stringify(imageResponse, null, 2));
      return null;
    }

    const buffer = Buffer.from(b64, 'base64');
    const fileName = `avatar-${Date.now()}.png`;
    const avatarsDir = path.join(__dirname, 'public', 'avatars');

    await fs.promises.mkdir(avatarsDir, { recursive: true });
    const filePath = path.join(avatarsDir, fileName);
    await fs.promises.writeFile(filePath, buffer);

    console.log('[avatar] wrote file:', filePath);
    return `/avatars/${fileName}`;
  } catch (err) {
    console.error('[avatar] OpenAI image error:', err);
    throw err;
  }
}

// 2711
// async function generateAvatarImage(imagePrompt) {
//   const imageResponse = await openai.images.generate({
//     model: imageModel,
//     prompt: imagePrompt,
//     size: '1024x1024',
//     response_format: 'b64_json'
//   });

//   const b64 = imageResponse.data?.[0]?.b64_json;
//   if (!b64) return null;

//   const buffer = Buffer.from(b64, 'base64');
//   const fileName = `avatar-${Date.now()}.png`;
//   const avatarsDir = path.join(__dirname, 'public', 'avatars');
//   await fs.promises.mkdir(avatarsDir, { recursive: true });
//   const filePath = path.join(avatarsDir, fileName);
//   await fs.promises.writeFile(filePath, buffer);

//   return `/avatars/${fileName}`;
// }

function buildStubDesign(profile, fallbackReason = '') {
  const reply = "I lost the connection for a moment, but let's keep chatting. How are you feeling right now?";
  const profileUpdate = {
    ...profile,
    personalityVibe: profile.personalityVibe || 'kind and upbeat',
    extraNotes: `${profile.extraNotes || ''} photorealistic, front-facing portrait, soft studio light`.trim()
  };

  return {
    reply,
    profile: profileUpdate,
    imagePrompt: 'Photorealistic, front-facing portrait, neutral soft light, clear facial features, studio background, VTuber-ready texture',
    needNewImage: true,
    source: 'stub',
    meta: fallbackReason ? { fallbackReason } : undefined
  };
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
