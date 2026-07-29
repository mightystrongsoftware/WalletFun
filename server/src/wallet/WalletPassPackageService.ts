import { deflateSync } from "node:zlib";
import { PKPass } from "passkit-generator";
import { config } from "../config.js";
import { WalletPass } from "../content/ContentProvider.js";
import { AppleSigningMaterial, PassSigningConfigurationError, readAppleSigningMaterial } from "./AppleSigningMaterial.js";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class WalletPassPackageService {
  async createPackage(pass: WalletPass): Promise<Buffer> {
    const signingConfig = this.getSigningConfig();

    const walletPass = new PKPass(
      {
        "icon.png": createSolidPng(29, 29, 15, 118, 110),
        "icon@2x.png": createSolidPng(58, 58, 15, 118, 110),
        "logo.png": createSolidPng(160, 50, 15, 118, 110),
        "logo@2x.png": createSolidPng(320, 100, 15, 118, 110),
        "pass.json": Buffer.from(JSON.stringify(this.createPassJson(pass, signingConfig), null, 2))
      },
      {
        wwdr: signingConfig.wwdr,
        signerCert: signingConfig.signerCert,
        signerKey: signingConfig.signerKey,
        ...(signingConfig.signerKeyPassphrase ? { signerKeyPassphrase: signingConfig.signerKeyPassphrase } : {})
      }
    );

    walletPass.setBarcodes({
      message: pass.serialNumber,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1"
    });

    return walletPass.getAsBuffer();
  }

  private createPassJson(pass: WalletPass, signingConfig: AppleSigningMaterial) {
    const fullName = `${pass.firstName} ${pass.lastName}`.trim();

    return {
      formatVersion: 1,
      passTypeIdentifier: signingConfig.passTypeIdentifier,
      teamIdentifier: signingConfig.teamIdentifier,
      organizationName: "Mighty Strong LLC",
      description: "WalletFun pass",
      serialNumber: pass.serialNumber,
      webServiceURL: `${config.publicApiBaseUrl}/v1`,
      authenticationToken: pass.id,
      logoText: "WalletFun",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(15, 118, 110)",
      labelColor: "rgb(209, 250, 229)",
      generic: {
        primaryFields: [
          {
            key: "holder",
            label: "PASS HOLDER",
            value: fullName
          }
        ],
        secondaryFields: [
          {
            key: "status",
            label: "STATUS",
            value: pass.status.toUpperCase()
          }
        ],
        auxiliaryFields: [
          {
            key: "serial",
            label: "SERIAL",
            value: pass.serialNumber
          }
        ],
        backFields: [
          {
            key: "updateMessage",
            label: "Latest Update",
            value: pass.updateMessage ?? "No updates yet."
          }
        ]
      }
    };
  }

  private getSigningConfig(): AppleSigningMaterial {
    return readAppleSigningMaterial();
  }
}

function createSolidPng(width: number, height: number, red: number, green: number, blue: number): Buffer {
  const scanlineLength = 1 + width * 4;
  const raw = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * scanlineLength;
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelStart = rowStart + 1 + x * 4;
      raw[pixelStart] = red;
      raw[pixelStart + 1] = green;
      raw[pixelStart + 2] = blue;
      raw[pixelStart + 3] = 255;
    }
  }

  return Buffer.concat([
    pngSignature,
    createPngChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    createPngChunk("IDAT", deflateSync(raw)),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = uint32(data.length);
  const crc = uint32(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
