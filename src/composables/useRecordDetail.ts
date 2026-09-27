import { computed, ref } from 'vue'
import { deleteRecord, getRecord, listCategories, listPaymentMethods } from '@/api/ledger'
import type { Category, PaymentMethod, RecordItem } from '@/types/api'
import { markLedgerChanged } from '@/utils/navigation'
import { ApiError } from '@/utils/request'

const sourceNames: Record<string, string> = { manual: '手动记账', ai: '智能记账', ai_text: '文字记账', ai_voice: '语音记账', ai_image: '图片记账', chat: '对话记账', import: '导入账单' }

export const useRecordDetail = () => {
  const record = ref<RecordItem | null>(null)
  const recordId = ref('')
  const categories = ref<Category[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const loading = ref(true)
  const deleting = ref(false)
  const deleted = ref(false)
  const errorMessage = ref('')
  const loadError = ref('')
  const category = computed(() => categories.value.find((item) => item.id === record.value?.category_id) || null)
  const categoryName = computed(() => category.value?.name || '其他分类')
  const paymentName = computed(() => record.value?.payment_method_id ? paymentMethods.value.find((item) => item.id === record.value?.payment_method_id)?.name || '已停用的支付方式' : '未指定')
  const sourceName = computed(() => sourceNames[record.value?.source || ''] || '其他方式')
  let operation = 0
  let disposed = false

  const load = async (id = recordId.value) => {
    if (disposed || deleting.value || deleted.value) return
    recordId.value = id
    errorMessage.value = ''
    loadError.value = ''
    if (!id) { loading.value = false; loadError.value = '没有找到这笔账单，请返回后重试'; return }
    const version = ++operation
    loading.value = true
    try {
      const [item, categoryList, paymentList] = await Promise.all([getRecord(id), listCategories(), listPaymentMethods()])
      if (disposed || version !== operation) return
      record.value = item
      categories.value = categoryList || []
      paymentMethods.value = paymentList || []
    } catch (error) {
      if (!disposed && version === operation) loadError.value = error instanceof Error ? error.message : '账单加载失败，请重试'
    } finally {
      if (!disposed && version === operation) loading.value = false
    }
  }

  const remove = async (): Promise<boolean> => {
    if (disposed || loading.value || deleting.value || deleted.value || !record.value) return false
    deleting.value = true
    errorMessage.value = ''
    try {
      try { await deleteRecord(record.value.id) } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 404) throw error
      }
      markLedgerChanged()
      if (disposed) return false
      deleted.value = true
      return true
    } catch (error) {
      if (!disposed) errorMessage.value = error instanceof Error ? error.message : '删除失败，请重试'
      return false
    } finally {
      if (!disposed) deleting.value = false
    }
  }

  const dispose = () => { disposed = true; operation += 1 }
  return { record, loading, deleting, deleted, errorMessage, loadError, category, categoryName, paymentName, sourceName, load, remove, dispose }
}
