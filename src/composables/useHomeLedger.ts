import { computed, ref, watch } from 'vue'
import { listCategories, listRecords } from '@/api/ledger'
import { useAuthStore } from '@/stores/auth'
import type { Category, RecordItem, RecordType } from '@/types/api'
import { collectRecords, currentMonth, filterRecords, groupRecordsByDay, recordDate, recordTotals, shiftMonth } from '@/utils/ledger'
import { ledgerRevision } from '@/utils/navigation'

export const useHomeLedger = () => {
  const auth = useAuthStore()
  const isGuest = computed(() => !auth.isLoggedIn)
  const month = ref(currentMonth())
  const selectedDate = ref('')
  const type = ref<RecordType | 'all'>('all')
  const keyword = ref('')
  const records = ref<RecordItem[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const loadedMonth = ref('')
  const errorMessage = ref('')
  const loadedCount = ref(0)
  const totalCount = ref(0)
  let operation = 0
  let disposed = false
  let lastRevision = -1
  let loadedSessionVersion = -1
  const monthRecords = computed(() => filterRecords(records.value, categories.value, { month: month.value, type: 'all', keyword: '' }))
  const visibleRecords = computed(() => filterRecords(monthRecords.value, categories.value, { month: month.value, type: type.value, keyword: keyword.value }).filter(item => !selectedDate.value || recordDate(item) === selectedDate.value))
  const groups = computed(() => groupRecordsByDay(visibleRecords.value))
  const totals = computed(() => recordTotals(monthRecords.value))
  const filteredTotals = computed(() => recordTotals(visibleRecords.value))
  const categoryNames = computed(() => new Map(categories.value.map(item => [item.id, item.name])))
  const categoryById = computed(() => new Map(categories.value.map(item => [item.id, item])))
  const reset = () => {
    operation += 1
    records.value = []
    categories.value = []
    selectedDate.value = ''
    type.value = 'all'
    keyword.value = ''
    loading.value = false
    loaded.value = false
    loadedMonth.value = ''
    errorMessage.value = ''
    loadedCount.value = 0
    totalCount.value = 0
    lastRevision = -1
    loadedSessionVersion = -1
  }
  const stopSessionWatch = watch(() => auth.sessionVersion, reset, { flush: 'sync' })
  const load = async (force = false) => {
    if (disposed) return
    if (isGuest.value) { reset(); uni.stopPullDownRefresh?.(); return }
    const requestedSessionVersion = auth.sessionVersion
    if (!force && loaded.value && loadedMonth.value === month.value && lastRevision === ledgerRevision() && loadedSessionVersion === requestedSessionVersion) return
    const current = ++operation
    const requestedRevision = ledgerRevision()
    const requestedMonth = month.value
    loading.value = true
    errorMessage.value = ''
    loadedCount.value = 0
    totalCount.value = 0
    let active = true
    const isCurrent = () => active && !disposed && current === operation && requestedSessionVersion === auth.sessionVersion && !isGuest.value
    try {
      const [items, categoryList] = await Promise.all([
        collectRecords(params => listRecords({ ...params, start_date: requestedMonth + '-01', end_date: shiftMonth(requestedMonth, 1) + '-01' }), (count, total) => { if (isCurrent()) { loadedCount.value = count; totalCount.value = total } }, isCurrent),
        listCategories(),
      ])
      if (!isCurrent() || !items) return
      records.value = items
      categories.value = categoryList || []
      loadedMonth.value = requestedMonth
      loaded.value = true
      lastRevision = requestedRevision
      loadedSessionVersion = requestedSessionVersion
    } catch (error) {
      if (isCurrent()) errorMessage.value = error instanceof Error ? error.message : '账单加载失败，请重试'
    } finally {
      if (isCurrent()) { loading.value = false; uni.stopPullDownRefresh() }
      active = false
    }
  }
  const stopMonthWatch = watch(month, () => {
    if (selectedDate.value && !selectedDate.value.startsWith(month.value)) selectedDate.value = ''
    void load()
  })
  const dispose = () => { disposed = true; operation += 1; stopMonthWatch(); stopSessionWatch() }
  return { month, selectedDate, type, keyword, isGuest, loading, loaded, loadedMonth, errorMessage, loadedCount, totalCount, monthRecords, visibleRecords, groups, totals, filteredTotals, categoryNames, categoryById, load, dispose }
}
