import { useAuthStore } from "@/stores/auth";
import { openLogin as navigateToLogin } from "@/utils/authNavigation";
import type { ApiEnvelope, Token } from "@/types/api";

const baseUrl = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.VITE_LOCAL_ENV === "true" ? "http://192.168.31.93:8000/api/v1" : "https://api.lxyy.fun/api/v1");
let refreshTask: { version: number; promise: Promise<boolean> } | null = null;

interface SessionSnapshot {
  version: number;
  accessToken: string;
  refreshToken: string;
}
interface RequestPolicy {
  auth?: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const retryAfterSeconds = (headers: Record<string, unknown> | undefined): number | undefined => {
  const key = Object.keys(headers || {}).find((name) => name.toLowerCase() === "retry-after");
  const value = key ? headers?.[key] : undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? seconds : undefined;
  }
  if (!/[a-z]/i.test(text)) return undefined;
  const deadline = Date.parse(text);
  return Number.isNaN(deadline) ? undefined : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};

const requestRaw = <T>(options: UniApp.RequestOptions) =>
  new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      url: `${baseUrl}${options.url}`,
      success: ({ statusCode, data, header }) => {
        const response = data && typeof data === "object" ? (data as Partial<ApiEnvelope<T>>) : undefined;
        const message = typeof response?.message === "string" ? response.message : `服务请求失败（${statusCode}）`;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new ApiError(statusCode, message, retryAfterSeconds(header)));
          return;
        }
        if (!response || typeof response.code !== "number" || response.code < 200 || response.code >= 300 || !("data" in response)) {
          reject(new ApiError(statusCode, "服务响应格式错误，请稍后重试"));
          return;
        }
        resolve(response.data as T);
      },
      fail: () => reject(new ApiError(0, "网络不可用，请检查网络后重试")),
    });
  });

const requestHeaders = (options: UniApp.RequestOptions, accessToken?: string) => {
  const header = { ...(options.header || {}) };
  for (const key of Object.keys(header)) {
    if (key.toLowerCase() === "authorization") delete header[key];
  }
  if (accessToken) header.Authorization = `Bearer ${accessToken}`;
  return header;
};

const snapshotSession = (): SessionSnapshot => {
  const auth = useAuthStore();
  return { version: auth.sessionVersion, accessToken: auth.accessToken, refreshToken: auth.refreshToken };
};

const matchesSession = (session: SessionSnapshot) => {
  const auth = useAuthStore();
  return auth.sessionVersion === session.version && auth.accessToken === session.accessToken && auth.refreshToken === session.refreshToken;
};

const expireSession = (session: SessionSnapshot) => {
  if (!matchesSession(session)) return;
  useAuthStore().clear();
  navigateToLogin();
};

const isToken = (value: unknown): value is Token => {
  if (!value || typeof value !== "object") return false;
  const token = value as Partial<Token>;
  return typeof token.access_token === "string" && Boolean(token.access_token.trim()) && typeof token.refresh_token === "string" && Boolean(token.refresh_token.trim()) && typeof token.token_type === "string" && token.token_type.toLowerCase() === "bearer";
};

const refreshToken = (session: SessionSnapshot): Promise<boolean> => {
  if (refreshTask?.version === session.version) return refreshTask.promise;
  // Defer execution so even a missing refresh token releases an already assigned lock.
  const task = Promise.resolve()
    .then(async () => {
      const auth = useAuthStore();
      if (!matchesSession(session)) return false;
      if (!session.refreshToken) {
        expireSession(session);
        return false;
      }
      try {
        const token = await requestRaw<unknown>({ url: "/auth/refresh", method: "POST", data: { refresh_token: session.refreshToken } });
        if (!matchesSession(session)) return auth.sessionVersion === session.version && auth.isLoggedIn;
        if (!isToken(token)) throw new ApiError(200, "刷新登录状态失败，请重新登录");
        try {
          auth.saveToken(token);
        } catch (error) {
          if (!auth.isLoggedIn) navigateToLogin();
          throw error;
        }
        return true;
      } catch {
        // Refresh tokens rotate once; a lost response also requires a new login.
        expireSession(session);
        return false;
      }
    })
    .finally(() => {
      if (refreshTask?.promise === task) refreshTask = null;
    });
  refreshTask = { version: session.version, promise: task };
  return task;
};

export const request = async <T>(options: UniApp.RequestOptions, policy: RequestPolicy = {}): Promise<T> => {
  if (policy.auth === false) return requestRaw<T>({ ...options, header: requestHeaders(options) });
  const auth = useAuthStore();
  if (!auth.isLoggedIn) {
    if (auth.accessToken || auth.refreshToken || auth.appScope || auth.user) auth.clear();
    navigateToLogin();
    throw new ApiError(401, "请先登录");
  }
  const session = snapshotSession();
  const send = async (accessToken: string): Promise<T> => {
    const data = await requestRaw<T>({ ...options, header: requestHeaders(options, accessToken) });
    if (auth.sessionVersion !== session.version) throw new ApiError(401, "登录状态已变化，请重试");
    return data;
  };
  try {
    return await send(session.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401 || auth.sessionVersion !== session.version) throw error;
    // A late 401 may belong to the token another request has already refreshed.
    if (matchesSession(session) && !(await refreshToken(session))) throw error;
    if (auth.sessionVersion !== session.version || !auth.isLoggedIn) throw error;
    const retrySession = snapshotSession();
    try {
      return await send(retrySession.accessToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.statusCode === 401) expireSession(retrySession);
      throw retryError;
    }
  }
};
