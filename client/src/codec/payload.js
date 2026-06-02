// Codec-agnostic payload framing. Pure JS (Uint8Array), so it runs identically
// in the browser and in Node (tests). Knows nothing about how bits are hidden,
// so a future robust codec can reuse the same framing and auto-detection.
//
// Header layout (9 bytes, big-endian):
//   [0..2]  magic   "FSG"   (Friendly SteGo)
//   [3]     version 0x01
//   [4]     type    payload type (see TYPE)
//   [5..8]  length  uint32  byte length of the payload that follows

export const MAGIC = new TextEncoder().encode('FSG'); // 3 bytes
export const VERSION = 0x01;
export const HEADER_BYTES = MAGIC.length + 1 + 1 + 4; // 9

export const TYPE = Object.freeze({
  TEXT: 0x01, // UTF-8 text
});

/**
 * Build the full framed array (header + data) ready to be hidden.
 * @param {number} type one of TYPE.*
 * @param {Uint8Array} dataBytes raw payload bytes
 * @returns {Uint8Array}
 */
export function frame(type, dataBytes) {
  const out = new Uint8Array(HEADER_BYTES + dataBytes.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = VERSION;
  out[MAGIC.length + 1] = type;
  new DataView(out.buffer).setUint32(MAGIC.length + 2, dataBytes.length, false);
  out.set(dataBytes, HEADER_BYTES);
  return out;
}

/**
 * Parse a header from the first HEADER_BYTES of an array. Never throws on
 * short/garbage input; reports magicOk=false instead.
 * @param {Uint8Array} bytes
 * @returns {{magicOk: boolean, version: number, type: number, length: number}}
 */
export function parseHeader(bytes) {
  if (!bytes || bytes.length < HEADER_BYTES) {
    return { magicOk: false, version: 0, type: 0, length: 0 };
  }
  const magicOk = bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] && bytes[2] === MAGIC[2];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    magicOk,
    version: bytes[MAGIC.length],
    type: bytes[MAGIC.length + 1],
    length: view.getUint32(MAGIC.length + 2, false),
  };
}
