<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import BrandWordmark from '@/components/BrandWordmark.vue'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { useStartup } from '@/composables/useStartup'

const { navigationStyle } = useNavigationLayout()

let canUseWechat = false
// #ifdef MP-WEIXIN
canUseWechat = true
// #endif
const { start, retryNavigation, errorMessage, dispose } = useStartup(canUseWechat)

onLoad(start)
onUnload(dispose)
</script>

<template>
  <view class="startup-page" :style="navigationStyle">
    <view class="startup-top"><view class="capsule-safe"><text>日常有序，心里有数。</text></view></view>
    <view class="launch-content" role="status" aria-live="polite">
      <BrandWordmark size="large" vertical />
      <template v-if="errorMessage">
        <text class="launch-error" role="alert">{{ errorMessage }}</text>
        <button class="primary-button retry-button" @tap="retryNavigation()">重新打开账本</button>
      </template>
      <view v-else class="launch-progress"><view class="launch-spinner" aria-hidden="true" /><text>正在打开你的账本</text></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';

.startup-page { display: flex; flex-direction: column; min-height: 100vh; max-width: 960rpx; margin: 0 auto; box-sizing: border-box; padding-bottom: calc(30rpx + env(safe-area-inset-bottom)); background: #FFE477; }
.startup-top { padding: var(--app-status-bar-height, 44px) 36rpx 10rpx; color: $brand-dark; font-size: 22rpx; line-height: 1.5; letter-spacing: 2rpx; }
.launch-content { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - var(--app-nav-total-height, 88px) - 40rpx - env(safe-area-inset-bottom)); padding: 36rpx 36rpx 72rpx; box-sizing: border-box; }
.launch-progress { display: flex; align-items: center; justify-content: center; gap: 14rpx; margin-top: 54rpx; color: $brand-dark; font-size: 24rpx; letter-spacing: 1rpx; }
.launch-spinner { width: 28rpx; height: 28rpx; border: 3rpx solid rgba(91, 74, 22, .2); border-top-color: $brand-dark; border-radius: 50%; animation: launch-spin .9s linear infinite; }
.launch-error { margin-top: 54rpx; color: $brand-dark; font-size: 26rpx; line-height: 1.7; text-align: center; }
.retry-button { margin-top: 28rpx; padding: 0 32rpx; color: $brand-dark; font-size: 28rpx; }
@keyframes launch-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .launch-spinner { animation: none; } }
</style>
