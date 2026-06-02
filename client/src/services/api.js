// In-browser steganography. The whole app is static — there is no server —
// so encode/decode run on a <canvas> right here. The public surface mirrors
// what the components already expect: encode(file, message) -> PNG Blob,
// decode(file) -> { hasMessage, type?, message? }.

import { frame, parseHeader, HEADER_BYTES, TYPE } from '../codec/payload.js';
import * as lsb from '../codec/lsb.js';

/**
 * Decode any image file to canvas ImageData.
 * @param {Blob|File} file
 * @param {boolean} flatten paint onto white first (drops transparency so the
 *   pixels we read/write are stable and opaque — needed for a clean round trip)
 */
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

/** PNG (lossless) keeps the embedded LSBs intact across a save/reload. */
function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image.'))), 'image/png');
  });
}

/**
 * Hide a message inside an image. Resolves to a PNG Blob.
 * @param {Blob|File} file
 * @param {string} message
 * @returns {Promise<Blob>}
 */
export async function encode(file, message) {
  const { imageData, ctx, canvas } = await fileToImageData(file, true);
  const data = new TextEncoder().encode(message);
  const framed = frame(TYPE.TEXT, data);

  if (framed.length > lsb.capacityBytes(imageData.width, imageData.height)) {
    throw new Error('This message is a little too big for this photo. Try a larger photo or a shorter note.');
  }

  // Force every pixel opaque so canvas alpha-premultiplication can't disturb
  // the RGB bits we hide, then embed and write the pixels back.
  for (let i = 3; i < imageData.data.length; i += 4) imageData.data[i] = 255;
  lsb.embed(imageData.data, { width: imageData.width, height: imageData.height }, framed);
  ctx.putImageData(imageData, 0, 0);

  return canvasToPngBlob(canvas);
}

/**
 * Look for a hidden message in an image.
 * @param {Blob|File} file
 * @returns {Promise<{hasMessage: boolean, type?: number, message?: string}>}
 */
export async function decode(file) {
  const { imageData } = await fileToImageData(file);
  const result = lsb.extract(imageData.data, { width: imageData.width, height: imageData.height });
  if (!result) return { hasMessage: false };
  const message = result.type === TYPE.TEXT ? new TextDecoder().decode(result.data) : null;
  return { hasMessage: true, type: result.type, message };
}

// Re-export for components that compute capacity hints.
export { HEADER_BYTES };
