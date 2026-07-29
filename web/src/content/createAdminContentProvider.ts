import { ApiAdminContentProvider } from "./ApiAdminContentProvider";
import { AdminContentProvider } from "./AdminContentProvider";

export function createAdminContentProvider(): AdminContentProvider {
  return new ApiAdminContentProvider(import.meta.env.VITE_WALLETFUN_API_BASE_URL ?? "http://127.0.0.1:3000");
}
