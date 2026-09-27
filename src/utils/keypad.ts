export type KeypadKey = string

/** Apply one safe numeric key to the amount text; operators are handled by the page as type switches. */
export const applyAmountKey = (amount: string, key: KeypadKey) => {
  if (key === 'backspace') return amount.slice(0, -1)
  if (key === '.') {
    if (amount.includes('.')) return amount
    return amount ? `${amount}.` : '0.'
  }
  if (!/^\d$/.test(key)) return amount
  if (amount === '0') return key
  if (amount.length >= 10) return amount
  const next = amount + key
  const [integer, decimal] = next.split('.')
  return decimal && decimal.length > 2 ? `${integer}.${decimal.slice(0, 2)}` : next
}
