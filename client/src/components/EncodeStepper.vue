<script setup>
import { computed, ref } from 'vue';
import { encode, maxRobustBytes, maxFileBytes } from '../services/api.js';

// Walks the user through hiding a message: write -> download. Step 1 (photo
// uploaded) is already done by the time we get here and is shown as complete.
const props = defineProps({
  imageFile: { type: [File, Blob], required: true },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
});

const emit = defineEmits(['done', 'cancel']);

const step = ref('write'); // 'write' | 'download'
const message = ref('');
const busy = ref(false);
const error = ref('');
const encodedBlob = ref(null);
const encodedUrl = ref('');
const encodedMode = ref('robust'); // which codec actually got used
const encodedExt = ref('jpg'); // file extension matching the chosen codec

const robustMax = computed(() => maxRobustBytes(props.width, props.height));
const fileMax = computed(() => maxFileBytes(props.width, props.height));
const used = computed(() => new TextEncoder().encode(message.value).length);
const overflowing = computed(() => used.value > fileMax.value);

// Predict the mode live so the hint matches what encode() will choose.
const predictedMode = computed(() => {
  if (used.value <= robustMax.value) return 'robust';
  if (used.value <= fileMax.value) return 'file';
  return 'over';
});

async function hideIt() {
  if (!message.value.trim() || overflowing.value) return;
  busy.value = true;
  error.value = '';
  try {
    const { blob, mode, ext } = await encode(props.imageFile, message.value);
    encodedBlob.value = blob;
    encodedMode.value = mode;
    encodedExt.value = ext;
    encodedUrl.value = URL.createObjectURL(blob);
    step.value = 'download';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function download() {
  const a = document.createElement('a');
  a.href = encodedUrl.value;
  a.download = `encoded.${encodedExt.value}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function finish() {
  emit('done', { blob: encodedBlob.value, url: encodedUrl.value });
}
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <!-- progress -->
    <ol class="flex items-center gap-2 text-xs font-bold">
      <li class="flex items-center gap-1.5 text-stego-600">
        <span class="grid h-6 w-6 place-items-center rounded-full bg-stego-500 text-white">✓</span>
        Photo
      </li>
      <li class="h-px flex-1 bg-stego-200"></li>
      <li class="flex items-center gap-1.5" :class="step === 'write' ? 'text-stego-700' : 'text-stego-600'">
        <span
          class="grid h-6 w-6 place-items-center rounded-full text-white"
          :class="step === 'write' ? 'bg-stego-500' : 'bg-stego-500'"
        >{{ step === 'write' ? '2' : '✓' }}</span>
        Message
      </li>
      <li class="h-px flex-1 bg-stego-200"></li>
      <li class="flex items-center gap-1.5" :class="step === 'download' ? 'text-stego-700' : 'text-stone-400'">
        <span
          class="grid h-6 w-6 place-items-center rounded-full"
          :class="step === 'download' ? 'bg-stego-500 text-white' : 'bg-stone-200 text-stone-500'"
        >3</span>
        Download
      </li>
    </ol>

    <!-- step: write -->
    <div v-if="step === 'write'" class="flex flex-col gap-3">
      <label class="text-lg font-extrabold text-stego-700">Write your message</label>
      <textarea
        v-model="message"
        rows="6"
        placeholder="Your message"
        data-testid="message-input"
        class="w-full resize-none rounded-2xl border-2 border-stego-200 bg-white p-4 text-base text-stone-700 outline-none focus:border-stego-400"
      ></textarea>
      <p
        class="text-xs"
        :class="{
          'font-bold text-red-500': predictedMode === 'over',
          'text-stego-600': predictedMode === 'robust',
          'text-amber-600': predictedMode === 'file',
        }"
      >
        <span v-if="predictedMode === 'robust'">This note will survive sending as a normal photo.</span>
        <span v-else-if="predictedMode === 'file'">Too long to survive compression — this one must be sent as a file.</span>
        <span v-else>{{ used - fileMax }} bytes too many for this photo.</span>
      </p>

      <p v-if="error" class="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{{ error }}</p>

      <div class="flex gap-3">
        <button
          class="rounded-full px-5 py-3 text-sm font-bold text-stone-500"
          @click="emit('cancel')"
        >
          Back
        </button>
        <button
          class="flex-1 rounded-full bg-stego-500 px-6 py-3 text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
          :disabled="busy || overflowing || !message.trim()"
          data-testid="hide-button"
          @click="hideIt"
        >
          {{ busy ? 'Hiding…' : 'Hide it ›' }}
        </button>
      </div>
    </div>

    <!-- step: download -->
    <div v-else class="flex flex-col items-center gap-4 text-center">
      <p class="text-lg font-extrabold text-stego-700">Photo ready</p>
      <button
        class="w-full rounded-full bg-stego-500 px-6 py-3 text-base font-bold text-white shadow-sm transition active:scale-[0.98]"
        data-testid="download-button"
        @click="download"
      >
        Download photo
      </button>
      <p v-if="encodedMode === 'robust'" class="rounded-2xl bg-stego-50 px-4 py-3 text-sm text-stego-700">
        You can send this as a <strong>normal photo</strong> — the note is made to survive
        chat-app compression.
      </p>
      <p v-else class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Send it as a <strong>file or document</strong>, not as a chat photo. This note was
        too long for the compression-proof method, so a chat photo would erase it.
      </p>
      <button class="text-sm font-bold text-stego-600 underline" data-testid="finish-button" @click="finish">
        Done — show me the photo
      </button>
    </div>
  </div>
</template>
