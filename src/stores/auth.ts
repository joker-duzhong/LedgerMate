import { defineStore } from 'pinia'
import type { AuthenticatedIdentity, AuthUser, Token } from '@/types/api'

const ACCESS_TOKEN_KEY = 'ledger_mate_access_token'
const REFRESH_TOKEN_KEY = 'ledger_mate_refresh_token'
export const LEDGER_APP_SCOPE = 'hope_ledger_mate'

const isValidToken = (token: Token) => Boolean(
  token && typeof token.access_token === 'string' && token.access_token.trim()
  && typeof token.refresh_token === 'string' && token.refresh_token.trim()
  && token.token_type === 'bearer',
)

export const useAuthStore = defineStore('auth', {
  // 每次冷启动都需重新验证微信身份，不能仅凭缓存 Token 进入业务页面。
  state: () => ({ accessToken: '', refreshToken: '', appScope: '', user: null as AuthUser | null, sessionVersion: 0 }),
  getters: {
    isLoggedIn: (state) => Boolean(state.accessToken && state.refreshToken && state.appScope === LEDGER_APP_SCOPE && state.user?.phone && !state.user.needs_phone_binding),
  },
  actions: {
    saveSession(session: AuthenticatedIdentity) {
      if (!session || session.status !== 'AUTHENTICATED' || !isValidToken(session)
        || session.app_scope !== LEDGER_APP_SCOPE || typeof session.user?.id !== 'string' || !session.user.id
        || typeof session.user.phone !== 'string' || !session.user.phone.trim() || session.user.needs_phone_binding !== false) {
        this.clear()
        throw new Error('登录信息无效或不属于账伴，请重新登录；若仍失败，请联系管理员')
      }
      this.sessionVersion += 1
      this.appScope = session.app_scope
      this.user = session.user
      this.accessToken = session.access_token
      this.refreshToken = session.refresh_token
      this.saveToken(session)
    },
    saveToken(token: Token) {
      if (!this.isLoggedIn || !isValidToken(token)) throw new Error('登录凭证无效，请重新登录')
      try {
        uni.setStorageSync(ACCESS_TOKEN_KEY, token.access_token)
        uni.setStorageSync(REFRESH_TOKEN_KEY, token.refresh_token)
      } catch {
        this.clear()
        throw new Error('无法保存登录状态，请检查设备存储空间后重试')
      }
      this.accessToken = token.access_token
      this.refreshToken = token.refresh_token
    },
    clear() {
      this.sessionVersion += 1
      this.accessToken = ''
      this.refreshToken = ''
      this.appScope = ''
      this.user = null
      uni.removeStorageSync(ACCESS_TOKEN_KEY)
      uni.removeStorageSync(REFRESH_TOKEN_KEY)
    },
  },
})
