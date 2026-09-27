<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { goChat } from '@/utils/navigation'

const props = defineProps<{ active: 'home' | 'statistics' | 'manage' }>()
const go = (page: 'home' | 'statistics' | 'manage') => { if (props.active !== page) uni.switchTab({ url: '/pages/' + page + '/index' }) }
const openEditor = goChat
</script>

<template>
  <view class="bottom-nav">
    <view class="nav-inner">
      <button class="nav-item" :class="{ active: active === 'home' }" aria-label="账单" @tap="go('home')"><AppIcon name="ledger" :color="active === 'home' ? '#87552F' : '#746354'" /><text>账单</text></button>
      <button class="nav-item" :class="{ active: active === 'statistics' }" aria-label="统计" @tap="go('statistics')"><AppIcon name="chart" :color="active === 'statistics' ? '#87552F' : '#746354'" /><text>统计</text></button>
      <button class="nav-item" :class="{ active: active === 'manage' }" aria-label="我的账本" @tap="go('manage')"><AppIcon name="settings" :color="active === 'manage' ? '#87552F' : '#746354'" /><text>我的</text></button>
      <button class="nav-create" @tap="openEditor"><AppIcon name="plus" color="#FFFFFF" :size="34" /><text>记一笔</text></button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.bottom-nav { position: fixed; z-index: 20; bottom: 0; left: 0; right: 0; padding: 12rpx 24rpx calc(12rpx + env(safe-area-inset-bottom)); background: $paper; border-top: 1rpx solid $line; }
.nav-inner { display: flex; align-items: center; gap: 12rpx; max-width: 888rpx; margin: 0 auto; }
.nav-item { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; min-height: 92rpx; margin: 0; padding: 8rpx 0; border-radius: 18rpx; background: transparent; color: $muted; font-size: 21rpx; line-height: 1.3; }
.nav-item.active { color: $brand; font-weight: 600; }
.nav-item:active { background: $brand-soft; }
.nav-create { display: flex; align-items: center; justify-content: center; gap: 10rpx; min-height: 88rpx; width: 214rpx; margin: 0 0 0 12rpx; border-radius: 24rpx; background: $brand; color: #FFF; font-size: 27rpx; font-weight: 600; line-height: 1.3; }
.nav-create:active { background: $brand-dark; transform: translateY(1px); }
</style>
