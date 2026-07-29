import { ApiAdminContentProvider } from "./ApiAdminContentProvider";
import { AdminContentProvider } from "./AdminContentProvider";

export function createAdminContentProvider(): AdminContentProvider {
  const defaultApiBaseUrl = import.meta.env.PROD ? "https://walletfun.onrender.com" : "http://127.0.0.1:3000";

  return new ApiAdminContentProvider(import.meta.env.VITE_WALLETFUN_API_BASE_URL ?? defaultApiBaseUrl);
}
