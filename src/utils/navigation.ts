import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ensureLogin, PREVIEW_PATHS } from '@/utils/authNavigation'

const revision = ref(0)
let overlayHidden = false
export const ledgerRevision = () => revision.value
export const markLedgerChanged = () => { revision.value += 1 }
export const TAB_PATHS = PREVIEW_PATHS
export const CHAT_PATH = '/pages/ai-chat/index'
export const goHome = () => uni.switchTab({ url: TAB_PATHS[0] })
let openingChat = false
export const goChat = () => {
  if (!ensureLogin()) return
  const pages = getCurrentPages()
  if (openingChat || '/' + pages[pages.length - 1]?.route === CHAT_PATH) return
  openingChat = true
  uni.navigateTo({ url: CHAT_PATH, complete: () => { openingChat = false } })
}
export const backFromChat = () => {
  if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: goHome })
  else goHome()
}

interface NativeTabBar { setData: (data: { selected?: number; hidden?: boolean; overlayHidden?: boolean; loggedIn?: boolean }) => void }
const nativeBar = (): NativeTabBar | undefined => {
  const pages = getCurrentPages() as Array<{ route?: string; getTabBar?: () => NativeTabBar; $scope?: { getTabBar?: () => NativeTabBar } }>
  const page = pages[pages.length - 1]
  return page?.getTabBar?.() || page?.$scope?.getTabBar?.()
}
export const setTabBarHidden = (hidden: boolean) => {
  overlayHidden = hidden
  const pages = getCurrentPages()
  const isTab = TAB_PATHS.some((path) => path === '/' + pages[pages.length - 1]?.route)
  const shouldHide = hidden || !isTab
  // #ifdef MP-WEIXIN
  nativeBar()?.setData({ hidden: shouldHide, overlayHidden })
  // #endif
  // #ifndef MP-WEIXIN
  if (shouldHide) uni.hideTabBar({ animation: false })
  else uni.showTabBar({ animation: false })
  // #endif
}
export const syncNativeTab = (index: number) => {
  // #ifdef MP-WEIXIN
  nativeBar()?.setData({ selected: index, hidden: overlayHidden, overlayHidden, loggedIn: useAuthStore().isLoggedIn })
  // #endif
  // #ifndef MP-WEIXIN
  if (overlayHidden) uni.hideTabBar({ animation: false })
  else uni.showTabBar({ animation: false })
  // #endif
}
