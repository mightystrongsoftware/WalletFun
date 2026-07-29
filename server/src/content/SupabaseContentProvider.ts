import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ContentProvider,
  CreateWalletPassInput,
  DeviceRegistration,
  PassUpdate,
  WalletPass
} from "./ContentProvider.js";

type PassRow = {
  id: string;
  serial_number: string;
  first_name: string;
  last_name: string;
  status: WalletPass["status"];
  update_message: string | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseContentProvider implements ContentProvider {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  async createPass(input: CreateWalletPassInput): Promise<WalletPass> {
    const { data, error } = await this.client
      .from("wallet_passes")
      .insert({
        serial_number: input.serialNumber,
        first_name: input.firstName,
        last_name: input.lastName,
        status: "created"
      })
      .select()
      .single<PassRow>();

    if (error) throw error;
    return mapPassRow(data);
  }

  async listPasses(): Promise<WalletPass[]> {
    const { data, error } = await this.client
      .from("wallet_passes")
      .select()
      .order("created_at", { ascending: false })
      .returns<PassRow[]>();

    if (error) throw error;
    return data.map(mapPassRow);
  }

  async getPassBySerialNumber(serialNumber: string): Promise<WalletPass | null> {
    const { data, error } = await this.client
      .from("wallet_passes")
      .select()
      .eq("serial_number", serialNumber)
      .maybeSingle<PassRow>();

    if (error) throw error;
    return data ? mapPassRow(data) : null;
  }

  async createPassUpdate(passId: string, message: string): Promise<PassUpdate> {
    const { data, error } = await this.client
      .from("pass_updates")
      .insert({ pass_id: passId, message })
      .select()
      .single<{ id: string; pass_id: string; message: string; created_at: string }>();

    if (error) throw error;

    const { error: updateError } = await this.client
      .from("wallet_passes")
      .update({ status: "updated", update_message: message, updated_at: new Date().toISOString() })
      .eq("id", passId);

    if (updateError) throw updateError;

    return {
      id: data.id,
      passId: data.pass_id,
      message: data.message,
      createdAt: data.created_at
    };
  }

  async registerDevice(registration: DeviceRegistration): Promise<void> {
    const { error } = await this.client
      .from("device_registrations")
      .upsert({
        device_library_identifier: registration.deviceLibraryIdentifier,
        pass_type_identifier: registration.passTypeIdentifier,
        serial_number: registration.serialNumber,
        push_token: registration.pushToken,
        created_at: registration.createdAt
      });

    if (error) throw error;
  }

  async unregisterDevice(deviceLibraryIdentifier: string, passTypeIdentifier: string, serialNumber: string): Promise<void> {
    const { error } = await this.client
      .from("device_registrations")
      .delete()
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier)
      .eq("serial_number", serialNumber);

    if (error) throw error;
  }
}

function mapPassRow(row: PassRow): WalletPass {
  return {
    id: row.id,
    serialNumber: row.serial_number,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    updateMessage: row.update_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

