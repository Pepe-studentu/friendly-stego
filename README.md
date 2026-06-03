# Stego: little hidden notes

A mobile-first web app for hiding a short text note inside a photo, and revealing
it again.

## How it works
- **Encode:** upload a photo → write a note → download the photo with the note hidden in it.
- **Decode:** open a photo in the app → tap it → the card flips to reveal the note.

Two hiding methods are chosen automatically by note length, and the output format follows
the method:
- **Robust (DCT/QIM):** survives chat-app recompression (e.g. WhatsApp), so the photo can
  be sent as a normal photo. Used whenever the note fits. Output is a **high-quality JPEG**,
  roughly the size of the original — small enough to send as a chat photo.
- **File (LSB):** perfect and high-capacity, but must be sent as a file/document. Used for
  longer notes that don't fit the robust method. Output is a lossless **PNG** (LSB needs
  exact pixels).

Everything runs in the browser — the app is a static site with no backend, and no photo or
note ever leaves the device.

To verify robustness against real WhatsApp compression, encode a note, send the downloaded
photo through WhatsApp, save the received `.jpg`, and run
`npm run decode:sample -- path/to/received.jpg`.

## Layout
- `client/` — Vue 3 + Vite + Tailwind. The whole app.
  - `src/codec/` — the steganography core (`payload.js`, `lsb.js`), pure JS so it runs in
    the browser and in Node tests. The codec sits behind a small interface, so a more
    robust method could replace LSB later without touching the UI.
  - `src/services/api.js` — runs the codec on a `<canvas>` (encode/decode).
- `test/` — behavioral round-trip test for the codec (`node --test`).
- `e2e/` — one Playwright happy-path test through the real UI.

## Develop
Node is provided via nvm; run commands in an nvm-sourced shell.

```bash
npm run install:all   # install client + root deps
npm run dev           # client on :5173 (also exposed on your LAN for phone testing)
```

## Test
```bash
npm run test:codec    # behavioral encode/decode round-trip suite
npm run test:e2e      # Playwright happy path (boots the dev server)
npm test              # both
```

First time only, install the browser: `npx playwright install chromium`.

## Deploy (free static hosting)
The app builds to plain static files, so any static host serves it for free.

```bash
npm run build         # outputs client/dist/
```

- **Build command:** `npm run build`
- **Publish / output directory:** `client/dist`

Connect the repo to a host like Cloudflare Pages or Netlify with those two settings and
every push deploys automatically to a public link.
