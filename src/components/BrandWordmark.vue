<script setup lang="ts">
withDefaults(defineProps<{ size?: 'small' | 'large'; vertical?: boolean }>(), { size: 'small', vertical: false })
</script>

<template>
  <view class="wordmark" :class="[size, { vertical }]" aria-label="账伴 LedgerMate">
    <view class="wordmark-chinese"><text>账</text><text>伴</text></view>
    <text class="wordmark-english">LEDGERMATE</text>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.wordmark { display: inline-flex; flex-direction: column; align-items: center; color: $brand-dark; }
.wordmark-chinese { display: flex; gap: 6rpx; font-family: 'Yuanti SC', 'YouYuan', 'PingFang SC', sans-serif; font-size: 42rpx; line-height: 1.2; font-weight: 500; letter-spacing: 3rpx; }
.wordmark-english { margin-top: 8rpx; font-size: 13rpx; line-height: 1.2; font-weight: 700; letter-spacing: 2rpx; }
.large .wordmark-chinese { font-size: 112rpx; gap: 14rpx; letter-spacing: 6rpx; }
.large .wordmark-english { margin-top: 20rpx; font-size: 24rpx; letter-spacing: 4rpx; }
.vertical .wordmark-chinese { flex-direction: column; align-items: center; gap: 6rpx; }
.vertical.large .wordmark-english { font-size: 19rpx; letter-spacing: 1rpx; }
</style>
