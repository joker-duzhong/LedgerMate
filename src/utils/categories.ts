import type { Category, RecordType } from '@/types/api'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const recordType = (value: unknown): RecordType | null => value === 'income' || value === 'expense' ? value : null
const booleanValue = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    if (/^(?:true|1|yes)$/i.test(value.trim())) return true
    if (/^(?:false|0|no)$/i.test(value.trim())) return false
  }
  return fallback
}

const iconValue = (value: UnknownRecord) => {
  for (const field of ['icon', 'icon_url', 'icon_path', 'image_url']) {
    const icon = value[field]
    if (typeof icon === 'string' && icon.trim()) return icon.trim()
    if (isRecord(icon)) {
      for (const key of ['url', 'path', 'src']) if (typeof icon[key] === 'string' && icon[key].trim()) return icon[key].trim()
    }
  }
  return null
}

const rowsFrom = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return value == null ? [] : null
  for (const key of ['items', 'categories', 'data']) if (Array.isArray(value[key])) return value[key]
  return null
}

/** 兼容个人分类和全局分类模板同步后的多种字段命名。 */
export const normalizeCategories = (value: unknown): Category[] => {
  const rows = rowsFrom(value)
  if (!rows) throw new Error('分类信息格式异常，请重新加载')
  return rows.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = typeof item.id === 'string' ? item.id : typeof item.category_id === 'string' ? item.category_id : ''
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const type = recordType(item.record_type ?? item.type)
    if (!id || !name || !type) return []
    const enabledValue = item.is_enabled ?? item.is_active ?? item.enabled
    const systemValue = item.is_system ?? item.is_global ?? item.is_template
    const sortOrder = Number(item.sort_order ?? item.sort ?? 0)
    return [{
      id, name, record_type: type, icon: iconValue(item),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_enabled: booleanValue(enabledValue, true),
      is_system: booleanValue(systemValue, false),
    } satisfies Category]
  }).sort((first, second) => (first.record_type === second.record_type ? (first.sort_order || 0) - (second.sort_order || 0) : first.record_type === 'expense' ? -1 : 1))
}
