export type WalletPassStatus = "created" | "updated" | "voided";

export interface WalletPass {
  id: string;
  serialNumber: string;
  firstName: string;
  lastName: string;
  status: WalletPassStatus;
  updateMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminContentProvider {
  listPasses(): Promise<WalletPass[]>;
  updatePassName(passId: string, firstName: string, lastName: string): Promise<void>;
  createPassUpdate(passId: string, message: string): Promise<void>;
}
