export const categoryIcon = (name: string): string => {
  if (/餐|食|饭|饮|咖啡|水果|买菜/.test(name)) return 'food'
  if (/交通|车|油|出行|地铁|打的/.test(name)) return 'transport'
  if (/购物|服|饰|日用|数码|美妆/.test(name)) return 'shopping'
  if (/房|住|租|物业|水电|家/.test(name)) return 'home'
  if (/医|药|健|保健/.test(name)) return 'health'
  if (/学|书|教育|培训/.test(name)) return 'education'
  if (/礼|红包|人情/.test(name)) return 'gift'
  if (/工资|薪|奖金|兼职|报销/.test(name)) return 'salary'
  return 'wallet'
}

/**
 * 将后台返回的图标值解析为可直接交给 image 的路径。
 * 旧数据里的 `food` 等本地图标名称继续走 CategoryIcon 的 AppIcon 回退。
 */
export const categoryIconSource = (icon: unknown): string | null => {
  if (typeof icon !== 'string') return null
  const value = icon.trim().replace(/\\/g, '/')
  if (!value || /^[a-z][a-z0-9-]*$/i.test(value)) return null
  if (/^(?:https?:|data:|blob:)/i.test(value) || value.startsWith('/')) return value
  if (value.includes('/') && !/\s/.test(value)) return `/${value.replace(/^\.\//, '')}`
  if (/^(?:\.\.?(?:\/|\\)|[^\s/]+\/).+\.(?:png|jpe?g|gif|svg|webp)(?:[?#].*)?$/i.test(value)) return `/${value.replace(/^\.\//, '')}`
  if (/^[^\s]+\.(?:png|jpe?g|gif|svg|webp)(?:[?#].*)?$/i.test(value)) return `/${value}`
  return null
}
