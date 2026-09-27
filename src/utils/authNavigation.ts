import { useAuthStore } from '@/stores/auth'

export const LOGIN_PATH = '/pages/login/index'
export const PREVIEW_PATHS = ['/pages/home/index', '/pages/assets/index', '/pages/statistics/index', '/pages/manage/index'] as const
const protectedPaths = ['/pages/ai-chat/index', '/pages/record-editor/index', '/pages/record-detail/index', '/pages/category-settings/index']
let openingLogin = false

export const openLogin = () => {
  const pages = getCurrentPages()
  const currentPath = '/' + pages[pages.length - 1]?.route
  if (openingLogin || currentPath === LOGIN_PATH) return
  openingLogin = true
  const options = { url: LOGIN_PATH, complete: () => { openingLogin = false } }
  // Replace a protected page so cancelling login cannot land on another login guard.
  if (protectedPaths.includes(currentPath)) uni.redirectTo(options)
  else uni.navigateTo(options)
}

export const ensureLogin = () => {
  if (useAuthStore().isLoggedIn) return true
  openLogin()
  return false
}

export const returnFromLogin = (callbacks: { success?: () => void; fail?: () => void } = {}) => {
  const pages = getCurrentPages()
  const home = () => uni.switchTab({ url: PREVIEW_PATHS[0], ...callbacks })
  for (let index = pages.length - 2; index >= 0; index -= 1) {
    if (PREVIEW_PATHS.some(path => path === '/' + pages[index]?.route)) {
      uni.navigateBack({ delta: pages.length - 1 - index, success: callbacks.success, fail: home })
      return
    }
  }
  home()
}
