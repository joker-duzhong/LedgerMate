import { computed, ref } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { calculateNavigationLayout, hasNavigationWindowInfo } from '@/utils/navigationLayout'
import type { NavigationCapsule, NavigationWindowInfo } from '@/utils/navigationLayout'

const readLayout = () => {
  let info: NavigationWindowInfo | undefined
  try { if (typeof uni.getWindowInfo === 'function') info = uni.getWindowInfo() } catch {}
  if (!hasNavigationWindowInfo(info)) {
    try {
      const legacy = uni.getSystemInfoSync()
      if (hasNavigationWindowInfo(legacy)) info = legacy
    } catch {}
  }
  let isWechat = false
  let capsule: NavigationCapsule | undefined
  // #ifdef MP-WEIXIN
  isWechat = true
  try { if (typeof uni.getMenuButtonBoundingClientRect === 'function') capsule = uni.getMenuButtonBoundingClientRect() } catch {}
  // #endif
  return calculateNavigationLayout(info, capsule, isWechat)
}

export const useNavigationLayout = () => {
  const layout = ref(readLayout())
  let listening = false
  let disposed = false
  const refresh = () => { if (!disposed) layout.value = readLayout() }
  const stop = () => {
    if (listening) {
      try { uni.offWindowResize(refresh) } catch {}
      listening = false
    }
  }
  onShow(() => {
    refresh()
    if (!disposed && !listening && typeof uni.onWindowResize === 'function') {
      try { uni.onWindowResize(refresh); listening = true } catch {}
    }
  })
  onHide(stop)
  onUnload(() => { disposed = true; stop() })
  const navigationStyle = computed(() => ({
    '--app-status-bar-height': layout.value.statusBarHeight + 'px',
    '--app-nav-bar-height': layout.value.navigationBarHeight + 'px',
    '--app-capsule-right': layout.value.capsuleInsetRight + 'px',
    '--app-nav-total-height': layout.value.totalHeight + 'px',
  }))
  return { navigationStyle }
}
