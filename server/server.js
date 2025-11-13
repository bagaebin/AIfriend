import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import chatAvatarRouter from "./routes/chatAvatar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/chat-avatar", chatAvatarRouter);

app.use((err, req, res, next) => {
  console.error("Server error", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
