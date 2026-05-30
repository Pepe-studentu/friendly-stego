import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

/**
 * Ask the server whether an image hides a message, and what it is.
 * @param {Blob|File} imageBlob
 * @returns {Promise<{hasMessage: boolean, type?: number, message?: string}>}
 */
export async function decode(imageBlob) {
  const form = new FormData();
  form.append('image', imageBlob, 'image');
  const { data } = await http.post('/decode', form);
  return data;
}

/**
 * Hide a message inside an image. Resolves to a PNG Blob.
 * On capacity errors the server replies 422; we surface a friendly message.
 * @param {Blob|File} imageBlob
 * @param {string} message
 * @returns {Promise<Blob>}
 */
export async function encode(imageBlob, message) {
  const form = new FormData();
  form.append('image', imageBlob, 'image');
  form.append('message', message);
  try {
    const { data } = await http.post('/encode', form, { responseType: 'blob' });
    return data;
  } catch (err) {
    const friendly = await readError(err);
    throw new Error(friendly);
  }
}

/** Pull a human-friendly message out of an Axios error (blob or json body). */
async function readError(err) {
  const res = err.response;
  if (!res) return 'We could not reach the server. Is it running?';
  try {
    const body = res.data instanceof Blob ? JSON.parse(await res.data.text()) : res.data;
    if (body && body.error) return body.error;
  } catch {
    /* fall through to generic */
  }
  return 'Something went wrong while hiding your message.';
}
