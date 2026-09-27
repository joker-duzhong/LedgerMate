import { request } from "@/utils/request";
import type { AuthenticatedIdentity, CompleteSmsIdentityRequest, IdentityResponse } from "@/types/api";

export const miniappLogin = (code: string, appid: string) =>
  request<IdentityResponse>(
    {
      url: "/auth/identity/miniapp",
      method: "POST",
      data: { code, appid },
    },
    { auth: false },
  );

export const sendSmsCode = (phone: string) =>
  request<null>(
    {
      url: "/auth/sms/send",
      method: "POST",
      data: { phone, test: import.meta.env.VITE_LOCAL_ENV === "true" ? "hope" : "" },
    },
    { auth: false },
  );

export const completeSmsLogin = (data: CompleteSmsIdentityRequest) =>
  request<AuthenticatedIdentity>(
    {
      url: "/auth/identity/complete/sms",
      method: "POST",
      data,
    },
    { auth: false },
  );
