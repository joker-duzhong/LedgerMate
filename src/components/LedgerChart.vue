<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { canvas2DContext } from '@/utils/chartCanvas'

const props = withDefaults(defineProps<{ kind: 'bar' | 'line' | 'ring'; values: number[]; labels?: string[]; colors?: string[]; height?: number }>(), { labels: () => [], colors: () => ['#27AE60'], height: 300 })
const emit = defineEmits<{ select: [index: number] }>()
const instance = getCurrentInstance()
const chartId = `ledger-chart-${instance?.uid || 0}`
const failed = ref(false)
let width = 300
let pixelHeight = 150
let drawVersion = 0
let disposed = false
const fallback = computed(() => props.values.map((value, index) => `${props.labels[index] || index + 1}：${(value / 100).toFixed(2)}元`).join('；'))
const draw = async () => {
  const version = ++drawVersion
  await nextTick()
  if (disposed || version !== drawVersion) return
  const active = () => !disposed && version === drawVersion
  const render = (rect: { width: number; height?: number }, ctx: ReturnType<typeof canvas2DContext>) => {
    width = rect.width; pixelHeight = rect.height || uni.upx2px(props.height)
    const height = pixelHeight
    try {
      ctx.clearRect(0, 0, width, height)
      if (props.kind === 'ring') {
        const total = props.values.reduce((sum, value) => sum + Math.max(0, value), 0)
        const radius = Math.min(width, height) * .33
        ctx.setLineWidth(Math.min(width, height) * .16)
        if (!total) { ctx.beginPath(); ctx.setStrokeStyle('#F1ECD9'); ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI); ctx.stroke() }
        let angle = -Math.PI / 2
        props.values.forEach((value, index) => {
          if (value <= 0 || !total) return
          const next = angle + value / total * 2 * Math.PI
          ctx.beginPath(); ctx.setStrokeStyle(props.colors[index % props.colors.length]); ctx.arc(width / 2, height / 2, radius, angle, next); ctx.stroke(); angle = next
        })
      } else {
        const left = 40; const right = width - 10; const top = 12; const bottom = height - 26
        const min = Math.min(0, ...props.values); const max = Math.max(0, ...props.values)
        const extent = max - min || 1
        const y = (value: number) => bottom - (value - min) / extent * (bottom - top)
        const step = (right - left) / Math.max(props.values.length, 1)
        ctx.setFontSize(10); ctx.setTextAlign('right'); ctx.setFillStyle('#75756B')
        ;[max, min].forEach((value) => ctx.fillText(`${(value / 100).toFixed(Math.abs(value) < 10000 ? 2 : 0)}`, left - 5, y(value) + 3))
        ctx.setStrokeStyle('#E5DFC9'); ctx.setLineWidth(1)
        ctx.beginPath(); ctx.moveTo(left, y(0)); ctx.lineTo(right, y(0)); ctx.stroke()
        const color = props.colors[0]
        if (props.kind === 'line') {
          ctx.beginPath(); ctx.setStrokeStyle(color); ctx.setLineWidth(2)
          props.values.forEach((value, index) => { const x = left + (index + .5) * step; if (!index) ctx.moveTo(x, y(value)); else ctx.lineTo(x, y(value)) }); ctx.stroke()
          props.values.forEach((value, index) => { if (!value) return; ctx.beginPath(); ctx.setFillStyle(color); ctx.arc(left + (index + .5) * step, y(value), 2, 0, Math.PI * 2); ctx.fill() })
        } else {
          props.values.forEach((value, index) => { ctx.setFillStyle(value < 0 ? '#B94738' : color); ctx.fillRect(left + index * step + step * .22, Math.min(y(value), y(0)), step * .56, Math.abs(y(value) - y(0))) })
        }
        ctx.setFillStyle('#75756B'); ctx.setTextAlign('center')
        const interval = Math.max(1, Math.ceil(props.values.length / 6))
        props.values.forEach((_, index) => { if (index % interval === 0 || index === props.values.length - 1) ctx.fillText(props.labels[index] || String(index + 1), left + (index + .5) * step, height - 5) })
      }
      ctx.draw(false)
      failed.value = false
    } catch { failed.value = true }
  }
  try {
    // #ifdef MP-WEIXIN
    uni.createSelectorQuery().in(instance?.proxy).select(`#${chartId}`).fields({ node: true, size: true }, (result) => {
      if (!active()) return
      try {
        const info = result as { node?: { width: number; height: number; getContext: (type: '2d') => CanvasRenderingContext2D }; width?: number; height?: number } | null
        if (!info?.node || !info.width || !info.height) { failed.value = true; return }
        const canvas = info.node
        let ratio = 1
        try { ratio = (typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()).pixelRatio || 1 } catch { /* 使用 CSS 像素回退 */ }
        if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1
        // 重设位图尺寸会重置变换，避免多次重绘叠加像素比缩放。
        canvas.width = Math.round(info.width * ratio)
        canvas.height = Math.round(info.height * ratio)
        const context = canvas.getContext('2d')
        context.scale(ratio, ratio)
        render({ width: info.width, height: info.height }, canvas2DContext(context))
      } catch { failed.value = true }
    }).exec()
    // #endif
    // #ifndef MP-WEIXIN
    if (typeof uni.createCanvasContext !== 'function') { failed.value = true; return }
    uni.createSelectorQuery().in(instance?.proxy).select(`#${chartId}`).boundingClientRect((rect) => {
      if (!active()) return
      if (!rect || Array.isArray(rect) || !rect.width) { failed.value = true; return }
      try { render({ width: rect.width, height: rect.height }, uni.createCanvasContext(chartId, instance?.proxy)) }
      catch { failed.value = true }
    }).exec()
    // #endif
  } catch { if (active()) failed.value = true }
}
interface ChartTouch { x?: number; clientX?: number }
const select = (event: { detail?: { x?: number }; touches?: ChartTouch[]; changedTouches?: ChartTouch[] }) => {
  if (disposed || props.kind === 'ring' || !props.values.length || width <= 50) return
  const selectX = (x: number) => {
    if (!Number.isFinite(x)) return
    const index = Math.max(0, Math.min(props.values.length - 1, Math.floor((x - 40) / (width - 50) * props.values.length)))
    emit('select', index)
  }
  const touch = event.changedTouches?.[0] || event.touches?.[0]
  if (typeof touch?.x === 'number') { selectX(touch.x); return }
  const clientX = touch?.clientX ?? event.detail?.x
  if (typeof clientX !== 'number') return
  const version = drawVersion
  uni.createSelectorQuery().in(instance?.proxy).select(`#${chartId}`).boundingClientRect((rect) => {
    if (disposed || version !== drawVersion || !rect || Array.isArray(rect) || typeof rect.left !== 'number') return
    selectX(clientX - rect.left)
  }).exec()
}
onMounted(draw)
watch(() => [props.kind, props.values, props.labels, props.colors, props.height], draw, { deep: true })
onUnmounted(() => { disposed = true; drawVersion += 1 })
</script>

<template>
  <view class="ledger-chart" :style="{ height: `${props.height}rpx` }">
    <!-- #ifdef MP-WEIXIN -->
    <canvas type="2d" :id="chartId" class="chart-canvas" :aria-label="fallback" @tap="select" />
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <canvas :id="chartId" :canvas-id="chartId" class="chart-canvas" :aria-label="fallback" @tap="select" />
    <!-- #endif -->
    <text v-if="failed" class="chart-fallback">{{ fallback || '暂无图表数据' }}</text>
  </view>
</template>

<style scoped>
.ledger-chart, .chart-canvas { width: 100%; }
.ledger-chart { position: relative; z-index: 0; }
.chart-canvas { display: block; height: 100%; }
.chart-fallback { position: absolute; inset: 0; display: block; overflow-y: auto; padding: 24rpx 0; background: #FFFFFF; font-size: 24rpx; line-height: 1.8; color: #75756B; }
</style>
