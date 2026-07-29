import { nanoid } from "nanoid";
import {
  ContentProvider,
  CreateWalletPassInput,
  DeviceRegistration,
  PassUpdate,
  UpdateWalletPassNameInput,
  WalletPass
} from "./ContentProvider.js";

export class InMemoryContentProvider implements ContentProvider {
  private passes = new Map<string, WalletPass>();
  private registrations = new Map<string, DeviceRegistration>();

  async createPass(input: CreateWalletPassInput): Promise<WalletPass> {
    const now = new Date().toISOString();
    const pass: WalletPass = {
      id: nanoid(),
      serialNumber: input.serialNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "created",
      createdAt: now,
      updatedAt: now
    };

    this.passes.set(pass.id, pass);
    return pass;
  }

  async listPasses(): Promise<WalletPass[]> {
    return [...this.passes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPassBySerialNumber(serialNumber: string): Promise<WalletPass | null> {
    return [...this.passes.values()].find((pass) => pass.serialNumber === serialNumber) ?? null;
  }

  async updatePassName(passId: string, input: UpdateWalletPassNameInput): Promise<WalletPass> {
    const pass = this.passes.get(passId);
    if (!pass) {
      throw new Error("Pass not found");
    }

    const updatedPass: WalletPass = {
      ...pass,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "updated",
      updateMessage: `Name updated to ${input.firstName} ${input.lastName}`,
      updatedAt: new Date().toISOString()
    };

    this.passes.set(passId, updatedPass);
    return updatedPass;
  }

  async createPassUpdate(passId: string, message: string): Promise<PassUpdate> {
    const pass = this.passes.get(passId);
    if (!pass) {
      throw new Error("Pass not found");
    }

    const now = new Date().toISOString();
    const updatedPass: WalletPass = {
      ...pass,
      status: "updated",
      updateMessage: message,
      updatedAt: now
    };
    this.passes.set(passId, updatedPass);

    return {
      id: nanoid(),
      passId,
      message,
      createdAt: now
    };
  }

  async registerDevice(registration: DeviceRegistration): Promise<void> {
    this.registrations.set(this.registrationKey(registration), registration);
  }

  async unregisterDevice(deviceLibraryIdentifier: string, passTypeIdentifier: string, serialNumber: string): Promise<void> {
    this.registrations.delete([deviceLibraryIdentifier, passTypeIdentifier, serialNumber].join(":"));
  }

  private registrationKey(registration: DeviceRegistration): string {
    return [
      registration.deviceLibraryIdentifier,
      registration.passTypeIdentifier,
      registration.serialNumber
    ].join(":");
  }
}
