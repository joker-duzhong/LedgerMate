import { computed, ref } from 'vue'
import { createCategory, createPaymentMethod, listCategories, listPaymentMethods } from '@/api/ledger'
import type { Category, PaymentMethod, RecordType } from '@/types/api'
import { markLedgerChanged } from '@/utils/navigation'

export type SettingsSection = 'categories' | 'payments'

const normalizeName = (name: string) => name.trim().toLocaleLowerCase()

export const useLedgerSettings = () => {
  const categories = ref<Category[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const section = ref<SettingsSection>('categories')
  const activeType = ref<RecordType>('expense')
  const name = ref('')
  const loading = ref(true)
  const loaded = ref(false)
  const saving = ref(false)
  const expanded = ref(false)
  const loadError = ref('')
  const formError = ref('')
  const visibleCategories = computed(() => categories.value.filter((item) => item.record_type === activeType.value))
  const categoryCount = computed(() => categories.value.filter((item) => item.is_enabled).length)
  const paymentCount = computed(() => paymentMethods.value.filter((item) => item.is_enabled).length)
  let loadVersion = 0

  const load = async () => {
    const version = ++loadVersion
    loading.value = true
    loadError.value = ''
    try {
      const [categoryList, paymentList] = await Promise.all([listCategories(), listPaymentMethods()])
      if (version !== loadVersion) return
      categories.value = categoryList || []
      paymentMethods.value = paymentList || []
      loaded.value = true
    } catch (error) {
      if (version === loadVersion) loadError.value = error instanceof Error ? error.message : '设置暂时无法加载，请稍后重试'
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }

  const selectSection = (next: SettingsSection) => {
    if (saving.value) return
    section.value = next
    formError.value = ''
    name.value = ''
    expanded.value = false
  }

  const selectType = (next: RecordType) => {
    if (saving.value) return
    activeType.value = next
    formError.value = ''
  }

  const toggleForm = () => {
    if (saving.value) return
    expanded.value = !expanded.value
    formError.value = ''
  }

  const add = async (): Promise<boolean> => {
    if (saving.value || loading.value || !loaded.value || loadError.value) return false
    const trimmedName = name.value.trim()
    formError.value = ''
    if (!trimmedName) {
      formError.value = section.value === 'categories' ? '先为新分类起个名字吧' : '请输入支付方式名称'
      return false
    }
    if (trimmedName.length > 30) {
      formError.value = '名称最多输入 30 个字'
      return false
    }
    const existing = section.value === 'categories' ? visibleCategories.value : paymentMethods.value
    if (existing.some((item) => normalizeName(item.name) === normalizeName(trimmedName))) {
      formError.value = section.value === 'categories' ? '这个收支类型下已有同名分类，请换一个名称' : '已有同名支付方式，请换一个名称'
      return false
    }
    saving.value = true
    try {
      if (section.value === 'categories') {
        const item = await createCategory({ name: trimmedName, record_type: activeType.value })
        categories.value.push(item)
      } else {
        const item = await createPaymentMethod({
          name: trimmedName,
          is_default: !paymentMethods.value.some((method) => method.is_enabled && method.is_default),
        })
        paymentMethods.value.push(item)
      }
      markLedgerChanged()
      name.value = ''
      expanded.value = false
      return true
    } catch (error) {
      formError.value = error instanceof Error ? error.message : '未能添加，请保留名称后重试'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    categories, paymentMethods, section, activeType, name, loading, loaded, saving, expanded,
    loadError, formError, visibleCategories, categoryCount, paymentCount,
    load, selectSection, selectType, toggleForm, add,
  }
}
