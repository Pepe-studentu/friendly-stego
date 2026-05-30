import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'photo.png');

// The whole behavioral contract, driven through the real UI:
// upload -> encode -> download -> re-upload the downloaded file -> reveal.
test('hide a note, download it, re-open it, and read it back', async ({ page }) => {
  const secret = 'meet me by the big tree 🦕 at 7 — i love you\n\n(our little secret)';

  await page.goto('/');

  // upload a plain photo; the app probes it and offers to encode
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  const encodeCta = page.getByTestId('encode-cta');
  await expect(encodeCta).toBeVisible();
  await encodeCta.click();

  // write the message and hide it
  await page.getByTestId('message-input').fill(secret);
  await page.getByTestId('hide-button').click();

  // download the encoded photo to a real file
  const downloadButton = page.getByTestId('download-button');
  await expect(downloadButton).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  const savedPath = path.join(os.tmpdir(), `e2e-${Date.now()}.png`);
  await download.saveAs(savedPath);

  // start fresh and re-upload the downloaded file — a true round trip
  await page.getByTestId('finish-button').click();
  await page.getByRole('button', { name: 'use another photo' }).click();
  await page.getByTestId('file-input').setInputFiles(savedPath);

  // the card should now hold a message; tapping reveals it
  const card = page.getByTestId('image-card');
  await expect(card).toBeVisible();
  await card.click();

  const message = page.getByTestId('message');
  await expect(message).toBeVisible();
  await expect(message).toContainText('meet me by the big tree');
  await expect(message).toContainText('our little secret');
});
