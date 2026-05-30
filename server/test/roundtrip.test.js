'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const codec = require('../src/codec');
const { toRaw, toPng } = require('../src/image');
const { frame, TYPE } = require('../src/payload');

/**
 * Behavioral suite. We don't test internal methods blindly — we test the one
 * contract that matters: a message embedded into an image must come back out
 * identically, and images without a (valid) message must report "nothing here".
 */

// --- image fixtures -------------------------------------------------------

/** Solid-colour image. */
async function solidImage(width, height, [r, g, b]) {
  return sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

/** Pseudo-random noise image (deterministic for reproducibility). */
async function noiseImage(width, height, seed = 1) {
  const px = Buffer.alloc(width * height * 4);
  let s = seed >>> 0;
  for (let i = 0; i < px.length; i++) {
    // xorshift-ish PRNG, no external deps
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    px[i] = i % 4 === 3 ? 255 : s & 0xff; // opaque alpha
  }
  return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Horizontal gradient image. */
async function gradientImage(width, height) {
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      px[o] = Math.floor((x / width) * 255);
      px[o + 1] = Math.floor((y / height) * 255);
      px[o + 2] = 128;
      px[o + 3] = 255;
    }
  }
  return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// --- helpers --------------------------------------------------------------

/** Full pipeline: take an encoded image + text, return the decoded text (or null). */
async function roundTrip(imageBuffer, message) {
  const { data, info } = await toRaw(imageBuffer);
  const framed = frame(TYPE.TEXT, Buffer.from(message, 'utf8'));
  const embedded = codec.embed(data, info, framed);
  const png = await toPng(embedded, info);

  // decode from the freshly-written PNG, exactly as the server would
  const back = await toRaw(png);
  const result = codec.extract(back.data, back.info);
  return result ? result.data.toString('utf8') : null;
}

const messages = [
  'i love you',
  '',
  'multi\nline\nnote\nwith blank line\n\nend',
  'emoji party 🦕💚✨🎉 with text after',
  'mixed languages: español, français, Ελληνικά, 日本語, العربية, русский',
  'x'.repeat(2000),
  'tabs\tand   spaces and "quotes" and <html>&entities;</html>',
];

// --- tests ----------------------------------------------------------------

test('round-trips many messages across several image types and sizes', async () => {
  const images = [
    await solidImage(200, 200, [10, 20, 30]),
    await solidImage(640, 480, [255, 255, 255]),
    await noiseImage(300, 300, 42),
    await gradientImage(512, 256),
  ];

  for (const img of images) {
    for (const msg of messages) {
      const decoded = await roundTrip(img, msg);
      assert.equal(decoded, msg, `failed to round-trip: ${JSON.stringify(msg.slice(0, 30))}`);
    }
  }
});

test('a plain image reports no message', async () => {
  const img = await gradientImage(128, 128);
  const { data, info } = await toRaw(img);
  assert.equal(codec.extract(data, info), null);
});

test('a tampered image reports no message (magic fails)', async () => {
  const img = await solidImage(128, 128, [50, 60, 70]);
  const { data, info } = await toRaw(img);
  const framed = frame(TYPE.TEXT, Buffer.from('secret', 'utf8'));
  const embedded = codec.embed(data, info, framed);

  // Corrupt the magic by flipping LSBs of the very first channels.
  for (let i = 0; i < 24; i++) embedded[i] ^= 1;

  assert.equal(codec.extract(embedded, info), null);
});

test('an over-capacity message is rejected', async () => {
  const img = await solidImage(16, 16, [0, 0, 0]); // capacity = floor(16*16*3/8) = 96 bytes
  const { data, info } = await toRaw(img);
  const framed = frame(TYPE.TEXT, Buffer.from('y'.repeat(500), 'utf8'));
  assert.throws(() => codec.embed(data, info, framed), /too large/i);
});

test('capacity grows with image area', () => {
  assert.equal(codec.capacityBytes(100, 100), Math.floor((100 * 100 * 3) / 8));
  assert.ok(codec.capacityBytes(200, 200) > codec.capacityBytes(100, 100));
});
