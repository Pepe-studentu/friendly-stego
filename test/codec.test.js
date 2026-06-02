import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as lsb from '../client/src/codec/lsb.js';
import { frame, TYPE } from '../client/src/codec/payload.js';

// Behavioral suite for the steganography core. We don't test internals blindly
// — we test the one contract that matters: a message embedded into pixels comes
// back out identically, and pixels without a valid message report "nothing".
//
// This runs the pure codec on raw RGBA arrays (no canvas/PNG needed). The full
// browser path — canvas getImageData -> toBlob PNG -> reload -> decode — is
// covered end-to-end by the Playwright test.

/** A field of pseudo-random opaque RGBA pixels (deterministic). */
function noisePixels(width, height, seed = 1) {
  const px = new Uint8ClampedArray(width * height * 4);
  let s = seed >>> 0;
  for (let i = 0; i < px.length; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    px[i] = i % 4 === 3 ? 255 : s & 0xff; // opaque alpha
  }
  return px;
}

/** Embed then extract on a fresh pixel field; returns the decoded text or null. */
function roundTrip(width, height, message, seed = 1) {
  const px = noisePixels(width, height, seed);
  const framed = frame(TYPE.TEXT, new TextEncoder().encode(message));
  lsb.embed(px, { width, height }, framed);
  const result = lsb.extract(px, { width, height });
  return result ? new TextDecoder().decode(result.data) : null;
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

test('round-trips many messages across several image sizes', () => {
  const sizes = [[200, 200], [640, 480], [300, 300], [512, 256]];
  for (const [w, h] of sizes) {
    for (const msg of messages) {
      assert.equal(roundTrip(w, h, msg), msg, `failed: ${JSON.stringify(msg.slice(0, 30))}`);
    }
  }
});

test('plain pixels report no message', () => {
  const px = noisePixels(128, 128, 7);
  assert.equal(lsb.extract(px, { width: 128, height: 128 }), null);
});

test('tampered pixels report no message (magic fails)', () => {
  const px = noisePixels(128, 128, 9);
  lsb.embed(px, { width: 128, height: 128 }, frame(TYPE.TEXT, new TextEncoder().encode('secret')));
  for (let i = 0; i < 24; i++) px[i] ^= 1; // corrupt the magic
  assert.equal(lsb.extract(px, { width: 128, height: 128 }), null);
});

test('an over-capacity message is rejected', () => {
  const px = noisePixels(16, 16); // capacity = floor(16*16*3/8) = 96 bytes
  const framed = frame(TYPE.TEXT, new TextEncoder().encode('y'.repeat(500)));
  assert.throws(() => lsb.embed(px, { width: 16, height: 16 }, framed), /too large/i);
});

test('capacity grows with image area', () => {
  assert.equal(lsb.capacityBytes(100, 100), Math.floor((100 * 100 * 3) / 8));
  assert.ok(lsb.capacityBytes(200, 200) > lsb.capacityBytes(100, 100));
});
