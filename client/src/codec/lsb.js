// Fragile LSB steganography codec. Pure JS — runs in the browser (on canvas
// ImageData) and in Node (on plain typed arrays, for tests).
//
// Hides bytes in the least-significant bit of the R, G, B channels of a raw
// RGBA pixel array (alpha is left untouched). One bit per channel byte,
// row-major.
//
// This is the swappable codec interface. Any replacement (e.g. a robust DCT
// codec) must expose the same shape and follow the same extract contract:
// read the header first to learn the payload length, then read exactly that
// many more bytes.

import { HEADER_BYTES, parseHeader } from './payload.js';

export const name = 'lsb';

const USABLE_CHANNELS = 3; // R, G, B — skip alpha

/** Maximum number of framed bytes that fit in an image of the given size. */
export function capacityBytes(width, height) {
  return Math.floor((width * height * USABLE_CHANNELS) / 8);
}

/** Map a logical "usable channel" index to the absolute RGBA byte offset. */
function channelOffset(channel) {
  return Math.floor(channel / USABLE_CHANNELS) * 4 + (channel % USABLE_CHANNELS);
}

function writeBytes(raw, startChannel, src, nBytes) {
  let channel = startChannel;
  for (let i = 0; i < nBytes; i++) {
    const byte = src[i];
    for (let bit = 7; bit >= 0; bit--) {
      const value = (byte >> bit) & 1;
      const offset = channelOffset(channel);
      raw[offset] = (raw[offset] & 0xfe) | value;
      channel++;
    }
  }
  return channel;
}

function readBytes(raw, startChannel, nBytes) {
  const out = new Uint8Array(nBytes);
  let channel = startChannel;
  for (let i = 0; i < nBytes; i++) {
    let byte = 0;
    for (let bit = 7; bit >= 0; bit--) {
      byte |= (raw[channelOffset(channel)] & 1) << bit;
      channel++;
    }
    out[i] = byte;
  }
  return { buf: out, nextChannel: channel };
}

/**
 * Embed a framed array into the raw pixels, in place.
 * @param {Uint8Array|Uint8ClampedArray} raw RGBA pixel data (mutated)
 * @param {{width:number,height:number}} info
 * @param {Uint8Array} framed header + payload (from payload.frame)
 * @returns {Uint8Array|Uint8ClampedArray} the same raw array
 * @throws if the image is too small to hold framed
 */
export function embed(raw, info, framed) {
  if (framed.length > capacityBytes(info.width, info.height)) {
    throw new Error('Message too large for this image');
  }
  writeBytes(raw, 0, framed, framed.length);
  return raw;
}

/**
 * Try to extract a hidden message from raw pixels.
 * @param {Uint8Array|Uint8ClampedArray} raw RGBA pixel data
 * @param {{width:number,height:number}} info
 * @returns {{type:number, data:Uint8Array} | null} null when no valid message
 */
export function extract(raw, info) {
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
