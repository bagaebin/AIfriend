# Deployment & Domain Publishing Guide

## Prerequisites
- Node.js 18+
- `.env` at repo root with `OPENAI_API_KEY`, optional `OPENAI_CHAT_MODEL`, `OPENAI_IMAGE_MODEL`, and `PORT`.
- (Optional) `ALLOWED_ORIGIN` for production CORS hardening (e.g., `https://yourdomain.com`).

## Local smoke test
1. Install dependencies: `npm install`.
2. Run the server: `npm start` (serves static UI + API on `PORT`, default `3000`).
3. Verify health: `curl http://localhost:3000/api/health` → should show `openai: true` when the key is loaded.
4. Open `http://localhost:3000` in the browser and send a chat message; the status badge will indicate whether OpenAI is live or stubbed.

## Publishing on a domain
- Host this repo on a VM/container and keep the Node process alive (pm2/systemd/docker).
- Put a reverse proxy (Nginx/Caddy/Cloudflare Tunnel) in front of the Node server:
  - Terminate TLS so the browser can access camera APIs over HTTPS.
  - Forward `/<assets>` and `/api/*` to the Node backend (default upstream `http://127.0.0.1:3000`).
  - Set `ALLOWED_ORIGIN=https://yourdomain.com` to lock down CORS in production.
- If serving from a subpath, keep the reverse proxy rewriting to `/` so the relative asset paths (e.g., `/avatars/<generated>.png`, `/api/chat-avatar`) remain valid.

## Troubleshooting "no AI response"
- Hit `GET /api/health`; if `openai` is `false`, the backend is in stub mode (no key or key not loaded). Ensure `.env` is in the same directory as `server.js` and restart the server.
- Check server logs for `Design step failed` or `Image generation failed` messages. The frontend event feed will also show when it falls back to stub responses.
- Confirm outbound internet access to the OpenAI API from your server. If blocked, only stub replies will appear and no new avatar images will be generated.
- When deploying behind HTTPS, confirm the domain matches `ALLOWED_ORIGIN`; otherwise CORS will reject calls from the browser.

## Minimal production checklist
- HTTPS enabled on your domain.
- `.env` loaded with a valid `OPENAI_API_KEY`.
- `ALLOWED_ORIGIN` set to your site’s URL.
- Background process manager running `npm start`.
- Reverse proxy forwarding `/` and `/api/*` to the Node server.
