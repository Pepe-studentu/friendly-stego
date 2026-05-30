'use strict';

const express = require('express');
const multer = require('multer');

const codec = require('./codec');
const { toRaw, toPng } = require('./image');
const { frame, TYPE } = require('./payload');

const PORT = process.env.PORT || 3001;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB upload guard

// Stateless: files live in memory only and are never written to disk or logged.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const app = express();

/** Wrap an async route so rejections hit the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true, codec: codec.name }));

/**
 * POST /api/encode
 * multipart: image (file) + message (text field)
 * -> image/png attachment with the message hidden inside.
 */
app.post(
  '/api/encode',
  upload.single('image'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const message = typeof req.body.message === 'string' ? req.body.message : '';

    const { data, info } = await toRaw(req.file.buffer);
    const framed = frame(TYPE.TEXT, Buffer.from(message, 'utf8'));

    const capacity = codec.capacityBytes(info.width, info.height);
    if (framed.length > capacity) {
      return res.status(422).json({
        error: 'This message is a little too big for this photo. Try a larger photo or a shorter note.',
        capacity,
        needed: framed.length,
      });
    }

    const embedded = codec.embed(data, info, framed);
    const png = await toPng(embedded, info);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="encoded.png"');
    res.send(png);
  })
);

/**
 * POST /api/decode
 * multipart: image (file)
 * -> { hasMessage, type, message }
 */
app.post(
  '/api/decode',
  upload.single('image'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    const { data, info } = await toRaw(req.file.buffer);
    const result = codec.extract(data, info);

    if (!result) return res.json({ hasMessage: false });

    const message = result.type === TYPE.TEXT ? result.data.toString('utf8') : null;
    res.json({ hasMessage: true, type: result.type, message });
  })
);

// Centralised error handling — keep messages friendly, never leak internals.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That photo is too large to upload.' });
  }
  return res.status(400).json({ error: 'We could not read that file as an image.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`friendly-stego server listening on http://localhost:${PORT} (codec: ${codec.name})`);
  });
}

module.exports = app;
