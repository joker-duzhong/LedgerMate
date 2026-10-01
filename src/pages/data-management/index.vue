<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import { confirmImport, exportRecords, previewImport } from '@/api/ledger'
import type { ExportResult, ImportPreview } from '@/types/api'
import { currentMonth, shiftMonth } from '@/utils/ledger'
import { goHome, markLedgerChanged } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { saveWeChatExport, type ExportFileOutcome, type WeChatExportApi } from '@/utils/exportFile'

type Mode = 'import' | 'export'
type ExportFormat = 'csv' | 'json'
type ExportRange = 'all' | 'month'
interface ImportFile { name: string; content: string }
const messageOf = (value: unknown, fallback: string) => {
  if (!value || typeof value !== 'object' || !('message' in value)) return fallback
  return String((value as Record<string, unknown>).message || fallback)
}

const { navigationStyle } = useNavigationLayout()
const mode = ref<Mode>('import')
const format = ref<ExportFormat>('csv')
const range = ref<ExportRange>('all')
const exportMonth = ref(currentMonth())
const exportType = ref<'all' | 'income' | 'expense'>('all')
const selectedFile = ref<ImportFile | null>(null)
const preview = ref<ImportPreview | null>(null)
const skipDuplicates = ref(true)
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')
const resultMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const validRows = computed(() => preview.value?.valid_count || 0)
const hasErrors = computed(() => Boolean(preview.value?.error_count))
const warningRows = computed(() => preview.value?.rows.filter((row) => row.warnings?.length).length || 0)
const confirmRows = computed(() => validRows.value + (!skipDuplicates.value ? (preview.value?.duplicate_count || 0) : 0))
const canConfirm = computed(() => Boolean(preview.value && !hasErrors.value && confirmRows.value))
const back = () => uni.navigateBack({ delta: 1, fail: goHome })
const switchMode = (value: Mode) => { if (!loading.value && !exporting.value) { mode.value = value; errorMessage.value = ''; resultMessage.value = '' } }

const readH5File = (file: File): Promise<ImportFile> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ name: file.name, content: String(reader.result || '') })
  reader.onerror = () => reject(new Error('文件读取失败，请重试'))
  reader.readAsText(file, 'utf-8')
})
const chooseFile = () => new Promise<ImportFile>((resolve, reject) => {
  // #ifdef H5
  fileInput.value?.click()
  const input = fileInput.value
  if (!input) reject(new Error('当前页面暂不支持选择文件'))
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['csv', 'json'],
    success: ({ tempFiles }) => {
      const file = tempFiles?.[0]
      const wxApi = (globalThis as unknown as { wx?: { env?: { USER_DATA_PATH?: string }; getFileSystemManager?: () => { readFile: (options: Record<string, unknown>) => void } } }).wx
      if (!file || !wxApi?.getFileSystemManager) { reject(new Error('没有读取到文件')); return }
      wxApi.getFileSystemManager().readFile({ filePath: file.path, encoding: 'utf8', success: (response: { data?: unknown }) => resolve({ name: file.name || '账伴账单.csv', content: String(response.data || '') }), fail: () => reject(new Error('文件读取失败，请重试')) })
    },
    fail: () => reject(new Error('未选择文件')),
  })
  // #endif
  // #ifndef H5
  // #ifndef MP-WEIXIN
  reject(new Error('当前平台暂不支持选择账单文件'))
  // #endif
  // #endif
})
const onH5FileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { await useFile(await readH5File(file)) } catch (error) { errorMessage.value = error instanceof Error ? error.message : '文件读取失败，请重试' }
}
const useFile = async (file: ImportFile) => {
  selectedFile.value = file
  preview.value = null
  resultMessage.value = ''
  errorMessage.value = ''
  loading.value = true
  try {
    preview.value = await previewImport({ file_name: file.name, content: file.content })
    if (!preview.value.total) errorMessage.value = '文件中没有可读取的账单行'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '导入预览失败，请重试'
  } finally { loading.value = false }
}
const pickFile = async () => {
  if (!ensureLogin() || loading.value) return
  // #ifdef H5
  fileInput.value?.click()
  return
  // #endif
  try { await useFile(await chooseFile()) } catch (error) {
    const message = messageOf(error, '文件读取失败，请重试')
    if (message !== '未选择文件') errorMessage.value = message
  }
}
const submitImport = async () => {
  if (!ensureLogin() || !preview.value || !canConfirm.value || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await confirmImport(preview.value.batch_id, { skip_duplicates: skipDuplicates.value })
    markLedgerChanged()
    resultMessage.value = `已导入 ${result.imported_count} 笔${result.skipped_count ? `，跳过 ${result.skipped_count} 笔` : ''}${result.error_count ? `，失败 ${result.error_count} 笔` : ''}`
    preview.value = null
    selectedFile.value = null
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : '导入确认失败，请重试' }
  finally { loading.value = false }
}
const exportParams = computed(() => ({
  format: format.value,
  ...(range.value === 'month' ? { start_date: `${exportMonth.value}-01`, end_date: `${shiftMonth(exportMonth.value, 1)}-01` } : {}),
  ...(exportType.value === 'all' ? {} : { record_type: exportType.value }),
}))
const saveExport = async (result: ExportResult): Promise<ExportFileOutcome> => {
  // #ifdef H5
  const blob = new Blob([result.content], { type: result.mime_type || 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.file_name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
  // #endif
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as unknown as { wx?: WeChatExportApi }).wx
  const platform = (() => { try { return uni.getSystemInfoSync().platform } catch { return '' } })()
  return saveWeChatExport(wxApi, platform, result)
  // #endif
  // #ifndef H5
  // #ifndef MP-WEIXIN
  throw new Error('当前平台暂不支持导出文件')
  // #endif
  // #endif
}
const downloadExport = async () => {
  if (!ensureLogin() || exporting.value) return
  exporting.value = true
  errorMessage.value = ''
  resultMessage.value = ''
  try {
    const result = await exportRecords(exportParams.value)
    if (!result.record_count) { errorMessage.value = '当前筛选没有账单，暂不生成空文件'; return }
    const outcome = await saveExport(result)
    if (outcome === 'cancelled') {
      uni.showToast({ title: '已取消导出，可重新尝试', icon: 'none' })
      return
    }
    resultMessage.value = outcome === 'shared' ? '文件已分享，可在聊天中保存' : outcome === 'saved' ? '文件已保存' : '已发起文件下载，请查看浏览器下载列表'
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : '导出失败，请重试' }
  finally { exporting.value = false }
}
onLoad((query) => { if (query?.mode === 'export') mode.value = 'export' })
onShow(() => { ensureLogin() })
</script>

<template>
  <view class="page-shell data-page" :style="navigationStyle">
    <view class="data-head capsule-safe"><button class="icon-button" aria-label="返回上一页" @tap="back"><AppIcon name="chevron-left" :size="38" color="#292A25" /></button><text class="page-title">数据管理</text></view>
    <text class="page-subtitle">把账单带进来，也把自己的数据带走</text>
    <view class="mode-switch segmented"><button :class="{ active: mode === 'import' }" @tap="switchMode('import')">导入账单</button><button :class="{ active: mode === 'export' }" @tap="switchMode('export')">导出数据</button></view>

    <view v-if="errorMessage" class="form-error" role="alert"><text>{{ errorMessage }}</text></view>
    <view v-if="resultMessage" class="result-message"><AppIcon name="check" :size="28" color="#188544" /><text>{{ resultMessage }}</text></view>

    <template v-if="mode === 'import'">
      <view class="card data-card import-card"><text class="card-title">导入 CSV / JSON</text><text class="card-copy">支持“时间、类型、分类、金额、账户、备注”字段。导入前会先预览和校验，不会直接写入账单。</text><button class="primary-button file-button" :disabled="loading" @tap="pickFile"><AppIcon name="upload" :size="32" color="#292A25" />{{ loading ? '正在读取…' : selectedFile ? '重新选择文件' : '选择账单文件' }}</button>
        <!-- #ifdef H5 -->
        <input ref="fileInput" class="hidden-file" type="file" accept=".csv,.json,text/csv,application/json" @change="onH5FileChange" />
        <!-- #endif -->
        <text v-if="selectedFile" class="file-name">{{ selectedFile.name }}</text></view>
      <view v-if="preview" class="card preview-card"><view class="preview-heading"><view><text class="card-title">导入预览</text><text class="card-copy">共 {{ preview.total }} 行 · 可导入 {{ preview.valid_count }} 行 · 重复 {{ preview.duplicate_count }} 行 · 错误 {{ preview.error_count }} 行</text><text v-if="warningRows" class="preview-warning">{{ warningRows }} 行会创建新的分类或支付方式</text></view><AppIcon name="check" :size="38" color="#188544" /></view><view class="preview-options"><label><checkbox :checked="skipDuplicates" @tap="skipDuplicates = !skipDuplicates" />遇到重复账单时跳过</label></view><view v-if="hasErrors" class="error-list"><view v-for="row in preview.rows.filter(item => item.errors.length).slice(0, 5)" :key="row.row_number"><text>第 {{ row.row_number }} 行</text><text>{{ row.errors.join('；') }}</text></view></view><button class="primary-button" :disabled="loading || !canConfirm" @tap="submitImport">{{ loading ? '正在导入…' : `确认导入 ${confirmRows} 笔` }}</button></view>
    </template>

    <template v-else>
      <view class="card data-card export-card"><text class="card-title">导出我的账单</text><text class="card-copy">金额会以两位小数输出，CSV 使用 UTF-8 BOM。手机微信可通过分享面板发送文件，电脑版可保存到磁盘。</text><text class="field-label">文件格式</text><view class="format-switch segmented"><button :class="{ active: format === 'csv' }" @tap="format = 'csv'">CSV 表格</button><button :class="{ active: format === 'json' }" @tap="format = 'json'">JSON 备份</button></view><text class="field-label">导出范围</text><view class="format-switch segmented"><button :class="{ active: range === 'all' }" @tap="range = 'all'">全部账单</button><button :class="{ active: range === 'month' }" @tap="range = 'month'">指定月份</button></view><view v-if="range === 'month'" class="month-field"><MonthPicker v-model="exportMonth" /></view><text class="field-label">账单类型</text><view class="format-switch segmented"><button :class="{ active: exportType === 'all' }" @tap="exportType = 'all'">全部</button><button :class="{ active: exportType === 'expense' }" @tap="exportType = 'expense'">支出</button><button :class="{ active: exportType === 'income' }" @tap="exportType = 'income'">收入</button></view><button class="primary-button export-button" :disabled="exporting" @tap="downloadExport"><AppIcon name="download" :size="32" color="#292A25" />{{ exporting ? '正在准备文件…' : '导出文件' }}</button></view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.data-page { min-height: 100vh; padding-bottom: calc(80rpx + env(safe-area-inset-bottom)); background: $canvas; }.data-head { display: flex; align-items: center; gap: 18rpx; }.data-head .icon-button { width: 70rpx; }.data-page > .page-subtitle { margin-left: 88rpx; }.mode-switch { margin-top: 32rpx; }.data-card, .preview-card { margin-top: 24rpx; padding: 34rpx 28rpx; }.card-title { display: block; color: $ink; font-size: 31rpx; font-weight: 600; }.card-copy { display: block; margin-top: 12rpx; color: $muted; font-size: 24rpx; line-height: 1.7; }.file-button, .export-button { width: 100%; margin-top: 30rpx; }.file-name { display: block; margin-top: 18rpx; color: $brand-dark; font-size: 23rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.hidden-file { display: none; }.result-message { display: flex; align-items: center; gap: 10rpx; margin-top: 20rpx; padding: 18rpx 22rpx; border-radius: 20rpx; background: #E4F5E8; color: $income; font-size: 24rpx; }.preview-heading { display: flex; align-items: center; justify-content: space-between; }.preview-warning { display: block; margin-top: 8rpx; color: $brand-dark; font-size: 22rpx; }.preview-options { margin: 24rpx 0; padding: 18rpx; border-radius: 18rpx; background: #FFF8DE; color: $muted; font-size: 23rpx; }.preview-options label { display: flex; align-items: center; gap: 8rpx; }.error-list { max-height: 310rpx; margin-bottom: 24rpx; padding: 18rpx; overflow-y: auto; border-radius: 18rpx; background: #FFF1EB; color: $danger; font-size: 22rpx; line-height: 1.6; }.error-list view { padding: 10rpx 0; border-bottom: 1rpx solid #F0D6CE; }.error-list view:last-child { border-bottom: 0; }.error-list text { display: block; }.field-label { display: block; margin: 28rpx 0 12rpx; color: $muted; font-size: 24rpx; }.format-switch { width: 100%; }.format-switch > button { min-height: 66rpx; font-size: 24rpx; line-height: 66rpx; }.month-field { margin-top: 12rpx; padding: 8rpx 12rpx; border: 1rpx solid $line; border-radius: 18rpx; background: #FFFDF4; }.month-field :deep(.month-picker) { width: 100%; justify-content: space-between; }.month-field :deep(.month-label) { flex: 1; }.export-button { margin-top: 36rpx; }
</style>
