import express from "express";
import { askAvatarModel } from "../services/openaiClient.js";
import { requestTurboImage } from "../services/turboClient.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { messages = [], currentProfile = null } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const gptResult = await askAvatarModel(messages, currentProfile);
    const { reply, profile, imagePrompt } = gptResult;

    const imageUrl = await requestTurboImage(imagePrompt);

    res.json({ reply, profile, imageUrl });
  } catch (error) {
    console.error("/api/chat-avatar error", error);
    res.status(500).json({ error: "Chat avatar error" });
  }
});

export default router;
