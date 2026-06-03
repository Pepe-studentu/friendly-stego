// Luma helpers (BT.601). The robust codec embeds in luminance only, because
// JPEG subsamples chroma (4:2:0) and would mangle anything hidden there.
//
// Useful identity: holding chroma constant while changing luma by delta is the
// same as adding delta to each of R, G, B. So we never need a full YCbCr round
// trip — we analyse Y, then nudge R/G/B by the per-pixel luma delta.

/** @returns {number} luma for one RGB pixel */
export function rgbToY(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Extract the luma plane from an RGBA buffer.
 * @param {Uint8Array|Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Float64Array} length width*height
 */
export function lumaPlane(rgba, width, height) {
  const y = new Float64Array(width * height);
  for (let i = 0, p = 0; p < y.length; i += 4, p++) {
    y[p] = rgbToY(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return y;
}

/**
 * Apply a per-pixel luma delta back into the RGBA buffer (add to R,G,B; clamp).
 * @param {Uint8Array|Uint8ClampedArray} rgba mutated in place
 * @param {Float64Array} newY target luma per pixel
 * @param {Float64Array} oldY original luma per pixel
 */
export function applyLumaDelta(rgba, newY, oldY) {
  for (let i = 0, p = 0; p < newY.length; i += 4, p++) {
    const d = newY[p] - oldY[p];
    rgba[i] = clamp8(rgba[i] + d);
    rgba[i + 1] = clamp8(rgba[i + 1] + d);
    rgba[i + 2] = clamp8(rgba[i + 2] + d);
  }
}

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
