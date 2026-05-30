<script setup>
import { ref, watch } from 'vue';

// The central photo. Always shown inside a display-only white "polaroid"
// border (CSS only — the downloaded file is never framed). When a message is
// present, tapping flips the card to reveal a scrollable note.
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
  <div class="[perspective:1200px]">
    <div
      class="relative aspect-square w-full transition-transform duration-500 preserve-3d"
      :class="{ 'rotate-y-180': flipped, 'cursor-pointer': hasMessage }"
      role="button"
      :aria-pressed="flipped"
      data-testid="image-card"
      @click="toggle"
    >
      <!-- front: the photo in its polaroid frame -->
      <div class="absolute inset-0 backface-hidden">
        <div class="flex h-full w-full flex-col rounded-2xl bg-white p-3 pb-7 shadow-polaroid">
          <img :src="src" alt="your photo" class="h-full w-full rounded-lg object-cover" />
        </div>
        <p
          v-if="hasMessage"
          class="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-stone-400"
        >
          tap to read 💌
        </p>
      </div>

      <!-- back: the hidden message -->
      <div class="absolute inset-0 rotate-y-180 backface-hidden">
        <div class="flex h-full w-full flex-col rounded-2xl bg-stego-50 p-3 pb-7 shadow-polaroid">
          <div
            class="h-full w-full overflow-y-auto rounded-lg bg-white p-5"
            data-testid="message"
          >
            <p class="whitespace-pre-wrap break-words text-lg leading-relaxed text-stone-700">{{ message }}</p>
          </div>
        </div>
        <p class="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-stone-400">
          tap to flip back
        </p>
      </div>
    </div>
  </div>
</template>
