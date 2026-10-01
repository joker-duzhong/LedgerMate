import { computed, reactive, ref } from 'vue'
import { createRecord, deleteRecord, getRecord, listCategories, listPaymentMethods, updateRecord } from '@/api/ledger'
import type { Category, PaymentMethod, RecordPayload, RecordType } from '@/types/api'
import { parseCalendarDate, todayDate } from '@/utils/calendar'
import { markLedgerChanged } from '@/utils/navigation'
import { ApiError } from '@/utils/request'
import { draftFingerprint, draftToPayload, localRecordFields, type RecordDraft } from '@/utils/recordEditor'

export const useRecordEditor = () => {
  const recordId = ref('')
  const draft = reactive<RecordDraft>({
    recordType: 'expense', amount: '', categoryId: '', paymentMethodId: '', note: '',
    occurredDate: todayDate(),
  })
  const categories = ref<Category[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const loading = ref(true)
  const ready = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const errorMessage = ref('')
  const loadError = ref('')
  const pendingCreate = ref<RecordPayload | null>(null)
  const completed = ref(false)
  const baseline = ref('')
  const originalPaymentId = ref('')
  const isEditing = computed(() => Boolean(recordId.value))
  const busy = computed(() => saving.value || deleting.value)
  const fieldsLocked = computed(() => busy.value || Boolean(pendingCreate.value) || completed.value)
  const dirty = computed(() => ready.value && !completed.value && (Boolean(pendingCreate.value) || baseline.value !== draftFingerprint(draft)))
  const filteredCategories = computed(() => categories.value.filter((item) => item.record_type === draft.recordType && (item.is_enabled || isEditing.value && item.id === draft.categoryId)))
  const paymentOptions = computed(() => {
    const options = paymentMethods.value.map((item) => ({ id: item.id, name: item.name }))
    options.unshift({ id: '', name: '未指定' })
    if (draft.paymentMethodId && !options.some((item) => item.id === draft.paymentMethodId)) options.push({ id: draft.paymentMethodId, name: '原支付方式（已停用）' })
    return options
  })
  const selectedPaymentIndex = computed(() => Math.max(0, paymentOptions.value.findIndex((item) => item.id === draft.paymentMethodId)))
  let disposed = false
  let loadingOptions = false
  let keySequence = 0

  const syncCategory = () => {
    if (!filteredCategories.value.some((item) => item.id === draft.categoryId)) draft.categoryId = filteredCategories.value[0]?.id || ''
  }

  const refreshOptions = async () => {
    if (loadingOptions || disposed) return
    loadingOptions = true
    try {
      const [categoryList, paymentList] = await Promise.all([listCategories(), listPaymentMethods()])
      if (disposed) return
      categories.value = categoryList || []
      paymentMethods.value = (paymentList || []).filter((item) => item.is_enabled)
      syncCategory()
    } catch (error) {
      if (!disposed) errorMessage.value = error instanceof Error ? error.message : '分类加载失败，请重试'
    } finally {
      loadingOptions = false
    }
  }

  const load = async (id = recordId.value, initialDate = '') => {
    if (disposed || loadingOptions || busy.value) return
    recordId.value = id
    loading.value = true
    loadingOptions = true
    loadError.value = ''
    errorMessage.value = ''
    try {
      const [categoryList, paymentList, record] = await Promise.all([
        listCategories(), listPaymentMethods(), id ? getRecord(id) : Promise.resolve(null),
      ])
      if (disposed) return
      categories.value = categoryList || []
      paymentMethods.value = (paymentList || []).filter((item) => item.is_enabled)
      if (record) {
        Object.assign(draft, {
          recordType: record.record_type, amount: `${Math.floor(record.amount_cent / 100)}.${String(record.amount_cent % 100).padStart(2, '0')}`,
          categoryId: record.category_id, paymentMethodId: record.payment_method_id || '', note: record.note || '',
          ...localRecordFields(record.occurred_date),
        })
        originalPaymentId.value = record.payment_method_id || ''
      } else {
        if (parseCalendarDate(initialDate)) draft.occurredDate = initialDate
        draft.paymentMethodId = paymentMethods.value.find((item) => item.is_default)?.id || ''
        syncCategory()
      }
      baseline.value = draftFingerprint(draft)
      ready.value = true
    } catch (error) {
      if (!disposed) loadError.value = error instanceof Error ? error.message : '记账信息加载失败，请重试'
    } finally {
      if (!disposed) loading.value = false
      loadingOptions = false
    }
  }

  const changeType = (type: RecordType) => {
    if (fieldsLocked.value) return
    draft.recordType = type
    syncCategory()
  }

  const selectCategory = (id: string) => {
    if (!fieldsLocked.value) draft.categoryId = id
  }

  const save = async (continueAdding = false): Promise<boolean> => {
    if (disposed || loading.value || !ready.value || busy.value || completed.value) return false
    let payload: RecordPayload
    try {
      payload = pendingCreate.value || draftToPayload(draft)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '请检查填写内容'
      return false
    }
    saving.value = true
    errorMessage.value = ''
    if (!isEditing.value && !pendingCreate.value) {
      payload.idempotency_key = `${Date.now()}-${++keySequence}-${Math.random().toString(36).slice(2)}`
      pendingCreate.value = { ...payload }
    }
    try {
      if (isEditing.value) await updateRecord(recordId.value, draft.paymentMethodId ? payload : { ...payload, payment_method_id: null })
      else await createRecord(payload)
      markLedgerChanged()
      if (disposed) return false
      pendingCreate.value = null
      if (continueAdding && !isEditing.value) {
        draft.amount = ''
        draft.note = ''
        baseline.value = draftFingerprint(draft)
      } else {
        completed.value = true
      }
      return true
    } catch (error) {
      if (!disposed) {
        if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 422)) pendingCreate.value = null
        const message = error instanceof Error ? error.message : '保存失败'
        errorMessage.value = pendingCreate.value ? `${message}。请重试确认这笔账，避免重复记账。` : `${message}，请重试`
      }
      return false
    } finally {
      if (!disposed) saving.value = false
    }
  }

  const remove = async (): Promise<boolean> => {
    if (disposed || !isEditing.value || !ready.value || busy.value || completed.value) return false
    deleting.value = true
    errorMessage.value = ''
    try {
      await deleteRecord(recordId.value)
      markLedgerChanged()
      if (disposed) return false
      completed.value = true
      return true
    } catch (error) {
      if (!disposed) errorMessage.value = error instanceof Error ? error.message : '删除失败，请重试'
      return false
    } finally {
      if (!disposed) deleting.value = false
    }
  }

  const dispose = () => { disposed = true }

  return {
    draft, categories, paymentOptions, selectedPaymentIndex, filteredCategories, loading, ready, saving, deleting,
    busy, fieldsLocked, errorMessage, loadError, pendingCreate, dirty, isEditing, completed,
    load, refreshOptions, changeType, selectCategory, save, remove, dispose,
  }
}
