<script setup>
// A small, happy cartoon stegosaurus. Used with a light touch across the app
// (logo, empty state, success). `mood` nudges the expression.
defineProps({
  mood: { type: String, default: 'happy' }, // 'happy' | 'wink' | 'sleepy'
});
</script>

<template>
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- back plates -->
    <g fill="#bfe8cc">
      <path d="M34 44c2-12 8-18 8-18s4 8 3 18z" />
      <path d="M48 40c2-13 9-20 9-20s5 9 4 20z" />
      <path d="M64 40c2-13 9-20 9-20s5 9 4 20z" />
      <path d="M80 44c2-12 8-18 8-18s4 8 3 18z" />
    </g>
    <!-- body -->
    <path
      d="M22 70c0-16 16-28 38-28s38 10 38 26c0 4-2 7-6 7h-6l-3 9c-.4 1.4-1.7 2-3 2h-4c-1.7 0-3-1.3-3-3v-7H47v7c0 1.7-1.3 3-3 3h-4c-1.4 0-2.6-.9-3-2l-3-9c-7 0-12-5-12-12z"
      fill="#6cc88a"
    />
    <!-- tummy -->
    <path d="M40 70c0-8 9-14 20-14s20 6 20 13c0 2-12 5-20 5s-20-2-20-4z" fill="#e8f7ee" />
    <!-- eye -->
    <circle cx="34" cy="58" r="3.4" fill="#2b3a2f" />
    <circle cx="35.2" cy="56.9" r="1.1" fill="#fff" />
    <!-- cheek -->
    <circle cx="30" cy="64" r="3" fill="#f7b8b8" opacity="0.8" />
    <!-- smile -->
    <path d="M27 63c2 2.4 5 3.4 8 2.6" stroke="#2b3a2f" stroke-width="1.6" stroke-linecap="round" />
  </svg>
</template>
