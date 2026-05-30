'use strict';

const sharp = require('sharp');

/**
 * Image I/O for the codec.
 *
 * Any input (JPEG/PNG/...) is decoded to a raw RGBA buffer so the codec can
 * work on uniform pixel data. Output is always lossless PNG, which preserves
 * the embedded LSBs exactly across the round-trip (re-saving as JPEG would
 * destroy them).
 */

/**
 * Decode an image buffer to raw RGBA pixels.
 * @param {Buffer} buffer encoded image bytes
 * @returns {Promise<{data: Buffer, info: {width:number, height:number, channels:number}}>}
 */
async function toRaw(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha() // force 4 channels (RGBA) for a uniform layout
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

/**
 * Encode raw RGBA pixels back to a lossless PNG buffer.
 * @param {Buffer} raw RGBA pixel data
 * @param {{width:number, height:number, channels:number}} info
 * @returns {Promise<Buffer>}
 */
async function toPng(raw, info) {
  return sharp(raw, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

module.exports = { toRaw, toPng };
