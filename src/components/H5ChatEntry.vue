<script setup lang="ts">
// #ifdef H5
import AppIcon from '@/components/AppIcon.vue'
import { goChat } from '@/utils/navigation'
// #endif
</script>

<template>
  <!-- #ifdef H5 -->
  <button class="h5-chat-entry" aria-label="打开快速记账" @tap="goChat">
    <image class="entry-duck" src="/static/assistant-duck.png" mode="aspectFill" aria-hidden="true" />
    <AppIcon name="plus" :size="38" color="#292A25" />
    <text>快速记账</text>
  </button>
  <!-- #endif -->
</template>

<style scoped>
/* #ifdef H5 */
.h5-chat-entry { position: fixed; z-index: 90; left: 50%; bottom: calc(50px + 20rpx); bottom: calc(var(--window-bottom, 50px) + 20rpx + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rpx; width: 116rpx; min-height: 96rpx; margin: 0; padding: 10rpx 0; border: 3rpx solid #5B4A16; border-radius: 40rpx; background: #FFDA4A; color: #292A25; font-size: 20rpx; line-height: 1.3; overflow: visible; box-shadow: 0 6rpx 16rpx rgba(91, 74, 22, .16); }
.h5-chat-entry::after { border: 0; }
.h5-chat-entry:active { background: #F4CD34; }
.entry-duck { position: absolute; top: -40rpx; width: 60rpx; height: 60rpx; border: 3rpx solid #FFFFFF; border-radius: 50%; background: #FFE477; pointer-events: none; }
/* #endif */
</style>
