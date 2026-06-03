// Seeded PRNG + permutation, so the encoder and decoder scatter/gather bits in
// the exact same order from a shared seed.

/** Deterministic xorshift32. Returns a function giving floats in [0, 1). */
export function makeRng(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return function next() {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/**
 * A deterministic permutation of [0, n) (Fisher–Yates driven by the seed).
 * `perm[logicalIndex] = physicalIndex`.
 * @param {number} n
 * @param {number} seed
 * @returns {Uint32Array}
 */
export function permutation(n, seed) {
  const rng = makeRng(seed);
  const perm = new Uint32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  return perm;
}
