// Decode a real-world image (e.g. a photo that went through WhatsApp) and print
// any hidden note. This is the ground-truth check for the robust codec.
//
// Workflow:
//   1. In the app, encode a note into one of your photos and download the PNG.
//   2. Send that PNG to yourself via WhatsApp (as a normal photo) and save the
//      received file (it will be a .jpg).
//   3. Run:  node tools/decode-sample.js path/to/received.jpg
//
// It reports the recovered message (robust + file codecs) so you can confirm it
// matches what you wrote. If it fails, we tune the codec parameters in dct.js.

import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';

import * as lsb from '../client/src/codec/lsb.js';
import * as dct from '../client/src/codec/dct.js';
import { parseHeader, HEADER_BYTES, TYPE } from '../client/src/codec/payload.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/decode-sample.js <path-to-image.jpg>');
  process.exit(1);
}

const ext = path.extname(file).toLowerCase();
if (ext !== '.jpg' && ext !== '.jpeg') {
  console.error(`Expected a JPEG (WhatsApp delivers .jpg). Got: ${ext || '(none)'}`);
  process.exit(1);
}

const raw = jpeg.decode(fs.readFileSync(file), { formatAsRGBA: true });
const info = { width: raw.width, height: raw.height };
console.log(`Image: ${info.width} x ${info.height}`);

function show(label, result) {
  if (!result) {
    console.log(`  ${label}: no message`);
    return false;
  }
  const text = result.type === TYPE.TEXT ? new TextDecoder().decode(result.data) : '(non-text payload)';
  console.log(`  ${label}: FOUND -> ${JSON.stringify(text)}`);
  return true;
}

const found =
  show('file (LSB)', lsb.extract(raw.data, info)) | show('robust (DCT)', dct.extract(raw.data, info));

if (!found) {
  console.log('\nNo recoverable message. If you expected one, the compression was harsher');
  console.log('than the current parameters survive — share this file and we will tune dct.js.');
}
