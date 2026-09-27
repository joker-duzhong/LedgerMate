export const formatMoney = (amountCent: number) => {
  const sign = amountCent < 0 ? '-' : ''
  const absolute = Math.abs(amountCent)
  return `${sign}¥${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

export const amountToCent = (amount: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null
  const [integer, decimal = ''] = amount.split('.')
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0'))
}

export const formatRecordDate = (dateTime: string) => {
  const date = new Date(dateTime)
  if (Number.isNaN(date.getTime())) return '时间异常'
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export const toLocalDateTime = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)