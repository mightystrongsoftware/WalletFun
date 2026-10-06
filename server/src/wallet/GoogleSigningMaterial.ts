import { readFileSync } from "node:fs";
import { config } from "../config.js";

export class GoogleWalletConfigurationError extends Error {}

export interface GoogleSigningMaterial {
  issuerId: string;
  classId: string;
  clientEmail: string;
  privateKey: string;
  origins: string[];
}

interface ServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
}

/**
 * Loads the Google Wallet issuer settings and the service account used to sign
 * "Save to Google Wallet" JWTs and call the Wallet Objects REST API.
 *
 * Mirrors `readAppleSigningMaterial`: nothing is cached so a misconfigured
 * deployment fails per request with a clear message instead of at boot.
 */
export function readGoogleSigningMaterial(): GoogleSigningMaterial {
  if (!config.googleWalletIssuerId) {
    throw new GoogleWalletConfigurationError("GOOGLE_WALLET_ISSUER_ID is required.");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(config.googleWalletClassSuffix)) {
    throw new GoogleWalletConfigurationError("GOOGLE_WALLET_CLASS_SUFFIX may only contain letters, numbers, '_' and '-'.");
  }

  const credentials = readServiceAccount();
  if (!credentials.client_email || !credentials.private_key) {
    throw new GoogleWalletConfigurationError("The Google service account JSON must include client_email and private_key.");
  }

  return {
    issuerId: config.googleWalletIssuerId,
    classId: `${config.googleWalletIssuerId}.${config.googleWalletClassSuffix}`,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    origins: config.googleWalletOrigins
  };
}

function readServiceAccountFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    // A wrong path or an unmounted secret file is a deployment mistake, so
    // report it as configuration rather than an opaque 500.
    const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
    throw new GoogleWalletConfigurationError(`Could not read GOOGLE_SERVICE_ACCOUNT_PATH (${path}): ${code}.`);
  }
}

function readServiceAccount(): ServiceAccountCredentials {
  const raw = config.googleServiceAccountJson
    ? config.googleServiceAccountJson
    : config.googleServiceAccountPath
      ? readServiceAccountFile(config.googleServiceAccountPath)
      : undefined;

  if (!raw) {
    throw new GoogleWalletConfigurationError("GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH is required.");
  }

  try {
    return JSON.parse(raw) as ServiceAccountCredentials;
  } catch {
    throw new GoogleWalletConfigurationError("The Google service account credentials are not valid JSON.");
  }
}
