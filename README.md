# Stego: little hidden notes

A mobile-first web app for hiding a short text note inside a photo, and revealing
it again. 

## How it works
- **Encode:** upload a photo → write a note → download a PNG with the note hidden in it.
- **Decode:** open a photo in the app → tap it → the card flips to reveal the note.

The note is hidden with fragile **LSB** steganography and the result is always a lossless
**PNG**. 

## Layout
- `server/` — Node + Express. Stateless: processes images in memory, stores nothing.
- `client/` — Vue 3 + Vite + Tailwind. Single central image card and a short encode flow.
- `e2e/` — one Playwright happy-path test through the real UI.

## Develop
Node is provided via nvm; run commands in an nvm-sourced shell.

```bash
npm run install:all   # install server, client, and root deps
npm run dev           # server on :3001, client on :5173 (proxies /api)
```

## Test
```bash
npm run test:server   # behavioral encode/decode round-trip suite
npm run test:e2e      # Playwright happy path (boots both servers)
npm test              # both
```

First time only, install the browser: `npx playwright install chromium`.
