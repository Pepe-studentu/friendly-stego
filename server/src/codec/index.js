'use strict';

/**
 * The active steganography codec.
 *
 * v1 uses fragile LSB. To swap in a more robust method later (e.g. DCT),
 * change this single line — the API, payload framing and UI stay untouched.
 */
const lsb = require('./lsb');

module.exports = lsb;
