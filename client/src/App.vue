<script setup>
import { ref } from 'vue';
import Stego from './components/Stego.vue';
import Uploader from './components/Uploader.vue';
import ImageCard from './components/ImageCard.vue';
import EncodeStepper from './components/EncodeStepper.vue';
import { decode } from './services/api.js';

// Single-screen state machine: empty -> loaded -> (encoding) -> loaded.
const mode = ref('empty'); // 'empty' | 'loaded' | 'encoding'

const imageBlob = ref(null);
const imageUrl = ref('');
const dims = ref({ width: 0, height: 0 });

const probing = ref(false);
const hasMessage = ref(false);
const message = ref('');

/** Read natural pixel size from an object URL. */
function readDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

/** Swap in a new image (revoking the previous object URL) and probe it. */
async function loadImage(blob) {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  imageBlob.value = blob;
  imageUrl.value = URL.createObjectURL(blob);
  dims.value = await readDimensions(imageUrl.value);
  mode.value = 'loaded';
  await probe();
}

/** Ask the server whether the current image hides a message. */
async function probe() {
  probing.value = true;
  hasMessage.value = false;
  message.value = '';
  try {
    const res = await decode(imageBlob.value);
    hasMessage.value = !!res.hasMessage;
    message.value = res.message || '';
  } catch {
    hasMessage.value = false;
  } finally {
    probing.value = false;
  }
}

function onPicked(file) {
  loadImage(file);
}

function startOver() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  imageBlob.value = null;
  imageUrl.value = '';
  hasMessage.value = false;
  message.value = '';
  mode.value = 'empty';
}

// After encoding, swap to the encoded image and re-probe so the revealed
// message is truly read back from the new file (closing the loop).
async function onEncoded({ blob }) {
  await loadImage(blob);
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col px-5 pb-8 pt-6">
    <!-- header / logo (light-touch mascot) -->
    <header class="mb-6 flex items-center justify-center gap-2">
      <Stego class="h-9 w-9" />
      <h1 class="text-xl font-extrabold tracking-tight text-stego-700">Stego</h1>
    </header>

    <main class="flex flex-1 flex-col justify-center gap-6">
      <!-- empty: choose a photo -->
      <template v-if="mode === 'empty'">
        <Uploader @picked="onPicked" />
        <p class="text-center text-sm text-stone-400">Hide a little note inside a picture.</p>
      </template>

      <!-- loaded: the central card -->
      <template v-else-if="mode === 'loaded'">
        <ImageCard :src="imageUrl" :has-message="hasMessage" :message="message" />

        <div class="flex flex-col items-center gap-3">
          <p v-if="probing" class="text-sm text-stone-400">peeking inside…</p>

          <button
            v-else-if="!hasMessage"
            class="rounded-full bg-stego-500 px-7 py-3 text-base font-bold text-white shadow-sm transition active:scale-[0.98]"
            data-testid="encode-cta"
            @click="mode = 'encoding'"
          >
            encode a message ›
          </button>

          <button class="text-sm font-semibold text-stone-400 underline" @click="startOver">
            use another photo
          </button>
        </div>
      </template>

      <!-- encoding flow -->
      <template v-else>
        <ImageCard :src="imageUrl" :has-message="false" />
        <EncodeStepper
          :image-file="imageBlob"
          :width="dims.width"
          :height="dims.height"
          @done="onEncoded"
          @cancel="mode = 'loaded'"
        />
      </template>
    </main>
  </div>
</template>
