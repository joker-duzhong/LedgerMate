import { computed, ref, watch } from "vue";
import { completeSmsLogin, miniappLogin, sendSmsCode } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import type { AuthenticatedIdentity, PendingIdentity } from "@/types/api";
import { returnFromLogin } from "@/utils/authNavigation";
import { ApiError } from "@/utils/request";
import { getWechatCode, PRIVACY_AGREED_KEY } from "@/utils/wechatIdentity";

const normalizePhone = (phone: string) =>
  phone
    .trim()
    .replace(/^(?:\+86|0086)/, "")
    .trim();

export const useLogin = (canUseWechat: boolean) => {
  const auth = useAuthStore();
  const agreed = ref(uni.getStorageSync(PRIVACY_AGREED_KEY) === true);
  const initializing = ref(false);
  const loading = ref(false);
  const verifyingPhone = ref(false);
  const phone = ref("");
  const smsCode = ref("");
  const sendingCode = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const pending = ref<PendingIdentity | null>(null);
  const now = ref(Date.now());
  const retryAt = ref(0);
  const sendRetryAt = ref(0);
  const retrySeconds = computed(() => Math.max(0, Math.ceil((retryAt.value - now.value) / 1000)));
  const sendRetrySeconds = computed(() => Math.max(0, Math.ceil((sendRetryAt.value - now.value) / 1000)));
  const phoneRequired = computed(() => Boolean(pending.value));
  let disposed = false;
  let operation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let navigating = false;
  let navigationTimer: ReturnType<typeof setTimeout> | undefined;

  const stopNavigationTimer = () => {
    if (navigationTimer !== undefined) clearTimeout(navigationTimer);
    navigationTimer = undefined;
  };

  const returnToPreview = () => {
    if (disposed || navigating) return;
    navigating = true;
    initializing.value = auth.isLoggedIn;
    errorMessage.value = "";
    let settled = false;
    const failed = () => {
      if (disposed || settled) return;
      settled = true;
      navigating = false;
      stopNavigationTimer();
      initializing.value = false;
      errorMessage.value = auth.isLoggedIn ? "登录已完成，但暂时未能打开账本，请重试" : "暂时未能返回预览页面，请点击返回重试";
    };
    navigationTimer = setTimeout(failed, 12_000);
    try {
      returnFromLogin({
        success: () => {
          if (disposed || settled) return;
          settled = true;
          navigating = false;
          stopNavigationTimer();
        },
        fail: failed,
      });
    } catch {
      failed();
    }
  };

  const stopPhoneWatch = watch(
    phone,
    (value, previous) => {
      if (normalizePhone(value) === normalizePhone(previous)) return;
      smsCode.value = "";
      successMessage.value = "";
    },
    { flush: "sync" },
  );

  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const updateTime = () => {
    now.value = Date.now();
    if (pending.value && Date.parse(pending.value.expires_at) <= now.value) {
      pending.value = null;
      smsCode.value = "";
      successMessage.value = "";
      errorMessage.value = "手机号验证已过期，请重新微信登录";
    }
    if (!pending.value && !retrySeconds.value && !sendRetrySeconds.value) stopTimer();
  };

  const startTimer = () => {
    updateTime();
    if (timer === undefined && (pending.value || retrySeconds.value || sendRetrySeconds.value)) timer = setInterval(updateTime, 1000);
  };

  const reportError = (error: unknown, restartPhone = false) => {
    initializing.value = false;
    if (error instanceof ApiError && error.statusCode === 429) {
      retryAt.value = Date.now() + Math.max(1, error.retryAfterSeconds ?? 60) * 1000;
      startTimer();
    }
    const message = error instanceof Error ? error.message : "登录失败，请稍后重试";
    errorMessage.value = restartPhone ? `${message}。请重新微信登录后再验证手机号` : message;
  };

  const finishLogin = (session: AuthenticatedIdentity) => {
    pending.value = null;
    smsCode.value = "";
    try {
      auth.saveSession(session);
      uni.setStorageSync(PRIVACY_AGREED_KEY, true);
      phone.value = "";
      stopTimer();
      returnToPreview();
    } catch (error) {
      auth.clear();
      reportError(error);
    }
  };

  const login = async () => {
    updateTime();
    if (disposed || !agreed.value || loading.value || sendingCode.value || navigating || retrySeconds.value) return;
    if (auth.isLoggedIn) {
      returnToPreview();
      return;
    }
    if (!canUseWechat) {
      initializing.value = false;
      errorMessage.value = "请在微信小程序中打开账伴完成登录";
      return;
    }
    const appid = import.meta.env.VITE_WECHAT_APP_ID;
    if (!appid) {
      initializing.value = false;
      errorMessage.value = "微信登录暂不可用，请联系管理员";
      return;
    }
    loading.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    smsCode.value = "";
    pending.value = null;
    auth.clear();
    const current = ++operation;
    const sessionVersion = auth.sessionVersion;
    const isCurrent = () => !disposed && current === operation && sessionVersion === auth.sessionVersion;
    try {
      const code = await getWechatCode();
      if (!isCurrent() || !agreed.value) return;
      const result = await miniappLogin(code, appid);
      if (!isCurrent() || !agreed.value) return;
      if (result?.status === "AUTHENTICATED") {
        finishLogin(result);
      } else if (result?.status === "PHONE_REQUIRED" && result.login_ticket && Date.parse(result.expires_at) > Date.now()) {
        pending.value = result;
        startTimer();
      } else {
        throw new Error("登录信息已失效，请重新微信登录");
      }
    } catch (error) {
      if (isCurrent()) reportError(error);
    } finally {
      if (!disposed && current === operation) {
        loading.value = false;
        if (!navigating && !auth.isLoggedIn) initializing.value = false;
      }
    }
  };

  const validatePhone = () => {
    const normalized = normalizePhone(phone.value);
    if (!/^1[3-9][0-9]{9}$/.test(normalized)) {
      errorMessage.value = "请输入有效的中国大陆手机号";
      return null;
    }
    phone.value = normalized;
    return normalized;
  };

  const sendCode = async () => {
    updateTime();
    if (disposed || !agreed.value || loading.value || sendingCode.value || retrySeconds.value || sendRetrySeconds.value || !pending.value) return;
    errorMessage.value = "";
    successMessage.value = "";
    const normalized = validatePhone();
    if (!normalized) return;
    const ticket = pending.value.login_ticket;
    sendingCode.value = true;
    smsCode.value = "";
    // 后端会先预留发送额度；供应商失败或响应丢失时也应等待后再重发。
    sendRetryAt.value = Date.now() + 60_000;
    startTimer();
    const current = ++operation;
    const sessionVersion = auth.sessionVersion;
    const isCurrent = () => !disposed && current === operation && sessionVersion === auth.sessionVersion && pending.value?.login_ticket === ticket;
    try {
      await sendSmsCode(normalized);
      updateTime();
      if (isCurrent()) successMessage.value = "验证码已发送，5 分钟内有效";
    } catch (error) {
      updateTime();
      if (isCurrent()) {
        if (error instanceof ApiError && error.statusCode === 502) {
          errorMessage.value = "短信暂未发送成功，可能发送过于频繁或服务暂不可用，请稍后重试";
        } else if (error instanceof ApiError && error.statusCode === 0) {
          errorMessage.value = "未确认短信是否发送，请先查看短信；未收到可在倒计时结束后重试";
        } else {
          reportError(error);
        }
      }
    } finally {
      if (!disposed && current === operation) sendingCode.value = false;
    }
  };

  const completePhoneLogin = async () => {
    updateTime();
    if (disposed || !agreed.value || loading.value || sendingCode.value || retrySeconds.value || !pending.value) return;
    errorMessage.value = "";
    const normalized = validatePhone();
    if (!normalized) return;
    const code = smsCode.value.trim();
    if (!/^[0-9]{4}$/.test(code)) {
      errorMessage.value = "请输入短信中的 4 位验证码";
      return;
    }
    const ticket = pending.value.login_ticket;
    loading.value = true;
    verifyingPhone.value = true;
    successMessage.value = "";
    const current = ++operation;
    const sessionVersion = auth.sessionVersion;
    const isCurrent = () => !disposed && current === operation && sessionVersion === auth.sessionVersion;
    try {
      const session = await completeSmsLogin({ login_ticket: ticket, phone: normalized, code, accepted_terms: true });
      if (isCurrent() && agreed.value) finishLogin(session);
    } catch (error) {
      if (isCurrent()) {
        updateTime();
        // 400/422/429 均发生于票据消费前；其他失败可能已经完成账号关联。
        const canRetry = error instanceof ApiError && [400, 422, 429].includes(error.statusCode) && pending.value?.login_ticket === ticket;
        if (!canRetry) {
          pending.value = null;
          smsCode.value = "";
        }
        reportError(error, !canRetry);
      }
    } finally {
      if (!disposed && current === operation) {
        loading.value = false;
        verifyingPhone.value = false;
      }
    }
  };

  const onShow = () => {
    if (disposed) return;
    updateTime();
    if (navigating) return;
    if (auth.isLoggedIn) {
      returnToPreview();
      return;
    }
  };

  const cancelVerification = () => {
    operation += 1;
    pending.value = null;
    smsCode.value = "";
    phone.value = "";
    loading.value = false;
    verifyingPhone.value = false;
    sendingCode.value = false;
    successMessage.value = "";
    stopTimer();
  };

  const cancelLogin = () => {
    if (disposed) return;
    cancelVerification();
    returnToPreview();
  };

  const dispose = () => {
    disposed = true;
    cancelVerification();
    stopPhoneWatch();
    stopNavigationTimer();
  };

  return { agreed, initializing, loading, verifyingPhone, phone, smsCode, sendingCode, errorMessage, successMessage, phoneRequired, retrySeconds, sendRetrySeconds, login, sendCode, completePhoneLogin, cancelLogin, onShow, dispose };
};
