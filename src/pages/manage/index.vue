<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import H5ChatEntry from '@/components/H5ChatEntry.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { goChat, syncNativeTab } from '@/utils/navigation'
import { ensureLogin, openLogin } from '@/utils/authNavigation'

const auth = useAuthStore()
const { navigationStyle } = useNavigationLayout()
const nickname = computed(() => auth.isLoggedIn ? auth.user?.nickname?.trim() || '我的日常账本' : '欢迎来到账伴')
const accountLabel = computed(() => {
  if (!auth.isLoggedIn) return '登录后，开始记录你的每一天'
  const phone = auth.user?.phone
  return phone && /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)} **** ${phone.slice(-4)}` : '和账伴一起，把每一天记好'
})
const openSettings = (section: 'categories' | 'payments') => { if (ensureLogin()) uni.navigateTo({ url: `/pages/category-settings/index?section=${section}` }) }
const openFeature = (feature: string) => { if (ensureLogin()) uni.navigateTo({ url: `/pages/unavailable/index?feature=${encodeURIComponent(feature)}` }) }
const openDataManagement = (mode: 'import' | 'export') => { if (ensureLogin()) uni.navigateTo({ url: `/pages/data-management/index?mode=${mode}` }) }
const openStatistics = () => { if (ensureLogin()) uni.switchTab({ url: '/pages/statistics/index' }) }
onShow(() => syncNativeTab(3))
</script>

<template>
  <view class="profile-page" :style="navigationStyle">
    <view class="profile-header"><view class="capsule-safe"><text class="profile-title">我的</text></view><view class="identity"><view class="avatar-wrap"><image src="/static/assistant-duck.png" mode="aspectFit" class="profile-avatar" /></view><view class="identity-copy"><text class="nickname">{{ nickname }}</text><text class="account-label">{{ accountLabel }}</text><button v-if="!auth.isLoggedIn" class="login-button" @tap="openLogin">点击登录<AppIcon name="chevron-right" :size="24" color="#5B4A16" /></button></view></view></view>
    <view class="profile-body">
      <view class="card quick-card"><button @tap="goChat"><view class="quick-icon"><AppIcon name="leaf" :size="42" color="#292A25" /></view><text>快速记账</text><text class="quick-copy">说一句，记一笔</text></button><view class="quick-divider" /><button @tap="openStatistics"><view class="quick-icon"><AppIcon name="chart" :size="42" color="#292A25" /></view><text>收支统计</text><text class="quick-copy">看看钱的去向</text></button></view>

      <text class="section-label">记账设置</text>
      <view class="card menu-card">
        <button class="menu-row" @tap="openSettings('categories')"><view class="menu-icon"><AppIcon name="ledger" :size="36" color="#292A25" /></view><view class="menu-copy"><text>收支分类</text><text>管理日常开销与收入分类</text></view><AppIcon name="chevron-right" :size="26" color="#75756B" /></button>
        <button class="menu-row" @tap="openSettings('payments')"><view class="menu-icon"><AppIcon name="wallet" :size="36" color="#292A25" /></view><view class="menu-copy"><text>支付方式</text><text>整理你的常用支付方式</text></view><AppIcon name="chevron-right" :size="26" color="#75756B" /></button>
      </view>

      <text class="section-label">数据与服务</text>
      <view class="card menu-card">
        <button class="menu-row" @tap="openDataManagement('import')"><view class="menu-icon"><AppIcon name="upload" :size="34" color="#292A25" /></view><text class="menu-name">导入账单</text><AppIcon name="chevron-right" :size="26" color="#75756B" /></button>
        <button class="menu-row" @tap="openDataManagement('export')"><view class="menu-icon"><AppIcon name="download" :size="34" color="#292A25" /></view><text class="menu-name">导出数据</text><AppIcon name="chevron-right" :size="26" color="#75756B" /></button>
        <button class="menu-row" @tap="openFeature('隐私与账户设置')"><view class="menu-icon"><AppIcon name="shield" :size="34" color="#292A25" /></view><text class="menu-name">隐私与账户</text><text class="unavailable-tag">暂未开放</text><AppIcon name="chevron-right" :size="26" color="#75756B" /></button>
      </view>
      <text class="profile-footer">好好记账，好好生活</text>
    </view>
    <H5ChatEntry />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.profile-page { min-height: 100vh; background: $canvas; @include tab-page-bottom; }
.profile-header { padding: var(--app-status-bar-height, 44px) 34rpx 70rpx; background: #FFE477; }
.profile-title { display: block; font-size: 38rpx; color: $ink; font-weight: 600; }
.identity { display: flex; align-items: center; gap: 24rpx; margin-top: 30rpx; }
.avatar-wrap { display: flex; justify-content: center; align-items: center; width: 132rpx; height: 132rpx; border: 3rpx solid rgba(255,255,255,.9); border-radius: 44rpx; background: #FFF6CA; flex-shrink: 0; overflow: hidden; }
.profile-avatar { width: 116rpx; height: 116rpx; }
.identity-copy { flex: 1; min-width: 0; }
.nickname { display: block; color: $ink; font-size: 36rpx; font-weight: 600; overflow-wrap: anywhere; }
.account-label { display: block; margin-top: 12rpx; color: $brand-dark; font-size: 25rpx; }
.login-button { display: inline-flex; align-items: center; gap: 8rpx; margin: 14rpx 0 0; padding: 8rpx 20rpx; border-radius: 30rpx; background: #FFF6CA; color: $brand-dark; font-size: 24rpx; line-height: 1.5; }
.profile-body { position: relative; max-width: 960rpx; margin: -32rpx auto 0; padding: 0 28rpx; }
.quick-card { display: flex; align-items: center; padding: 26rpx 18rpx; }
.quick-card button { flex: 1; display: flex; align-items: center; flex-direction: column; margin: 0; padding: 10rpx; color: $ink; background: transparent; font-size: 27rpx; line-height: 1.6; }
.quick-icon { display: flex; align-items: center; justify-content: center; width: 76rpx; height: 76rpx; border-radius: 24rpx; background: $brand-soft; margin-bottom: 12rpx; }
.quick-copy { margin-top: 5rpx; color: $muted; font-size: 21rpx; }
.quick-divider { width: 1rpx; height: 80rpx; background: $line; }
.section-label { display: block; margin: 34rpx 4rpx 20rpx; color: $ink; font-size: 29rpx; font-weight: 600; }
.menu-card { overflow: hidden; padding: 0 24rpx; }
.menu-row { display: flex; align-items: center; gap: 18rpx; width: 100%; min-height: 112rpx; padding: 24rpx 0; margin: 0; border-radius: 0; color: $ink; background: transparent; text-align: left; line-height: 1.5; }
.menu-row + .menu-row { border-top: 1rpx solid #EEE7D3; }
.menu-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 66rpx; height: 66rpx; border-radius: 21rpx; background: #FFF6CD; }
.menu-copy { flex: 1; min-width: 0; }
.menu-copy text { display: block; font-size: 28rpx; }
.menu-copy text:last-child { color: $muted; margin-top: 6rpx; font-size: 22rpx; }
.menu-name { flex: 1; font-size: 27rpx; }
.unavailable-tag { color: $muted; font-size: 21rpx; flex-shrink: 0; }
.profile-footer { display: block; text-align: center; color: $muted; font-size: 22rpx; margin: 14rpx 0; }
</style>
