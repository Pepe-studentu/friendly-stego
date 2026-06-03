// Orthonormal separable 8x8 DCT-II / inverse, the same transform JPEG is built
// on. Operates on a flat 64-element block (row-major). Coefficients come out on
// a scale comparable to JPEG's, so a QIM step can be reasoned about against
// JPEG quantisation.

const N = 8;

// Cosine basis: C[k][n] = c(k) * cos((2n+1)kπ/16)
const C = (() => {
  const m = [];
  for (let k = 0; k < N; k++) {
    const row = new Float64Array(N);
    const ck = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    for (let n = 0; n < N; n++) row[n] = ck * Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N));
    m.push(row);
  }
  return m;
})();

// 1D transforms along rows of an 8x8 stored row-major.
function mulRows(src, dst, basis) {
  // dst[k][j] = sum_n basis[k][n] * src[n][j]  (apply along columns index n)
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let n = 0; n < N; n++) s += basis[k][n] * src[n * N + j];
      dst[k * N + j] = s;
    }
  }
}

function mulCols(src, dst, basis) {
  // dst[i][k] = sum_n src[i][n] * basis[k][n]
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      let s = 0;
      for (let n = 0; n < N; n++) s += src[i * N + n] * basis[k][n];
      dst[i * N + k] = s;
    }
  }
}

const tmp = new Float64Array(64);

/** Forward 8x8 DCT-II. block (Float64Array[64]) -> coeffs (Float64Array[64]). */
export function fdct8(block, out) {
  mulRows(block, tmp, C);
  mulCols(tmp, out, C);
  return out;
}

/** Inverse 8x8 DCT. coeffs (Float64Array[64]) -> block (Float64Array[64]). */
export function idct8(coeffs, out) {
  // inverse uses C^T: x = C^T F C
  for (let n = 0; n < N; n++) {
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += C[k][n] * coeffs[k * N + j];
      tmp[n * N + j] = s;
    }
  }
  for (let i = 0; i < N; i++) {
    for (let n = 0; n < N; n++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += tmp[i * N + k] * C[k][n];
      out[i * N + n] = s;
    }
  }
  return out;
}
