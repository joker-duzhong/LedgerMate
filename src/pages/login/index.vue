<script setup lang="ts">
import { onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import BrandWordmark from '@/components/BrandWordmark.vue'
import { useLogin } from '@/composables/useLogin'
import { useNavigationLayout } from '@/composables/useNavigationLayout'

const { navigationStyle } = useNavigationLayout()

let canUseWechat = false
// #ifdef MP-WEIXIN
canUseWechat = true
// #endif
const { agreed, initializing, loading, verifyingPhone, phone, smsCode, sendingCode, errorMessage, successMessage, phoneRequired, retrySeconds, sendRetrySeconds, login, sendCode, completePhoneLogin, cancelLogin, onShow: showLogin, dispose } = useLogin(canUseWechat)
const showAgreement = (title: string) => uni.showModal({
  title: `${title}暂未发布`,
  content: '完整内容正在完善，正式发布后可在这里查看。',
  showCancel: false,
  confirmText: '知道了',
  confirmColor: '#5B4A16',
})

onShow(showLogin)
onUnload(dispose)
</script>

<template>
  <view class="login-page" :style="navigationStyle" :class="{ 'phone-step': phoneRequired }">
    <view class="login-top"><view class="capsule-safe"><button class="icon-button login-back" aria-label="返回，继续预览" @tap="cancelLogin"><AppIcon name="chevron-left" :size="38" color="#5B4A16" /></button><text>日常有序，心里有数。</text></view></view>
    <view class="login-hero">
      <view class="brand-surround"><BrandWordmark :size="phoneRequired ? 'small' : 'large'" :vertical="!phoneRequired" /></view>
      <template v-if="!phoneRequired">
        <view class="login-title"><text>把日子，</text><text>一笔笔记好。</text></view>
        <view class="login-description"><text>一餐饭，一次出发，一份小小的心意。</text><text>和账伴一起，记下生活的每一笔。</text></view>
        <view class="hero-line"><view /><AppIcon name="leaf" :size="26" color="#5B4A16" /><view /></view>
      </template>
    </view>

    <view class="login-panel">
      <template v-if="phoneRequired"><text class="panel-title">验证手机号，就能开始</text><text class="panel-copy">输入手机号和短信验证码，创建或关联你的账伴账号。</text></template>
      <template v-else><text class="panel-title">从今天的第一笔开始</text><text class="panel-copy">使用微信登录，首次使用需验证手机号。</text></template>
      <view v-if="phoneRequired" class="phone-form">
        <view class="phone-field">
          <label for="login-phone" class="field-label">中国大陆手机号</label>
          <input id="login-phone" v-model="phone" class="phone-input" type="number" :maxlength="20" :disabled="initializing || loading || sendingCode" :cursor-spacing="24" confirm-type="next" placeholder="请输入手机号" placeholder-class="phone-placeholder" aria-label="中国大陆手机号" />
        </view>
        <view class="phone-field">
          <label for="login-code" class="field-label">短信验证码</label>
          <view class="code-row">
            <input id="login-code" v-model="smsCode" class="phone-input" type="number" :maxlength="4" :disabled="initializing || loading || sendingCode" :cursor-spacing="24" confirm-type="done" placeholder="4 位验证码" placeholder-class="phone-placeholder" aria-label="4 位短信验证码" @confirm="completePhoneLogin" />
            <button class="ghost-button send-code-button" :disabled="!agreed || initializing || loading || sendingCode || sendRetrySeconds > 0 || retrySeconds > 0" :loading="sendingCode" @tap="sendCode">{{ sendingCode ? '发送中…' : sendRetrySeconds || retrySeconds ? `${Math.max(sendRetrySeconds, retrySeconds)} 秒后重发` : '获取验证码' }}</button>
          </view>
        </view>
        <text v-if="successMessage" class="sms-message" role="status" aria-live="polite">{{ successMessage }}</text>
      </view>
      <view class="agreement" @tap="!initializing && !loading && !sendingCode && (agreed = !agreed)">
        <view class="agreement-box" :class="{ checked: agreed }" role="checkbox" :aria-checked="agreed" aria-label="同意用户协议和隐私政策"><AppIcon v-if="agreed" name="check" :size="24" color="#292A25" /></view>
        <view class="agreement-copy"><text>我已阅读并同意</text><text class="agreement-link" @tap.stop="showAgreement('用户协议')">《用户协议》</text><text>与</text><text class="agreement-link" @tap.stop="showAgreement('隐私政策')">《隐私政策》</text></view>
      </view>
      <button v-if="phoneRequired" class="primary-button login-button" :disabled="!agreed || initializing || loading || sendingCode || retrySeconds > 0" :loading="initializing || verifyingPhone" @tap="completePhoneLogin">{{ initializing ? '正在打开账本…' : retrySeconds ? `${retrySeconds} 秒后重试` : verifyingPhone ? '正在验证…' : '验证并登录' }}</button>
      <button v-else class="primary-button login-button" :disabled="!agreed || initializing || loading || retrySeconds > 0 || !canUseWechat" :loading="initializing || loading" @tap="login()">{{ initializing ? '正在打开账本…' : retrySeconds ? `${retrySeconds} 秒后重试` : loading ? '正在登录…' : '微信登录' }}</button>
      <button v-if="phoneRequired" class="restart-button" :disabled="!agreed || initializing || loading || sendingCode || retrySeconds > 0" @tap="login()">重新验证微信身份</button>
      <view v-if="errorMessage" class="login-error" role="alert"><AppIcon name="shield" :size="28" color="#B94738" /><text>{{ errorMessage }}</text></view>
      <view class="login-hint"><AppIcon name="shield" :size="23" color="#75756B" /><text>{{ !canUseWechat ? '请在微信小程序中打开，完成登录' : phoneRequired ? '手机号仅用于账号验证与关联' : '登录后可记账，也可以返回继续预览' }}</text></view>
    </view>
    <text class="login-footer">LEDGERMATE · YOUR EVERYDAY COMPANION</text>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';

.login-page { display: flex; flex-direction: column; min-height: 100vh; max-width: 960rpx; margin: 0 auto; box-sizing: border-box; padding-bottom: calc(30rpx + env(safe-area-inset-bottom)); background: $canvas; }
.login-top { padding: var(--app-status-bar-height, 44px) 36rpx 10rpx; background: #FFE477; color: $brand-dark; font-size: 22rpx; line-height: 1.5; letter-spacing: 2rpx; }
.login-back { margin-left: -20rpx; margin-right: 8rpx; }
.login-hero { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; padding: 30rpx 32rpx 66rpx; background: #FFE477; }
.brand-surround { display: flex; justify-content: center; align-items: center; margin: 0 0 28rpx; }
.login-title { color: $brand-dark; font-size: 49rpx; font-weight: 500; letter-spacing: 3rpx; line-height: 1.45; text-align: center; }
.login-title > text, .login-description > text { display: block; }
.login-description { margin-top: 22rpx; color: $brand-dark; font-size: 23rpx; line-height: 1.85; text-align: center; }
.hero-line { display: flex; align-items: center; justify-content: center; gap: 18rpx; width: 210rpx; margin-top: 28rpx; }
.hero-line > view { flex: 1; height: 1rpx; background: #CBB666; }
.login-panel { position: relative; width: calc(100% - 56rpx); box-sizing: border-box; margin: -28rpx 28rpx 0; padding: 32rpx 28rpx; border: 2rpx solid $line; border-radius: 32rpx; background: $paper; box-shadow: 0 5rpx 0 #E4D8B7; }
.panel-title { display: block; color: $ink; font-size: 31rpx; font-weight: 600; }
.panel-copy { display: block; margin-top: 11rpx; color: $muted; font-size: 23rpx; line-height: 1.7; }
.phone-step .login-hero { flex: 0; padding: 28rpx 0 60rpx; }
.phone-step .brand-surround { margin-bottom: 0; }
.phone-form { margin-top: 30rpx; }
.phone-field + .phone-field { margin-top: 24rpx; }
.field-label { display: block; margin-bottom: 12rpx; color: $ink; font-size: 26rpx; }
.phone-input { min-width: 0; width: 100%; height: 96rpx; box-sizing: border-box; padding: 0 22rpx; border: 1rpx solid $line; border-radius: 20rpx; background: $canvas; color: $ink; font-size: 30rpx; font-variant-numeric: tabular-nums; }
.phone-placeholder { color: $muted; font-size: 28rpx; }
.code-row { display: flex; align-items: center; gap: 16rpx; }
.code-row .phone-input { flex: 1; }
.send-code-button { flex: 0 0 auto; padding: 0 16rpx; font-size: 23rpx; white-space: nowrap; color: $ink; }
.sms-message { display: block; margin-top: 16rpx; color: $income; font-size: 24rpx; line-height: 1.6; }
.agreement { display: flex; align-items: center; gap: 12rpx; min-height: 76rpx; margin: 18rpx 0; padding: 6rpx 0; }
.agreement-box { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 32rpx; height: 32rpx; margin-top: 3rpx; border: 2rpx solid #AA9A67; border-radius: 9rpx; box-sizing: border-box; }
.agreement-box.checked { border-color: $brand; background: $brand; }
.agreement-copy { color: $muted; font-size: 24rpx; line-height: 1.8; }
.agreement-link { color: $brand-dark; text-decoration: underline; text-underline-offset: 4rpx; }
.login-button { width: 100%; min-height: 96rpx; border-radius: 24rpx; color: $ink; font-size: 29rpx; letter-spacing: 2rpx; }
.restart-button { margin: 12rpx 0 0; padding: 10rpx 0; background: transparent; color: $brand-dark; font-size: 24rpx; line-height: 2; }
.restart-button[disabled] { color: $muted; }
.login-error { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; padding: 18rpx; border: 1rpx solid #E8CDBF; border-radius: 14rpx; background: #F8EAE1; color: $danger; font-size: 23rpx; line-height: 1.65; }
.login-error > text { flex: 1; }
.login-hint { display: flex; justify-content: center; align-items: flex-start; gap: 8rpx; margin-top: 23rpx; color: $muted; font-size: 21rpx; line-height: 1.5; }
.login-footer { display: block; margin-top: 42rpx; color: $muted; font-size: 18rpx; letter-spacing: 1rpx; text-align: center; }
</style>
