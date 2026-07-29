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

export interface PassUpdate {
  id: string;
  passId: string;
  message: string;
  createdAt: string;
}

export interface DeviceRegistration {
  deviceLibraryIdentifier: string;
  passTypeIdentifier: string;
  serialNumber: string;
  pushToken: string;
  createdAt: string;
}

export interface CreateWalletPassInput {
  firstName: string;
  lastName: string;
  serialNumber: string;
}

export interface UpdateWalletPassNameInput {
  firstName: string;
  lastName: string;
}

export interface ContentProvider {
  createPass(input: CreateWalletPassInput): Promise<WalletPass>;
  listPasses(): Promise<WalletPass[]>;
  getPassBySerialNumber(serialNumber: string): Promise<WalletPass | null>;
  updatePassName(passId: string, input: UpdateWalletPassNameInput): Promise<WalletPass>;
  createPassUpdate(passId: string, message: string): Promise<PassUpdate>;
  registerDevice(registration: DeviceRegistration): Promise<void>;
  unregisterDevice(deviceLibraryIdentifier: string, passTypeIdentifier: string, serialNumber: string): Promise<void>;
}
