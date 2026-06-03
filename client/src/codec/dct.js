// Robust steganography codec: survives a JPEG recompression (e.g. WhatsApp).
//
// Bits are hidden in mid-frequency 8x8 DCT coefficients of the luma plane using
// QIM (quantization index modulation). Robustness comes from massive redundancy:
// the payload is repeated to fill the image and spread by a seeded interleaver,
// then combined with soft decisions on extraction. A 16-bit sync word + CRC32
// let us recognise a valid message (and reject ordinary photos).
//
// Same interface as the LSB codec, so it drops into the canvas service:
//   { name, capacityBytes(w,h), embed(rgba, info, framed), extract(rgba, info) }

import { fdct8, idct8 } from './dsp/dct.js';
import { lumaPlane, applyLumaDelta } from './dsp/color.js';
import { permutation } from './dsp/prng.js';
import { crc32 } from './dsp/crc32.js';
import { HEADER_BYTES, parseHeader } from './payload.js';

export const name = 'dct';

// --- tunable parameters (defaults; tuning tests may override via opts) -------
const DEFAULTS = {
  delta: 18, // QIM step; larger = more robust but more visible
  seed: 0xc0ffee, // interleaver seed (shared by encode/decode)
  // mid-frequency coefficient positions [row, col] within an 8x8 block
  coeffs: [
    [1, 2], [2, 1], [2, 2],
    [0, 3], [3, 0], [1, 3],
  ],
  headerFraction: 0.25, // share of slots reserved for the (heavily repeated) header
};

const SYNC = 0xdc57; // 16-bit marker that a robust payload is present
const HEADER_BITS = 32; // 16-bit sync + 16-bit coded-length (bytes)
const BLOCK = 8;

function opts(o) {
  return { ...DEFAULTS, ...(o || {}) };
}

function flatCoeffs(coeffs) {
  return coeffs.map(([r, c]) => r * BLOCK + c);
}

/** Fixed geometry derived from image size + config (identical at both ends). */
function geometry(width, height, o) {
  const bx = Math.floor(width / BLOCK);
  const by = Math.floor(height / BLOCK);
  const blocks = bx * by;
  const perBlock = o.coeffs.length;
  const S = blocks * perBlock; // total bit slots
  const Rh = Math.max(1, Math.floor((S * o.headerFraction) / HEADER_BITS));
  const usedH = Rh * HEADER_BITS;
  const Ps = S - usedH; // payload slots
  return { bx, by, blocks, perBlock, S, Rh, usedH, Ps };
}

/** Max framed (payload.frame) bytes this image can robustly hold. */
export function capacityBytes(width, height, o) {
  const cfg = opts(o);
  const { Ps } = geometry(width, height, cfg);
  return Math.max(0, Math.floor(Ps / 8) - 4); // reserve 4 bytes for CRC32
}

// --- QIM ---------------------------------------------------------------------
function qimEmbed(c, bit, delta) {
  let k = Math.round(c / delta);
  if ((((k % 2) + 2) % 2) !== bit) k += c / delta - k >= 0 ? 1 : -1;
  return k * delta;
}

/** Soft decision: >0 favours bit 0, <0 favours bit 1. */
function qimSoft(c, delta) {
  const p = c / delta;
  const even = 2 * Math.round(p / 2);
  const odd = 2 * Math.round((p - 1) / 2) + 1;
  return Math.abs(p - odd) - Math.abs(p - even);
}

// --- embed -------------------------------------------------------------------
export function embed(rgba, info, framed, o) {
  const cfg = opts(o);
  const { width, height } = info;
  const g = geometry(width, height, cfg);
  const flats = flatCoeffs(cfg.coeffs);

  // coded = framed + CRC32(framed)
  const crc = crc32(framed);
  const coded = new Uint8Array(framed.length + 4);
  coded.set(framed, 0);
  coded[framed.length] = (crc >>> 24) & 0xff;
  coded[framed.length + 1] = (crc >>> 16) & 0xff;
  coded[framed.length + 2] = (crc >>> 8) & 0xff;
  coded[framed.length + 3] = crc & 0xff;

  const C = coded.length * 8;
  if (C > g.Ps) throw new Error('Message too large for robust encoding');

  // logical bit per slot
  const logical = new Uint8Array(g.S);
  // header region: [SYNC(16) | codedLen(16)] repeated Rh times
  const hdr = new Uint8Array(HEADER_BITS);
  writeBits(hdr, 0, SYNC, 16);
  writeBits(hdr, 16, coded.length, 16);
  for (let i = 0; i < g.usedH; i++) logical[i] = hdr[i % HEADER_BITS];
  // payload region: coded bits repeated to fill
  const Rp = Math.floor(g.Ps / C);
  for (let idx = 0; idx < g.Ps; idx++) {
    logical[g.usedH + idx] = idx < Rp * C ? (coded[Math.floor((idx % C) / 8)] >> (7 - ((idx % C) % 8))) & 1 : 0;
  }

  // scatter logical -> physical slots
  const perm = permutation(g.S, cfg.seed);
  const physical = new Uint8Array(g.S);
  for (let i = 0; i < g.S; i++) physical[perm[i]] = logical[i];

  // embed per block on the luma plane
  const oldY = lumaPlane(rgba, width, height);
  const newY = Float64Array.from(oldY);
  const block = new Float64Array(64);
  const coeffs = new Float64Array(64);
  for (let b = 0; b < g.blocks; b++) {
    const ox = (b % g.bx) * BLOCK;
    const oy = Math.floor(b / g.bx) * BLOCK;
    for (let yy = 0; yy < BLOCK; yy++)
      for (let xx = 0; xx < BLOCK; xx++) block[yy * BLOCK + xx] = oldY[(oy + yy) * width + (ox + xx)];

    fdct8(block, coeffs);
    for (let c = 0; c < g.perBlock; c++) {
      const bit = physical[b * g.perBlock + c];
      const pos = flats[c];
      coeffs[pos] = qimEmbed(coeffs[pos], bit, cfg.delta);
    }
    idct8(coeffs, block);

    for (let yy = 0; yy < BLOCK; yy++)
      for (let xx = 0; xx < BLOCK; xx++) newY[(oy + yy) * width + (ox + xx)] = block[yy * BLOCK + xx];
  }

  applyLumaDelta(rgba, newY, oldY);
  return rgba;
}

// --- extract -----------------------------------------------------------------
export function extract(rgba, info, o) {
  const cfg = opts(o);
  const { width, height } = info;
  const g = geometry(width, height, cfg);
  if (g.Ps < 8) return null;
  const flats = flatCoeffs(cfg.coeffs);

  // soft value per physical slot
  const softPhysical = new Float64Array(g.S);
  const Y = lumaPlane(rgba, width, height);
  const block = new Float64Array(64);
  const coeffs = new Float64Array(64);
  for (let b = 0; b < g.blocks; b++) {
    const ox = (b % g.bx) * BLOCK;
    const oy = Math.floor(b / g.bx) * BLOCK;
    for (let yy = 0; yy < BLOCK; yy++)
      for (let xx = 0; xx < BLOCK; xx++) block[yy * BLOCK + xx] = Y[(oy + yy) * width + (ox + xx)];
    fdct8(block, coeffs);
    for (let c = 0; c < g.perBlock; c++) softPhysical[b * g.perBlock + c] = qimSoft(coeffs[flats[c]], cfg.delta);
  }

  // gather physical -> logical
  const perm = permutation(g.S, cfg.seed);
  const softLogical = new Float64Array(g.S);
  for (let i = 0; i < g.S; i++) softLogical[i] = softPhysical[perm[i]];

  // recover header (sync + length)
  const hAcc = new Float64Array(HEADER_BITS);
  for (let r = 0; r < g.Rh; r++) for (let k = 0; k < HEADER_BITS; k++) hAcc[k] += softLogical[r * HEADER_BITS + k];
  const hdrBits = hAcc.map((v) => (v > 0 ? 0 : 1));
  if (readBits(hdrBits, 0, 16) !== SYNC) return null;
  const codedLen = readBits(hdrBits, 16, 16);
  const C = codedLen * 8;
  if (codedLen < HEADER_BYTES + 4 || C > g.Ps) return null;

  // recover payload (soft-combine all repetitions)
  const Rp = Math.floor(g.Ps / C);
  if (Rp < 1) return null;
  const pAcc = new Float64Array(C);
  for (let r = 0; r < Rp; r++) {
    const base = g.usedH + r * C;
    for (let k = 0; k < C; k++) pAcc[k] += softLogical[base + k];
  }
  const coded = new Uint8Array(codedLen);
  for (let k = 0; k < C; k++) if (pAcc[k] <= 0) coded[k >> 3] |= 1 << (7 - (k & 7));

  // verify CRC, then parse the inner frame
  const framed = coded.subarray(0, codedLen - 4);
  const crcRead = ((coded[codedLen - 4] << 24) | (coded[codedLen - 3] << 16) | (coded[codedLen - 2] << 8) | coded[codedLen - 1]) >>> 0;
  if (crc32(framed) !== crcRead) return null;

  const header = parseHeader(framed);
  if (!header.magicOk || HEADER_BYTES + header.length > framed.length) return null;
  return { type: header.type, data: framed.subarray(HEADER_BYTES, HEADER_BYTES + header.length) };
}

// --- bit helpers (MSB-first) -------------------------------------------------
function writeBits(arr, offset, value, nbits) {
  for (let i = 0; i < nbits; i++) arr[offset + i] = (value >> (nbits - 1 - i)) & 1;
}
function readBits(arr, offset, nbits) {
  let v = 0;
  for (let i = 0; i < nbits; i++) v = (v << 1) | (arr[offset + i] & 1);
  return v >>> 0;
}
