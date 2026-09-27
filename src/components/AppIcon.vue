<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number; color?: string }>(), { size: 40, color: 'color' })
const names = new Set(['ledger', 'chart', 'plus', 'settings', 'chevron-left', 'chevron-right', 'chevron-down', 'search', 'close', 'check', 'calendar', 'clock', 'wallet', 'trash', 'backspace', 'edit', 'arrow-up', 'arrow-down', 'food', 'shopping', 'transport', 'home', 'health', 'education', 'gift', 'salary', 'more', 'refresh', 'leaf', 'download', 'upload', 'shield', 'logout'])
const tones: Record<string, string> = { color: 'color', '#292a25': 'ink', '#34352f': 'ink', '#5b4a16': 'brand', '#75756b': 'muted', '#188544': 'income', '#27ae60': 'income', '#b94738': 'ink', '#ffda4a': 'ink', '#87552f': 'brand', '#694022': 'brand', '#746354': 'muted', '#30271f': 'ink', '#52745f': 'income', '#a85743': 'expense', '#a33d32': 'expense', '#ffffff': 'white', '#fff': 'white', '#fffcf7': 'white', '#f6f0e7': 'white', white: 'white' }
const src = computed(() => '/static/icons/' + (tones[props.color.toLowerCase()] || 'brand') + '/' + (names.has(props.name) ? props.name : 'wallet') + '.svg')
</script>

<template>
  <image class="app-icon" :src="src" :style="{ width: size + 'rpx', height: size + 'rpx' }" mode="aspectFit" aria-hidden="true" />
</template>

<style scoped>
.app-icon { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
