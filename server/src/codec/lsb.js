'use strict';

const { HEADER_BYTES, parseHeader } = require('../payload');

/**
 * Fragile LSB steganography codec.
 *
 * Hides bytes in the least-significant bit of the R, G, B channels of a raw
 * RGBA pixel buffer (alpha is left untouched so transparency is preserved and
 * we avoid surprising some viewers). One bit per channel byte, row-major.
 *
 * This is the swappable codec interface. Any replacement (e.g. a robust DCT
 * codec) must expose the same shape:
 *   { name, capacityBytes(w, h), embed(raw, info, framedBuf), extract(raw, info) }
 * and follow the same extract contract: read the header first to learn the
 * payload length, then read exactly that many more bytes.
 */

const USABLE_CHANNELS = 3; // R, G, B — skip alpha

/** Maximum number of framed bytes that fit in an image of the given size. */
function capacityBytes(width, height) {
  return Math.floor((width * height * USABLE_CHANNELS) / 8);
}

/**
 * Write `nBytes` bytes from `src` into the channel LSBs of `raw`, starting at
 * channel index `startChannel`. Returns the next channel index.
 */
function writeBytes(raw, startChannel, src, nBytes) {
  let channel = startChannel;
  for (let i = 0; i < nBytes; i++) {
    const byte = src[i];
    for (let bit = 7; bit >= 0; bit--) {
      const value = (byte >> bit) & 1;
      const pixelStart = Math.floor(channel / USABLE_CHANNELS) * 4;
      const offset = pixelStart + (channel % USABLE_CHANNELS);
      raw[offset] = (raw[offset] & 0xfe) | value;
      channel++;
    }
  }
  return channel;
}

/**
 * Read `nBytes` bytes out of the channel LSBs of `raw`, starting at channel
 * index `startChannel`. Returns { buf, nextChannel }.
 */
function readBytes(raw, startChannel, nBytes) {
  const out = Buffer.alloc(nBytes);
  let channel = startChannel;
  for (let i = 0; i < nBytes; i++) {
    let byte = 0;
    for (let bit = 7; bit >= 0; bit--) {
      const pixelStart = Math.floor(channel / USABLE_CHANNELS) * 4;
      const offset = pixelStart + (channel % USABLE_CHANNELS);
      byte |= (raw[offset] & 1) << bit;
      channel++;
    }
    out[i] = byte;
  }
  return { buf: out, nextChannel: channel };
}

/**
 * Embed a framed buffer into a copy of the raw pixels.
 * @param {Buffer} raw RGBA pixel data
 * @param {{width:number,height:number,channels:number}} info
 * @param {Buffer} framedBuf header + payload (from payload.frame)
 * @returns {Buffer} a new raw buffer with the data embedded
 * @throws if the image is too small to hold framedBuf
 */
function embed(raw, info, framedBuf) {
  if (framedBuf.length > capacityBytes(info.width, info.height)) {
    throw new Error('Message too large for this image');
  }
  const out = Buffer.from(raw); // clone — never mutate the caller's pixels
  writeBytes(out, 0, framedBuf, framedBuf.length);
  return out;
}

/**
 * Try to extract a hidden message from raw pixels.
 * @param {Buffer} raw RGBA pixel data
 * @param {{width:number,height:number,channels:number}} info
 * @returns {{type:number, data:Buffer} | null} null when no valid message
 */
function extract(raw, info) {
  const total = capacityBytes(info.width, info.height);
  if (total < HEADER_BYTES) return null;

  const { buf: headerBuf, nextChannel } = readBytes(raw, 0, HEADER_BYTES);
  const header = parseHeader(headerBuf);
  if (!header.magicOk) return null;

  // Guard against corrupt/huge length values that would exceed the image.
  if (HEADER_BYTES + header.length > total) return null;

  const { buf: data } = readBytes(raw, nextChannel, header.length);
  return { type: header.type, data };
}

module.exports = { name: 'lsb', capacityBytes, embed, extract };
