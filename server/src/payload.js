'use strict';

/**
 * Codec-agnostic payload framing.
 *
 * Every embed begins with a small, fixed-size header so that:
 *   - we can instantly tell "encoded vs. not" (magic match), and
 *   - we can branch on payload type later without breaking old images.
 *
 * This layer knows nothing about *how* bits are hidden, so a future robust
 * codec (e.g. DCT) reuses the exact same framing and auto-detection.
 *
 * Header layout (9 bytes, big-endian):
 *   [0..2]  magic   "FSG"   (Friendly SteGo)
 *   [3]     version 0x01
 *   [4]     type    payload type (see TYPE)
 *   [5..8]  length  uint32  byte length of the payload that follows the header
 */

const MAGIC = Buffer.from('FSG', 'ascii');
const VERSION = 0x01;
const HEADER_BYTES = MAGIC.length + 1 + 1 + 4; // 9

const TYPE = Object.freeze({
  TEXT: 0x01, // UTF-8 text
});

/**
 * Build the full framed buffer (header + data) ready to be hidden.
 * @param {number} type one of TYPE.*
 * @param {Buffer} dataBuf raw payload bytes
 * @returns {Buffer}
 */
function frame(type, dataBuf) {
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header.writeUInt8(VERSION, MAGIC.length);
  header.writeUInt8(type, MAGIC.length + 1);
  header.writeUInt32BE(dataBuf.length, MAGIC.length + 2);
  return Buffer.concat([header, dataBuf]);
}

/**
 * Parse a header from the first HEADER_BYTES of a buffer.
 * Never throws on short/garbage input; reports magicOk=false instead.
 * @param {Buffer} buf at least HEADER_BYTES long
 * @returns {{magicOk: boolean, version: number, type: number, length: number}}
 */
function parseHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < HEADER_BYTES) {
    return { magicOk: false, version: 0, type: 0, length: 0 };
  }
  const magicOk = buf.subarray(0, MAGIC.length).equals(MAGIC);
  return {
    magicOk,
    version: buf.readUInt8(MAGIC.length),
    type: buf.readUInt8(MAGIC.length + 1),
    length: buf.readUInt32BE(MAGIC.length + 2),
  };
}

module.exports = { MAGIC, VERSION, HEADER_BYTES, TYPE, frame, parseHeader };
