<script setup>
import Stego from './Stego.vue';

const emit = defineEmits(['picked']);

function onChange(e) {
  const file = e.target.files && e.target.files[0];
  if (file) emit('picked', file);
}
</script>

<template>
  <label
    class="flex w-full cursor-pointer flex-col items-center gap-5 rounded-3xl border-2 border-dashed border-stego-200 bg-white/60 px-6 py-12 text-center transition active:scale-[0.99]"
  >
    <Stego class="h-28 w-28 drop-shadow-sm" />
    <div>
      <p class="text-lg font-extrabold text-stego-700">Pick a photo</p>
      <p class="mt-1 text-sm text-stone-500">Tap to choose a picture from your device.</p>
    </div>
    <span class="rounded-full bg-stego-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm">
      Choose photo
    </span>
    <input type="file" accept="image/*" class="hidden" data-testid="file-input" @change="onChange" />
  </label>
</template>
