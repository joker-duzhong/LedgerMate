export const PRIVACY_AGREED_KEY = 'ledger_mate_privacy_agreed'

export const getWechatCode = () => new Promise<string>((resolve, reject) => {
  uni.login({
    provider: 'weixin',
    success: ({ code }) => code ? resolve(code) : reject(new Error('微信未返回登录凭证，请重试')),
    fail: () => reject(new Error('无法获取微信登录凭证，请稍后重试')),
  })
})
