type ChartContext = Pick<UniApp.CanvasContext, 'clearRect' | 'setLineWidth' | 'beginPath' | 'setStrokeStyle' | 'arc' | 'stroke' | 'setFontSize' | 'setTextAlign' | 'setFillStyle' | 'fillText' | 'moveTo' | 'lineTo' | 'fill' | 'fillRect' | 'draw'>

// 微信同层 Canvas 2D 立即绘制；其余端继续使用 uni 的命令式画布。
export const canvas2DContext = (context: CanvasRenderingContext2D): ChartContext => ({
  clearRect: (x, y, width, height) => context.clearRect(x, y, width, height),
  setLineWidth: (value) => { context.lineWidth = value },
  beginPath: () => context.beginPath(),
  setStrokeStyle: (value) => { context.strokeStyle = value as string },
  arc: (x, y, radius, start, end, anticlockwise) => context.arc(x, y, radius, start, end, anticlockwise),
  stroke: () => context.stroke(),
  setFontSize: (value) => { context.font = `${value}px sans-serif` },
  setTextAlign: (value) => { context.textAlign = value },
  setFillStyle: (value) => { context.fillStyle = value as string },
  fillText: (text, x, y, maxWidth) => { if (maxWidth === undefined) context.fillText(text, x, y); else context.fillText(text, x, y, maxWidth) },
  moveTo: (x, y) => context.moveTo(x, y),
  lineTo: (x, y) => context.lineTo(x, y),
  fill: () => context.fill(),
  fillRect: (x, y, width, height) => context.fillRect(x, y, width, height),
  draw: () => {},
})
