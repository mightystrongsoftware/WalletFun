import { nanoid } from "nanoid";
import { config } from "../config.js";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";

export interface CreatePassRequest {
  firstName: string;
  lastName: string;
}

export interface CreatePassResponse {
  id: string;
  serialNumber: string;
  downloadUrl: string;
}

export class PassService {
  constructor(private readonly contentProvider: ContentProvider) {}

  async createPass(input: CreatePassRequest): Promise<CreatePassResponse> {
    const pass = await this.contentProvider.createPass({
      firstName: input.firstName,
      lastName: input.lastName,
      serialNumber: `wf-${nanoid(12)}`
    });

    return this.toCreatePassResponse(pass);
  }

  getDownloadUrl(serialNumber: string): string {
    return `${config.publicApiBaseUrl}/api/passes/${serialNumber}/download`;
  }

  private toCreatePassResponse(pass: WalletPass): CreatePassResponse {
    return {
      id: pass.id,
      serialNumber: pass.serialNumber,
      downloadUrl: this.getDownloadUrl(pass.serialNumber)
    };
  }
}

