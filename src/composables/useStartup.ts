import { ref } from 'vue'
import { miniappLogin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { PREVIEW_PATHS } from '@/utils/authNavigation'
import { getWechatCode, PRIVACY_AGREED_KEY } from '@/utils/wechatIdentity'

export const useStartup = (canUseWechat: boolean) => {
  const auth = useAuthStore()
  const errorMessage = ref('')
  let started = false
  let disposed = false
  let checking = false
  let navigating = false
  let navigated = false
  let verificationTimer: ReturnType<typeof setTimeout> | undefined
  let navigationTimer: ReturnType<typeof setTimeout> | undefined

  const stopVerificationTimer = () => {
    if (verificationTimer !== undefined) clearTimeout(verificationTimer)
    verificationTimer = undefined
  }
  const stopNavigationTimer = () => {
    if (navigationTimer !== undefined) clearTimeout(navigationTimer)
    navigationTimer = undefined
  }
  const openHome = () => {
    if (disposed || checking || navigating || navigated) return
    navigating = true
    errorMessage.value = ''
    let settled = false
    const failed = () => {
      if (disposed || settled) return
      settled = true
      navigating = false
      stopNavigationTimer()
      errorMessage.value = '暂时无法打开首页，请重试'
    }
    navigationTimer = setTimeout(failed, 12_000)
    try {
      uni.switchTab({
        url: PREVIEW_PATHS[0],
        success: () => {
          if (disposed || settled) return
          settled = true
          navigating = false
          navigated = true
          stopNavigationTimer()
        },
        fail: failed,
      })
    } catch { failed() }
  }
  const finish = () => {
    checking = false
    stopVerificationTimer()
    openHome()
  }

  const start = async () => {
    if (disposed || started) return
    started = true
    checking = true
    const sessionVersion = auth.sessionVersion
    // A slow identity service must not keep visitors on the loading page indefinitely.
    verificationTimer = setTimeout(finish, 12_000)
    const active = () => !disposed && checking
    try {
      if (auth.isLoggedIn || !canUseWechat || uni.getStorageSync(PRIVACY_AGREED_KEY) !== true) return
      const appid = import.meta.env.VITE_WECHAT_APP_ID
      if (!appid) return
      const code = await getWechatCode()
      if (!active() || auth.sessionVersion !== sessionVersion) return
      const identity = await miniappLogin(code, appid)
      if (!active() || auth.sessionVersion !== sessionVersion) return
      if (identity?.status === 'AUTHENTICATED') auth.saveSession(identity)
    } catch {
      // Missing or invalid identity falls back to preview; binding belongs to the login page.
    } finally {
      if (active()) finish()
    }
  }
  const dispose = () => {
    disposed = true
    checking = false
    stopVerificationTimer()
    stopNavigationTimer()
  }

  return { start, retryNavigation: openHome, errorMessage, dispose }
}
