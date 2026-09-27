import { computed, ref, watch } from 'vue'
import { getStatistics, listCategories, listPaymentMethods, listRecords } from '@/api/ledger'
import { useAuthStore } from '@/stores/auth'
import type { Category, PaymentMethod, RecordItem, Statistics } from '@/types/api'
import { collectRecords, currentMonth } from '@/utils/ledger'
import { ledgerRevision } from '@/utils/navigation'
import { monthDates, monthRecords } from '@/utils/statistics'

interface AnalysisSnapshot { month: string; records: RecordItem[]; categories: Category[]; payments: PaymentMethod[]; statistics: Statistics | null }

export const useMonthAnalysis = (includeStatistics = false) => {
  const auth = useAuthStore()
  const isGuest = computed(() => !auth.isLoggedIn)
  const month = ref(currentMonth())
  const emptySnapshot = (): AnalysisSnapshot => ({ month: month.value, records: [], categories: [], payments: [], statistics: null })
  const snapshot = ref<AnalysisSnapshot | null>(isGuest.value ? emptySnapshot() : null)
  const loading = ref(false)
  const errorMessage = ref('')
  let version = 0
  let loadedRevision = -1
  let loadedSessionVersion = -1
  let requestKey = ''
  let disposed = false
  const stale = computed(() => Boolean(snapshot.value && (snapshot.value.month !== month.value || errorMessage.value)))
  const reset = () => {
    version += 1
    snapshot.value = emptySnapshot()
    loading.value = false
    errorMessage.value = ''
    loadedRevision = -1
    loadedSessionVersion = -1
    requestKey = ''
  }
  const stopSessionWatch = watch(() => auth.sessionVersion, reset, { flush: 'sync' })

  const load = async (force = false) => {
    if (disposed) return
    if (isGuest.value) { reset(); uni.stopPullDownRefresh?.(); return }
    const sessionVersion = auth.sessionVersion
    const revision = ledgerRevision()
    const selectedMonth = month.value
    const key = `${sessionVersion}:${selectedMonth}:${revision}`
    if (!force && (loading.value && requestKey === key || snapshot.value?.month === selectedMonth && loadedRevision === revision && loadedSessionVersion === sessionVersion && !errorMessage.value)) return
    const operation = ++version
    requestKey = key
    loading.value = true
    errorMessage.value = ''
    let running = true
    const active = () => running && !disposed && operation === version && sessionVersion === auth.sessionVersion && !isGuest.value
    try {
      const dates = monthDates(selectedMonth)
      const [records, categories, payments, statistics] = await Promise.all([
        collectRecords((page) => listRecords({ ...page, ...dates }), undefined, active),
        listCategories(), listPaymentMethods(),
        includeStatistics ? getStatistics(dates.start_date, dates.end_date) : Promise.resolve(null),
      ])
      if (!active() || !records) return
      snapshot.value = { month: selectedMonth, records: monthRecords(records, selectedMonth), categories: categories || [], payments: payments || [], statistics }
      loadedRevision = revision
      loadedSessionVersion = sessionVersion
    } catch (error) {
      if (active()) errorMessage.value = error instanceof Error ? error.message : '暂时无法加载，请重试'
    } finally {
      if (active()) { loading.value = false; uni.stopPullDownRefresh() }
      running = false
    }
  }
  const stopMonthWatch = watch(month, () => { void load() })
  const dispose = () => { disposed = true; version += 1; stopMonthWatch(); stopSessionWatch() }
  return { month, snapshot, isGuest, loading, errorMessage, stale, load, dispose }
}
