import { AdminContentProvider, WalletPass } from "./AdminContentProvider";

export class ApiAdminContentProvider implements AdminContentProvider {
  constructor(private readonly apiBaseUrl: string) {}

  async listPasses(): Promise<WalletPass[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/admin/passes`, {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Could not load passes");
    }

    const data = (await response.json()) as { passes: WalletPass[] };
    return data.passes;
  }

  async createPassUpdate(passId: string, message: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/admin/passes/${passId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error("Could not create pass update");
    }
  }
}

