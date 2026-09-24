import { nanoid } from "nanoid";
import { config } from "../config.js";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
import { createAppleAuthenticationToken } from "./AppleAuthenticationToken.js";

export interface CreatePassRequest {
  firstName: string;
  lastName: string;
  serialNumber?: string;
}

export interface CreatePassResponse {
  id: string;
  serialNumber: string;
  /** Signed `.pkpass` for Apple Wallet (iOS app). */
  downloadUrl: string;
  /** JSON endpoint returning the Save to Google Wallet JWT (Android app). */
  googleWalletUrl: string;
  /** Shareable link that redirects to the Google Wallet save flow. */
  googleWalletSaveUrl: string;
  updated?: boolean;
}

export class PassService {
  constructor(private readonly contentProvider: ContentProvider) {}

  async createPass(input: CreatePassRequest): Promise<CreatePassResponse> {
    const pass = await this.contentProvider.createPass({
      firstName: input.firstName,
      lastName: input.lastName,
      serialNumber: input.serialNumber ?? `wf-${nanoid(12)}`,
      appleAuthenticationToken: createAppleAuthenticationToken()
    });

    return this.toCreatePassResponse(pass);
  }

  getDownloadUrl(serialNumber: string): string {
    return `${config.publicApiBaseUrl}/api/passes/${serialNumber}/download`;
  }

  getGoogleWalletUrl(serialNumber: string): string {
    return `${config.publicApiBaseUrl}/api/passes/${serialNumber}/google-wallet`;
  }

  getGoogleWalletSaveUrl(serialNumber: string): string {
    return `${this.getGoogleWalletUrl(serialNumber)}/save`;
  }

  toCreatePassResponse(pass: WalletPass, updated?: boolean): CreatePassResponse {
    return {
      id: pass.id,
      serialNumber: pass.serialNumber,
      downloadUrl: this.getDownloadUrl(pass.serialNumber),
      googleWalletUrl: this.getGoogleWalletUrl(pass.serialNumber),
      googleWalletSaveUrl: this.getGoogleWalletSaveUrl(pass.serialNumber),
      ...(updated === undefined ? {} : { updated })
    };
  }
}
