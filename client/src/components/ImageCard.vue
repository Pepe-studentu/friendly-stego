<script setup>
import { ref, watch } from 'vue';

// The central photo. Always shown inside a display-only white "polaroid"
// border (CSS only — the downloaded file is never framed). The frame is a
// uniform bezel with no text inside it, and the photo keeps its own aspect
// ratio and original sharp corners. When a message is present, tapping flips
// the card to reveal a scrollable note.
const props = defineProps({
  src: { type: String, required: true },
  hasMessage: { type: Boolean, default: false },
  message: { type: String, default: '' },
});

const flipped = ref(false);

// A freshly loaded image always starts showing its front.
watch(
  () => props.src,
  () => {
    flipped.value = false;
  }
);

function toggle() {
  if (props.hasMessage) flipped.value = !flipped.value;
}
</script>

<template>
  <div>
    <div class="[perspective:1200px]">
      <div
        class="relative transition-transform duration-500 preserve-3d"
        :class="{ 'rotate-y-180': flipped, 'cursor-pointer': hasMessage }"
        role="button"
        :aria-pressed="flipped"
        data-testid="image-card"
        @click="toggle"
      >
        <!-- front: the photo in its uniform white frame; the image defines the
             card size, so its natural aspect ratio is preserved (no cropping) -->
        <div class="backface-hidden">
          <div class="rounded-none bg-white p-3 shadow-polaroid">
            <img
              :src="src"
              alt="your photo"
              class="mx-auto block max-h-[62vh] w-auto max-w-full"
            />
          </div>
        </div>

        <!-- back: the hidden message, sized to fill the front -->
        <div class="absolute inset-0 rotate-y-180 backface-hidden">
          <div class="flex h-full w-full rounded-2xl bg-white p-3 shadow-polaroid">
            <div class="h-full w-full overflow-y-auto rounded-lg bg-stego-50 p-5" data-testid="message">
              <p class="whitespace-pre-wrap break-words text-lg leading-relaxed text-stone-700">{{ message }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- hint lives outside the frame so the bezel stays clean -->
    <p v-if="hasMessage" class="mt-3 text-center text-sm font-semibold text-stone-400">
      {{ flipped ? 'tap to flip back' : 'tap to see message' }}
    </p>
  </div>
</template>
