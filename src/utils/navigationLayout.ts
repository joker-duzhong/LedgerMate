export interface NavigationWindowInfo {
  windowWidth?: number
  statusBarHeight?: number
  safeArea?: { top?: number }
}
export interface NavigationCapsule {
  top?: number
  left?: number
  width?: number
  height?: number
}

const finite = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const validTop = (value: number | undefined): value is number => finite(value) && value >= 0 && value <= 150

export const calculateNavigationLayout = (info: NavigationWindowInfo | null = {}, capsule?: NavigationCapsule, isWechat = false) => {
  info ??= {}
  const status = validTop(info.statusBarHeight) ? info.statusBarHeight : undefined
  const safeTop = validTop(info.safeArea?.top) ? info.safeArea.top : undefined
  const statusBarHeight = status !== undefined || safeTop !== undefined ? Math.max(status || 0, safeTop || 0) : isWechat ? 44 : 0
  let navigationBarHeight = 44
  let capsuleInsetRight = isWechat ? 104 : 0
  if (isWechat && capsule && finite(info.windowWidth) && info.windowWidth > 0
    && finite(capsule.top) && capsule.top >= statusBarHeight && capsule.top - statusBarHeight <= 60
    && finite(capsule.left) && capsule.left > 0
    && finite(capsule.width) && capsule.width > 0 && capsule.left + capsule.width <= info.windowWidth + 1
    && finite(capsule.height) && capsule.height > 0 && capsule.height <= 100) {
    navigationBarHeight = Math.max(44, capsule.height + 2 * (capsule.top - statusBarHeight))
    capsuleInsetRight = info.windowWidth - capsule.left + 8
  }
  return { statusBarHeight, navigationBarHeight, capsuleInsetRight, totalHeight: statusBarHeight + navigationBarHeight }
}

export const hasNavigationWindowInfo = (info?: NavigationWindowInfo) => Boolean(info
  && finite(info.windowWidth) && info.windowWidth > 0
  && (validTop(info.statusBarHeight) || validTop(info.safeArea?.top)))
