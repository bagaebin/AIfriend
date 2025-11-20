const path = require('path');
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
  const { messages = [], currentProfile = {}, imageUrl } = req.body || {};

  const mergedProfile = { ...baseProfile, ...currentProfile };
  const prompt = buildPrompt(mergedProfile);
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

    let imageUrlResult = imageUrl || '/avatars/default.svg';
    const shouldCreateImage = designResult.needNewImage && hasOpenAI;

    if (shouldCreateImage) {
      try {
        imageUrlResult = await generateAvatarImage(designResult.imagePrompt);
      } catch (imageError) {
        console.error('Image generation failed, keeping existing avatar.', imageError);
        imageUrlResult = imageUrl || '/avatars/default.svg';
      }
    }

    res.json({
      reply: designResult.reply,
      profile: designResult.profile,
      imagePrompt: designResult.imagePrompt,
      needNewImage: designResult.needNewImage,
      imageUrl: imageUrlResult,
      source: designResult.source || (hasOpenAI ? 'openai' : 'stub'),
      meta: designResult.meta || null
    });
  } catch (error) {
    console.error('Error in /api/chat-avatar', error);
    res.status(500).json({
      reply: '잠시 문제가 발생했어요. 조금 후 다시 시도해 주세요!',
      profile: mergedProfile,
      imagePrompt: prompt,
      needNewImage: false,
      imageUrl: imageUrl || '/avatars/default.svg',
      source: hasOpenAI ? 'openai' : 'stub'
    });
  }
});

function buildPrompt(profile) {
  return `You are a dating app partner and avatar designer. Always respond in Korean with JSON matching:\n\n{
  "reply": "...Korean text...",
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
  "imagePrompt": "English front-facing portrait prompt",
  "needNewImage": true or false
}

Focus on a photorealistic, front-facing portrait with neutral lighting and clear facial features. Current profile for reference:\n${JSON.stringify(profile, null, 2)}`;
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
  const imageResponse = await openai.images.generate({
    model: imageModel,
    prompt: imagePrompt,
    size: '1024x1024'
  });

  const generatedUrl = imageResponse.data?.[0]?.url;
  return generatedUrl || '/avatars/default.svg';
}

function buildStubDesign(profile, fallbackReason = '') {
  const reply = '프로필을 바탕으로 아바타 느낌을 정리했어요. 더 궁금한 점이 있으면 알려줘!';
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
