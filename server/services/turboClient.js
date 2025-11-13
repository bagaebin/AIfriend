import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEN_DIR = path.join(__dirname, "..", "..", "public", "assets", "generated");

function ensureGenDir() {
  if (!fs.existsSync(GEN_DIR)) {
    fs.mkdirSync(GEN_DIR, { recursive: true });
  }
}

export async function requestTurboImage(prompt) {
  ensureGenDir();
  const res = await fetch("http://localhost:8000/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    throw new Error(`Turbo server error: ${res.status}`);
  }

  const { image_base64 } = await res.json();
  if (!image_base64) {
    throw new Error("Turbo server did not return image data");
  }

  const buffer = Buffer.from(image_base64, "base64");
  const filename = `avatar_${uuidv4()}.png`;
  const filepath = path.join(GEN_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  return `/assets/generated/${filename}`;
}
