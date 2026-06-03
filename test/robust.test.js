import { test } from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';

import * as dct from '../client/src/codec/dct.js';
import { frame, TYPE } from '../client/src/codec/payload.js';

// Behavioral suite for the robust codec: a note embedded in a photo must survive
// a JPEG recompression (what WhatsApp does) and decode back identically. We
// simulate the adversary with a real JPEG encode/decode round trip (jpeg-js).

/** A smooth, photo-like RGBA image (gradients + gentle texture), opaque. */
function photoLike(width, height) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      px[o] = 90 + 80 * Math.sin(x / 60) + 20 * Math.sin((x + y) / 25);
      px[o + 1] = 110 + 70 * Math.cos(y / 50) + 15 * Math.sin(x / 18);
      px[o + 2] = 130 + 60 * Math.sin((x - y) / 70);
      px[o + 3] = 255;
    }
  }
  return px;
}

/** Embed, JPEG round-trip at the given quality, then extract. */
function throughJpeg(width, height, message, quality) {
  const px = photoLike(width, height);
  const framed = frame(TYPE.TEXT, new TextEncoder().encode(message));
  dct.embed(px, { width, height }, framed);

  const enc = jpeg.encode({ data: px, width, height }, quality);
  const dec = jpeg.decode(enc.data, { formatAsRGBA: true });

  const result = dct.extract(dec.data, { width, height });
  return result ? new TextDecoder().decode(result.data) : null;
}

const note = 'meet me by the big tree at 7 — i love you';

test('survives JPEG recompression across a range of qualities', () => {
  const width = 512;
  const height = 512;
  for (const q of [60, 70, 75, 80, 85, 90]) {
    assert.equal(throughJpeg(width, height, note, q), note, `failed at JPEG quality ${q}`);
  }
});

test('survives JPEG with emoji and multi-language text', () => {
  const msg = 'te iubesc 🦕 — спасибо — ありがとう';
  assert.equal(throughJpeg(640, 480, msg, 80), msg);
});

test('a plain photo reports no robust message', () => {
  const px = photoLike(256, 256);
  assert.equal(dct.extract(px, { width: 256, height: 256 }), null);
});

test('a JPEG of a plain photo reports no robust message (no false positive)', () => {
  const px = photoLike(256, 256);
  const enc = jpeg.encode({ data: px, width: 256, height: 256 }, 80);
  const dec = jpeg.decode(enc.data, { formatAsRGBA: true });
  assert.equal(dct.extract(dec.data, { width: 256, height: 256 }), null);
});

test('a longer note still survives at a typical quality', () => {
  const long = 'My dearest, '.repeat(12) + 'always.'; // ~150 chars
  assert.equal(throughJpeg(640, 640, long, 80), long);
});

test('capacity grows with image area', () => {
  assert.ok(dct.capacityBytes(640, 640) > dct.capacityBytes(256, 256));
});
