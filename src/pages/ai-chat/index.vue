<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { useAiChat } from '@/composables/useAiChat'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { recordDate } from '@/utils/ledger'
import { backFromChat, goHome } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'
import { chatSafeBottom, chatViewportHeight } from '@/utils/chatLayout'

const { navigationStyle } = useNavigationLayout()
const { sessions, sessionId, visibleMessages, names, categoryById, input, loading, loaded, sending, processing, deletingId, errorMessage, pending, canRetryPending, initialize, selectSession, send, refreshResult, editFailedMessage, removeRecord, dispose } = useAiChat()
const historyOpen = ref(false)
const keyboardHeight = ref(0)
const baselineHeight = ref(0)
const currentHeight = ref(0)
const viewportWidth = ref(0)
const safeBottom = ref(0)
const pageStyle = computed(() => {
  const height = chatViewportHeight(baselineHeight.value, currentHeight.value, keyboardHeight.value)
  return height ? { height: height + 'px' } : {}
})
const composerStyle = computed(() => baselineHeight.value ? { paddingBottom: 8 + (keyboardHeight.value ? 0 : safeBottom.value) + 'px' } : {})
const scrollAnchor = ref('')
const anchorVersion = ref(0)
const openManual = () => uni.navigateTo({ url: '/pages/record-editor/index' })
const openStats = () => uni.switchTab({ url: '/pages/statistics/index' })
const openDetails = (id: string) => uni.navigateTo({ url: '/pages/record-detail/index?id=' + encodeURIComponent(id) })
const editRecord = (id: string) => uni.navigateTo({ url: '/pages/record-editor/index?id=' + encodeURIComponent(id) })
const remove = (id: string) => uni.showModal({ title: '删除这笔账？', content: '删除后无法恢复。', confirmText: '删除', confirmColor: '#B94738', success: async ({ confirm }) => { if (confirm && await removeRecord(id)) uni.showToast({ title: '已删除', icon: 'success' }) } })
const chooseSession = async (id: string | null) => { historyOpen.value = false; await selectSession(id) }
const openHistory = () => { uni.hideKeyboard(); historyOpen.value = true }
const scrollToEnd = async () => { anchorVersion.value += 1; await nextTick(); scrollAnchor.value = 'chat-end-' + anchorVersion.value }
const measureViewport = () => {
  let info: { windowHeight: number; windowWidth: number; screenHeight?: number; statusBarHeight?: number; safeArea?: { bottom: number } } | undefined
  try { if (typeof uni.getWindowInfo === 'function') info = uni.getWindowInfo() } catch {}
  if (!info || !Number.isFinite(info.windowHeight) || info.windowHeight <= 0) {
    try { info = uni.getSystemInfoSync() } catch { return }
  }
  if (!info || !Number.isFinite(info.windowHeight) || info.windowHeight <= 0) return
  const rotated = viewportWidth.value > 0 && viewportWidth.value !== info.windowWidth
  if (!baselineHeight.value || rotated || info.windowHeight > baselineHeight.value) baselineHeight.value = info.windowHeight
  viewportWidth.value = info.windowWidth
  currentHeight.value = info.windowHeight
  safeBottom.value = chatSafeBottom(info.screenHeight || 0, info.safeArea?.bottom)
  // #ifdef H5
  if (typeof window !== 'undefined' && window.visualViewport?.height) currentHeight.value = Math.min(currentHeight.value, window.visualViewport.height)
  // #endif
}
const keyboardChange = (event: { height: number }) => {
  if (!Number.isFinite(event.height) || event.height < 0) return
  keyboardHeight.value = event.height
  measureViewport()
  void scrollToEnd()
}
const resized = () => { measureViewport(); void scrollToEnd() }
let listening = false
const startKeyboard = () => {
  measureViewport()
  if (listening) return
  listening = true
  if (typeof uni.onKeyboardHeightChange === 'function') uni.onKeyboardHeightChange(keyboardChange)
  if (typeof uni.onWindowResize === 'function') uni.onWindowResize(resized)
  // #ifdef H5
  if (typeof window !== 'undefined') window.visualViewport?.addEventListener('resize', resized)
  // #endif
}
const stopKeyboard = () => {
  if (listening) {
    if (typeof uni.offKeyboardHeightChange === 'function') uni.offKeyboardHeightChange(keyboardChange)
    if (typeof uni.offWindowResize === 'function') uni.offWindowResize(resized)
    // #ifdef H5
    if (typeof window !== 'undefined') window.visualViewport?.removeEventListener('resize', resized)
    // #endif
  }
  listening = false
  keyboardHeight.value = 0
}
watch([visibleMessages, sending], scrollToEnd)
onShow(() => { if (ensureLogin()) { startKeyboard(); void initialize(true) } })
onHide(stopKeyboard)
onUnload(() => { stopKeyboard(); dispose() })
</script>

<template>
  <view class="chat-page" :class="{ 'keyboard-open': keyboardHeight > 0 }" :style="[navigationStyle, pageStyle]">
    <view class="chat-head">
      <view class="chat-titlebar capsule-safe"><button class="icon-button" aria-label="返回上一页" @tap="backFromChat"><AppIcon name="chevron-left" color="#292A25" :size="42" /></button><view class="assistant-name"><text>账伴小鸭</text><text>你说，我来记</text></view><button class="icon-button history-toggle" aria-label="对话记录" :disabled="sending || Boolean(pending)" @tap="openHistory"><AppIcon name="ledger" color="#292A25" :size="36" /></button></view>
    </view>
    <view class="chat-stream-wrap">
    <scroll-view class="chat-stream" scroll-y :scroll-into-view="scrollAnchor" :scroll-with-animation="false" :show-scrollbar="false">
      <view class="chat-content">
        <text class="chat-intro">一句话记下生活的小开销</text>
        <view v-if="loading && !loaded" class="chat-loading">正在打开对话…</view>
        <view v-if="loaded && !visibleMessages.length" class="message-row assistant">
          <image class="avatar" src="/static/assistant-duck.png" mode="aspectFill" />
          <view class="message-body"><view class="bubble">今天有什么收入或花销？告诉我「昨天午饭35元，微信付的」，我会帮你整理分类、金额、日期和备注，并直接记到账本里。</view><view class="example-chips"><button @tap="input = '今天午饭35元，微信支付'">午饭 35 元</button><button @tap="input = '昨天收到工资8000元'">收到工资</button></view></view>
        </view>
        <view v-for="message in visibleMessages" :key="message.id" class="message-row" :class="message.role">
          <image v-if="message.role === 'assistant'" class="avatar" src="/static/assistant-duck.png" mode="aspectFill" />
          <view class="message-body">
            <view v-if="message.content && (message.role === 'user' || !message.records.length)" class="bubble"><text selectable>{{ message.content }}</text></view>
            <view v-for="record in message.records" :key="record.id" class="receipt-card">
              <button class="receipt-main" @tap="openDetails(record.id)"><view class="receipt-icon"><CategoryIcon :category="categoryById.get(record.category_id)" :name="names.get(record.category_id) || ''" :size="46" /></view><view class="receipt-copy"><text>{{ names.get(record.category_id) || '未命名分类' }}</text><text>{{ record.note || '日常收支' }}</text></view><text class="receipt-amount">{{ record.record_type === 'expense' ? '−' : '+' }}{{ (record.amount_cent / 100).toFixed(2) }}</text></button>
              <view class="receipt-bottom"><text>{{ recordDate(record) }}</text><view class="receipt-actions"><button :disabled="Boolean(deletingId) || sending" aria-label="删除账单" @tap="remove(record.id)"><AppIcon name="trash" :size="28" color="#292A25" /></button><button :disabled="sending" @tap="editRecord(record.id)"><AppIcon name="edit" :size="26" color="#292A25" />编辑</button></view></view>
            </view>
            <view v-if="message.role === 'assistant' && message.records.length" class="bubble assistant-reply"><text selectable>{{ message.content || '记好啦，每一笔都清清楚楚。' }}</text></view>
            <text v-if="message.role === 'user' && pending && (message.id === 'pending-' + pending.id || message.payload?.client_message_id === pending.id)" class="message-status">{{ sending ? '正在发送…' : processing ? '已发送 · 后台处理中' : pending.status === 'failed' ? '处理失败 · 可重试' : '发送待确认 · 可重试' }}</text>
          </view>
          <view v-if="message.role === 'user'" class="user-avatar">我</view>
        </view>
        <view v-if="processing" class="message-row assistant"><image class="avatar" src="/static/assistant-duck.png" /><view class="bubble typing"><text>正在整理，离开后也会继续处理</text><view class="typing-dots"><view /><view /><view /></view></view></view>
        <view v-if="errorMessage" class="chat-error"><text>{{ errorMessage }}</text><button v-if="!loaded" @tap="initialize(true)">重新加载对话</button><button v-else-if="processing" @tap="refreshResult">刷新处理结果</button><button v-else-if="pending" :disabled="!canRetryPending" @tap="send">重试同一条消息</button><button v-else @tap="initialize(true)">刷新对话</button><button v-if="loaded && pending?.status === 'failed'" :disabled="sending" @tap="editFailedMessage">修改后重新发送</button></view>
        <view v-if="canRetryPending && !errorMessage" class="chat-error pending-retry"><text>这条消息还在等待确认，继续完成这一笔吧。</text><button @tap="send">重试同一条消息</button></view>
        <view :id="'chat-end-' + anchorVersion" class="chat-end" />
      </view>
    </scroll-view>
    </view>
    <view class="chat-composer" :style="composerStyle">
      <scroll-view class="shortcuts" scroll-x :show-scrollbar="false"><view class="shortcut-inner"><button @tap="openManual"><AppIcon name="edit" :size="28" />手动记账</button><button @tap="openStats"><AppIcon name="chart" :size="28" />收支统计</button><button @tap="goHome"><AppIcon name="ledger" :size="28" />我的账本</button></view></scroll-view>
      <view class="input-row"><textarea v-model="input" class="chat-input" :auto-height="false" :maxlength="2000" :disabled="sending || Boolean(pending) || !loaded" :adjust-position="false" :show-confirm-bar="false" :cursor-spacing="12" confirm-type="send" placeholder="说说这笔花销，例如：午饭35元" @confirm="send" /><button class="send-button" :disabled="sending || Boolean(pending) || !input.trim() || !loaded" aria-label="发送并记账" @tap="send"><AppIcon name="arrow-up" :size="42" color="#292A25" /></button></view>
      <text class="composer-note">{{ processing ? '消息已发送，可放心离开，结果会自动保存' : pending ? '这条消息尚未完成，重试不会重复入账' : '整理后自动入账，卡片可编辑或删除' }}</text>
    </view>
    <view v-if="historyOpen" class="history-overlay" @tap="historyOpen = false"><view class="history-sheet" @tap.stop><view class="history-title"><text>对话记录</text><button class="icon-button" @tap="historyOpen = false"><AppIcon name="close" :size="32" color="#292A25" /></button></view><button class="primary-button" @tap="chooseSession(null)"><AppIcon name="plus" :size="28" color="#292A25" />开始新对话</button><scroll-view scroll-y class="session-list"><button v-for="session in sessions" :key="session.id" class="session-row" :class="{ selected: sessionId === session.id }" @tap="chooseSession(session.id)"><text>{{ session.title }}</text><text>{{ session.created_at.slice(0, 10) }}</text></button><text v-if="!sessions.length" class="session-empty">你的对话会保存在这里</text></scroll-view><text class="history-hint">每段对话展示最近 100 条消息</text></view></view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.chat-page { position: relative; display: flex; flex-direction: column; width: 100%; height: 100vh; min-height: 0; overflow: hidden; max-width: 960rpx; margin: 0 auto; box-sizing: border-box; background: #FBF7E8; }
.chat-head { flex-shrink: 0; padding: var(--app-status-bar-height, 44px) 22rpx 14rpx; background: #FFE994; }
.chat-titlebar { display: flex; align-items: center; gap: 12rpx; }
.chat-titlebar .icon-button { width: 68rpx; height: 76rpx; }
.assistant-name { display: flex; flex-direction: column; min-width: 0; }.assistant-name text:first-child { font-size: 34rpx; font-weight: 600; }.assistant-name text:last-child { color: #776A3E; font-size: 21rpx; }.history-toggle { margin-left: auto; }
.chat-stream-wrap { flex: 1; min-height: 0; overflow: hidden; }.chat-stream { width: 100%; height: 100%; }.chat-content { padding: 28rpx 24rpx 8rpx; }.chat-intro { display: block; margin: 0 0 34rpx; text-align: center; font-size: 23rpx; color: $muted; }.chat-loading { padding: 36rpx; text-align: center; color: $muted; font-size: 26rpx; }
.message-row { display: flex; gap: 14rpx; margin-bottom: 32rpx; align-items: flex-start; }.message-row.user { justify-content: flex-end; padding-left: 40rpx; }
.avatar, .user-avatar { flex-shrink: 0; width: 68rpx; height: 68rpx; border-radius: 50%; }.user-avatar { display: flex; align-items: center; justify-content: center; background: #FFDC60; color: #5B4A16; font-size: 25rpx; }.message-body { flex: 1; min-width: 0; max-width: 570rpx; }.user .message-body { flex: initial; max-width: calc(100% - 82rpx); }
.bubble { padding: 23rpx 26rpx; border-radius: 4rpx 28rpx 28rpx 28rpx; background: #FFF; font-size: 29rpx; line-height: 1.65; color: $ink; overflow-wrap: anywhere; white-space: pre-wrap; }
.user .bubble { background: #FFDF59; border-radius: 28rpx 4rpx 28rpx 28rpx; }.assistant-reply { margin-top: 20rpx; }.message-status { display: block; margin-top: 8rpx; text-align: right; font-size: 21rpx; color: $muted; }
.example-chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }.example-chips button { margin: 0; padding: 12rpx 20rpx; border: 1rpx solid $line; border-radius: 30rpx; background: #FFF5CC; color: $ink; font-size: 24rpx; line-height: 1.4; }
.receipt-card { padding: 18rpx; margin-bottom: 14rpx; border: 5rpx solid #FFDF59; border-radius: 28rpx; background: #FFF; box-shadow: 0 2rpx 0 #C7AE5E; }
.receipt-main { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 0 24rpx; margin: 0; background: transparent; text-align: left; line-height: 1.5; }.receipt-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 72rpx; height: 72rpx; border-radius: 50%; background: #F5F4EF; }.receipt-copy { flex: 1; min-width: 0; }.receipt-copy text:first-child { display: block; font-size: 28rpx; color: $ink; }.receipt-copy text:last-child { display: block; font-size: 23rpx; color: $muted; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.receipt-amount { flex-shrink: 0; max-width: 44%; color: $expense; font-size: 30rpx; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.receipt-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10rpx; padding-top: 18rpx; border-top: 1rpx solid #ECEBE5; }.receipt-bottom > text { color: $muted; font-size: 23rpx; }.receipt-actions { display: flex; gap: 10rpx; }.receipt-actions button { display: flex; align-items: center; justify-content: center; gap: 6rpx; min-height: 60rpx; margin: 0; padding: 10rpx 18rpx; border-radius: 32rpx; background: #F5F4EF; color: $ink; font-size: 23rpx; line-height: 1.4; }
.typing { font-size: 25rpx; }.typing-dots { display: flex; gap: 8rpx; margin-top: 12rpx; }.typing-dots view { width: 9rpx; height: 9rpx; border-radius: 50%; background: #C2AF66; }
.chat-error { margin: 18rpx 12rpx 26rpx; padding: 22rpx; border-radius: 22rpx; border: 1rpx solid #E1CBA6; background: #FFF8E8; color: $danger; font-size: 25rpx; line-height: 1.6; }.chat-error button { margin: 16rpx 0 0; padding: 14rpx 20rpx; border-radius: 16rpx; background: #FFDF59; color: $ink; font-size: 25rpx; line-height: 1.4; }
.chat-end { height: 12rpx; }.chat-composer { flex-shrink: 0; padding: 16rpx 22rpx calc(16rpx + env(safe-area-inset-bottom)); background: #FCECB7; border-top: 1rpx solid #F3E3B4; }.shortcuts { white-space: nowrap; }.shortcut-inner { display: flex; gap: 14rpx; }.shortcut-inner button { display: flex; flex-shrink: 0; align-items: center; gap: 8rpx; margin: 0; padding: 14rpx 20rpx; border-radius: 20rpx; border: 1rpx solid #EDE5D3; background: #FFF; color: $ink; font-size: 25rpx; line-height: 1.4; }
.input-row { display: flex; align-items: flex-end; gap: 14rpx; margin-top: 20rpx; }.chat-input { display: block; flex: 1; min-width: 0; width: 100%; height: 108rpx; min-height: 108rpx; max-height: 108rpx; padding: 20rpx 24rpx; border-radius: 28rpx; background: #FFF; color: $ink; font-size: 28rpx; line-height: 1.5; box-sizing: border-box; }.send-button { display: flex; justify-content: center; align-items: center; flex-shrink: 0; width: 82rpx; height: 86rpx; margin: 0 0 2rpx; padding: 0; border-radius: 26rpx; border: 2rpx solid #A88B3A; background: #FFDF59; }.send-button[disabled] { opacity: .4; }.composer-note { display: block; margin-top: 13rpx; color: #756D52; text-align: center; font-size: 20rpx; }
.keyboard-open .shortcuts, .keyboard-open .composer-note { display: none; }.keyboard-open .input-row { margin-top: 0; }
.session-list { height: 44vh; }
.history-overlay { position: fixed; z-index: 120; inset: 0; display: flex; align-items: flex-end; background: rgba(30,30,22,.48); }.history-sheet { width: 100%; max-width: 960rpx; margin: auto auto 0; padding: 22rpx 30rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: $canvas; }.history-title { display: flex; justify-content: space-between; align-items: center; font-size: 32rpx; font-weight: 600; }.session-list { max-height: 50vh; }.session-row { display: flex; justify-content: space-between; gap: 18rpx; margin: 18rpx 0 0; padding: 24rpx; border-radius: 18rpx; background: #FFF; color: $ink; font-size: 25rpx; line-height: 1.5; }.session-row text:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.session-row text:last-child { flex-shrink: 0; color: $muted; font-size: 22rpx; }.session-row.selected { background: #FFF1AE; }.session-empty,.history-hint { display: block; padding-top: 26rpx; color: $muted; text-align: center; font-size: 23rpx; }
</style>
