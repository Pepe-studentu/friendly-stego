// In-browser steganography. The whole app is static — there is no server — so
// encode/decode run on a <canvas> right here.
//
// Two codecs share one interface:
//   - robust (DCT/QIM): survives chat recompression, so the photo can be sent
//     normally; smaller capacity.
//   - file (LSB): perfect and high-capacity, but must be sent as a file.
// encode() auto-picks robust when the note fits, else falls back to file, and
// reports which it used so the UI can give the right sharing instruction.

import { frame, parseHeader, HEADER_BYTES, TYPE } from '../codec/payload.js';
import * as lsb from '../codec/lsb.js';
import * as dct from '../codec/dct.js';

/** Largest note (UTF-8 bytes) that fits each mode for the given dimensions. */
export function maxRobustBytes(width, height) {
  return Math.max(0, dct.capacityBytes(width, height) - HEADER_BYTES);
}
export function maxFileBytes(width, height) {
  return Math.max(0, lsb.capacityBytes(width, height) - HEADER_BYTES);
}

async function fileToImageData(file, flatten = false) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (flatten) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), ctx, canvas };
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image.'))), 'image/png');
  });
}

/**
 * Hide a message inside an image.
 * @returns {Promise<{ blob: Blob, mode: 'robust' | 'file' }>}
 */
export async function encode(file, message) {
  const { imageData, ctx, canvas } = await fileToImageData(file, true);
  const { width, height, data } = imageData;
  const framed = frame(TYPE.TEXT, new TextEncoder().encode(message));

  // Force every pixel opaque so canvas alpha-premultiplication can't disturb
  // the values we write.
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  let mode;
  if (framed.length <= dct.capacityBytes(width, height)) {
    dct.embed(data, { width, height }, framed);
    mode = 'robust';
  } else if (framed.length <= lsb.capacityBytes(width, height)) {
    lsb.embed(data, { width, height }, framed);
    mode = 'file';
  } else {
    throw new Error('This message is a little too big for this photo. Try a larger photo or a shorter note.');
  }

  ctx.putImageData(imageData, 0, 0);
  return { blob: await canvasToPngBlob(canvas), mode };
}

/**
 * Look for a hidden message. Tries the perfect file codec first (cheap), then
 * the robust one.
 * @returns {Promise<{hasMessage: boolean, mode?: 'robust' | 'file', message?: string}>}
 */
export async function decode(file) {
  const { imageData } = await fileToImageData(file);
  const info = { width: imageData.width, height: imageData.height };

  const fromFile = lsb.extract(imageData.data, info);
  if (fromFile) return asMessage('file', fromFile);

  const fromRobust = dct.extract(imageData.data, info);
  if (fromRobust) return asMessage('robust', fromRobust);

  return { hasMessage: false };
}

function asMessage(mode, result) {
  const message = result.type === TYPE.TEXT ? new TextDecoder().decode(result.data) : null;
  return { hasMessage: true, mode, message };
}

export { HEADER_BYTES };
