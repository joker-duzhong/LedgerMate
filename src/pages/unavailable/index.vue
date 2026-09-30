<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import BrandWordmark from '@/components/BrandWordmark.vue'
import { goChat, goHome } from '@/utils/navigation'
import { useNavigationLayout } from '@/composables/useNavigationLayout'

const { navigationStyle } = useNavigationLayout()
const feature = ref('这项功能')
const descriptions: Record<string, { icon: string; copy: string }> = {
  'AI记账': { icon: 'leaf', copy: '把今天的收支告诉小账，快速整理这一笔记录。' },
  '账单导入': { icon: 'upload', copy: '把以前的记录也带到这里。账单导入暂未开放，你可以继续记录新的收支。' },
  '数据导出': { icon: 'download', copy: '让每一笔记录都有自己的去处。数据导出暂未开放，你仍可在账单中查看和编辑记录。' },
  '隐私与账户设置': { icon: 'shield', copy: '隐私与账户管理暂未开放。退出登录可在“我的”页面操作。' },
}
const description = computed(() => descriptions[feature.value] || { icon: 'leaf', copy: '这项功能还在准备中。先记下今天的生活，更多便利会陆续与你见面。' })
const back = () => uni.navigateBack({ fail: goHome })
onLoad((query) => {
  if (typeof query?.feature === 'string' && query.feature) {
    try { feature.value = decodeURIComponent(query.feature) }
    catch { feature.value = '这项功能' }
  }
  if (feature.value === 'AI记账') goChat()
})
</script>

<template>
  <view class="page-shell unavailable-page" :style="navigationStyle">
    <view class="unavailable-header"><view class="unavailable-head capsule-safe"><button class="icon-button" aria-label="返回上一页" @tap="back"><AppIcon name="chevron-left" :size="34" color="#292A25" /></button><BrandWordmark /></view></view>
    <view class="unavailable-content">
      <view class="status-illustration"><view class="orbit orbit-one" /><view class="orbit orbit-two" /><view class="status-symbol"><AppIcon :name="description.icon" :size="68" /></view></view>
      <text class="status-label">好事，值得慢慢准备</text>
      <view class="unavailable-title"><text>{{ feature === 'AI记账' ? '快速记账' : feature }}</text><text>{{ feature === 'AI记账' ? '和小账聊聊' : '暂未开放' }}</text></view>
      <text class="unavailable-copy">{{ description.copy }}</text>
      <button v-if="feature === 'AI记账'" class="primary-button status-primary" @tap="goChat">开始快速记账</button>
      <button class="ghost-button status-back" @tap="back">返回上一页</button>
    </view>
    <text class="unavailable-footer">一笔一记，陪你过好每一天。</text>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';

.unavailable-page { display: flex; flex-direction: column; padding: 0 0 calc(44rpx + env(safe-area-inset-bottom)); background: $canvas; }
.unavailable-header { padding: var(--app-status-bar-height, 44px) 28rpx 64rpx; background: #FFE477; }
.unavailable-head { display: flex; align-items: center; gap: 26rpx; }
.unavailable-content { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; margin: -26rpx 28rpx 36rpx; padding: 40rpx 26rpx 52rpx; border: 2rpx solid $line; border-radius: 32rpx; background: $paper; box-shadow: 0 5rpx 0 #E4D8B7; }
.status-illustration { position: relative; display: flex; align-items: center; justify-content: center; width: 240rpx; height: 240rpx; margin-bottom: 30rpx; }
.orbit { position: absolute; border: 1rpx solid $line; border-radius: 50%; }
.orbit-one { width: 216rpx; height: 216rpx; }
.orbit-two { width: 174rpx; height: 174rpx; border-color: #EEE3C0; }
.status-symbol { display: flex; align-items: center; justify-content: center; width: 132rpx; height: 132rpx; border-radius: 42rpx; background: $brand-soft; transform: rotate(-7deg); }
.status-label { color: $muted; font-size: 23rpx; letter-spacing: 2rpx; }
.unavailable-title { margin: 22rpx 0 24rpx; color: $brand-dark; font-size: 43rpx; font-weight: 600; line-height: 1.55; text-align: center; }
.unavailable-title > text { display: block; }
.unavailable-copy { display: block; max-width: 540rpx; color: $muted; font-size: 27rpx; line-height: 1.85; text-align: center; }
.status-primary, .status-back { width: 100%; max-width: 440rpx; min-height: 90rpx; margin: 36rpx 0 0; font-size: 27rpx; }
.status-primary + .status-back { margin-top: 18rpx; }
.unavailable-footer { display: block; color: $muted; font-size: 23rpx; letter-spacing: 2rpx; text-align: center; }
</style>
