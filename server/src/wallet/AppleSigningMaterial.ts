import { readFileSync } from "node:fs";
import { config } from "../config.js";

export class PassSigningConfigurationError extends Error {}

export interface AppleSigningMaterial {
  passTypeIdentifier: string;
  teamIdentifier: string;
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
}

export function readAppleSigningMaterial(): AppleSigningMaterial {
  if (!config.applePassTypeIdentifier || !config.appleTeamIdentifier) {
    throw new PassSigningConfigurationError("APPLE_PASS_TYPE_IDENTIFIER and APPLE_TEAM_IDENTIFIER are required.");
  }

  return {
    passTypeIdentifier: config.applePassTypeIdentifier,
    teamIdentifier: config.appleTeamIdentifier,
    wwdr: readSecret("APPLE_WWDR_CERT", config.appleWwdrCertPem, config.appleWwdrCertPath),
    signerCert: readSecret("APPLE_PASS_CERT", config.applePassCertPem, config.applePassCertPath),
    signerKey: readSecret("APPLE_PASS_KEY", config.applePassKeyPem, config.applePassKeyPath),
    ...(config.applePassCertPassword ? { signerKeyPassphrase: config.applePassCertPassword } : {})
  };
}

function readSecret(name: string, pemValue: string | undefined, filePath: string | undefined): Buffer {
  if (pemValue) {
    return Buffer.from(extractPemBlock(pemValue.replace(/\\n/g, "\n"), name));
  }

  if (filePath) {
    return Buffer.from(extractPemBlock(readFileSync(filePath, "utf8"), name));
  }

  throw new PassSigningConfigurationError(`${name}_PEM or ${name}_PATH is required.`);
}

function extractPemBlock(value: string, name: string): string {
  if (name.includes("KEY")) {
    const keyMatch = value.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/);
    if (keyMatch) {
      return keyMatch[0];
    }
  }

  if (name.includes("CERT")) {
    const certificateMatch = value.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
    if (certificateMatch) {
      return certificateMatch[0];
    }
  }

  return value;
}
