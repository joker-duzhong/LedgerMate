const positive = (value: number) => Number.isFinite(value) && value > 0 ? value : 0

export const chatViewportHeight = (baseline: number, current: number, keyboard: number) => {
  const fullHeight = positive(baseline) || positive(current)
  if (!fullHeight) return 0
  const visibleHeight = positive(current) || fullHeight
  const coveredHeight = Number.isFinite(keyboard) ? Math.max(0, keyboard) : 0
  // 部分端已经缩小 windowHeight，取较小可用高度，避免再次扣除键盘。
  return Math.max(1, Math.min(visibleHeight, fullHeight - coveredHeight))
}

export const chatSafeBottom = (screenHeight: number, safeAreaBottom?: number) => {
  if (!positive(screenHeight) || !positive(safeAreaBottom || 0)) return 0
  return Math.max(0, screenHeight - safeAreaBottom!)
}
