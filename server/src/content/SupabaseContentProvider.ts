import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ContentProvider,
  CreateWalletPassInput,
  DeviceRegistration,
  PassUpdate,
  UpdateWalletPassNameInput,
  UpdatedPassSerials,
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

  async getPassById(passId: string): Promise<WalletPass | null> {
    const { data, error } = await this.client
      .from("wallet_passes")
      .select()
      .eq("id", passId)
      .maybeSingle<PassRow>();

    if (error) throw error;
    return data ? mapPassRow(data) : null;
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

  async updatePassName(passId: string, input: UpdateWalletPassNameInput): Promise<WalletPass> {
    const updateMessage = `Name updated to ${input.firstName} ${input.lastName}`;
    const { data, error } = await this.client
      .from("wallet_passes")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        status: "updated",
        update_message: updateMessage,
        updated_at: new Date().toISOString()
      })
      .eq("id", passId)
      .select()
      .single<PassRow>();

    if (error) throw error;
    return mapPassRow(data);
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

  async listDeviceRegistrationsForPass(passTypeIdentifier: string, serialNumber: string): Promise<DeviceRegistration[]> {
    const { data, error } = await this.client
      .from("device_registrations")
      .select()
      .eq("pass_type_identifier", passTypeIdentifier)
      .eq("serial_number", serialNumber)
      .returns<DeviceRegistrationRow[]>();

    if (error) throw error;
    return data.map(mapDeviceRegistrationRow);
  }

  async listUpdatedPassSerials(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string,
    passesUpdatedSince?: string
  ): Promise<UpdatedPassSerials | null> {
    const { data: registrations, error: registrationsError } = await this.client
      .from("device_registrations")
      .select("serial_number")
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier)
      .returns<Array<{ serial_number: string }>>();

    if (registrationsError) throw registrationsError;

    const serialNumbers = registrations.map((registration) => registration.serial_number);
    if (serialNumbers.length === 0) {
      return null;
    }

    let query = this.client
      .from("wallet_passes")
      .select()
      .in("serial_number", serialNumbers)
      .order("updated_at", { ascending: true });

    if (passesUpdatedSince) {
      query = query.gt("updated_at", passesUpdatedSince);
    }

    const { data: passes, error: passesError } = await query.returns<PassRow[]>();

    if (passesError) throw passesError;
    if (passes.length === 0) {
      return null;
    }

    return {
      serialNumbers: passes.map((pass) => pass.serial_number),
      lastUpdated: passes[passes.length - 1].updated_at
    };
  }
}

type DeviceRegistrationRow = {
  device_library_identifier: string;
  pass_type_identifier: string;
  serial_number: string;
  push_token: string;
  created_at: string;
};

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

function mapDeviceRegistrationRow(row: DeviceRegistrationRow): DeviceRegistration {
  return {
    deviceLibraryIdentifier: row.device_library_identifier,
    passTypeIdentifier: row.pass_type_identifier,
    serialNumber: row.serial_number,
    pushToken: row.push_token,
    createdAt: row.created_at
  };
}
