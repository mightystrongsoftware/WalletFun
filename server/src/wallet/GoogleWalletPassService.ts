import { createSign } from "node:crypto";
import { JWT } from "google-auth-library";
import { config } from "../config.js";
import { WalletPass } from "../content/ContentProvider.js";
import { logError, logInfo, logWarn } from "../logger.js";
import { GoogleSigningMaterial, GoogleWalletConfigurationError, readGoogleSigningMaterial } from "./GoogleSigningMaterial.js";

const WALLET_OBJECTS_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const WALLET_OBJECTS_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const SAVE_URL_PREFIX = "https://pay.google.com/gp/v/save/";

/**
 * Google rejected or failed a Wallet Objects / OAuth request, for example
 * because the service account was not added to the issuer account.
 */
export class GoogleWalletApiError extends Error {}

export interface GoogleWalletSavePayload {
  objectId: string;
  saveJwt: string;
  saveUrl: string;
}

export interface GoogleWalletUpdateResult {
  attempted: boolean;
  sent: number;
  failed: number;
  skippedReason?: string;
}

interface LocalizedString {
  defaultValue: { language: string; value: string };
}

interface GenericObject {
  id: string;
  classId: string;
  state: "ACTIVE" | "INACTIVE" | "EXPIRED";
  cardTitle: LocalizedString;
  header: LocalizedString;
  subheader: LocalizedString;
  hexBackgroundColor: string;
  barcode: { type: "QR_CODE"; value: string; alternateText: string };
  textModulesData: Array<{ id: string; header: string; body: string }>;
}

/**
 * Google Wallet counterpart of `WalletPassPackageService` + `PassPushNotificationService`.
 *
 * Apple Wallet installs a signed `.pkpass` and later pulls updates from our web
 * service after an APNs wake-up. Google Wallet works the other way round: the
 * pass lives as a Generic Object in Google's Wallet Objects API, the user adds
 * it through a signed "Save to Google Wallet" JWT, and updates are pushed by
 * patching the object. Google then refreshes every wallet holding it.
 */
export class GoogleWalletPassService {
  /** Deterministic Wallet object id, e.g. `3388000000012345678.wf-abc123`. */
  getObjectId(serialNumber: string, material: GoogleSigningMaterial = readGoogleSigningMaterial()): string {
    return `${material.issuerId}.${serialNumber}`;
  }

  getSaveUrl(saveJwt: string): string {
    return `${SAVE_URL_PREFIX}${saveJwt}`;
  }

  /**
   * Makes sure the pass class and object exist server side, then signs the
   * JWT the Android app hands to `PayClient.savePassesJwt` (or that a browser
   * can open through the pay.google.com save link).
   */
  async createSavePayload(pass: WalletPass): Promise<GoogleWalletSavePayload> {
    const material = readGoogleSigningMaterial();
    const client = this.createApiClient(material);
    const objectId = this.getObjectId(pass.serialNumber, material);

    try {
      await this.ensureClass(client, material);
      await this.upsertObject(client, material, pass);
    } catch (error) {
      logError("google_wallet.save_payload.error", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        objectId,
        error: describeError(error)
      });
      throw new GoogleWalletApiError(summarizeError(error));
    }

    const saveJwt = signSaveJwt(material, objectId);
    logInfo("google_wallet.save_payload.created", {
      passId: pass.id,
      serialNumber: pass.serialNumber,
      objectId
    });

    return { objectId, saveJwt, saveUrl: this.getSaveUrl(saveJwt) };
  }

  /**
   * Pushes the latest pass state to Google Wallet. Equivalent to the APNs
   * pass update push: a no-op when the pass was never saved to Google Wallet.
   */
  async notifyPassUpdated(pass: WalletPass): Promise<GoogleWalletUpdateResult> {
    logInfo("google_wallet.pass_update.start", {
      passId: pass.id,
      serialNumber: pass.serialNumber,
      updatesEnabled: config.googleWalletUpdatesEnabled
    });

    if (!config.googleWalletUpdatesEnabled) {
      return { attempted: false, sent: 0, failed: 0, skippedReason: "Google Wallet updates are disabled." };
    }

    let material: GoogleSigningMaterial;
    try {
      material = readGoogleSigningMaterial();
    } catch (error) {
      if (error instanceof GoogleWalletConfigurationError) {
        logWarn("google_wallet.pass_update.skipped", {
          passId: pass.id,
          serialNumber: pass.serialNumber,
          reason: "configuration",
          message: error.message
        });
        return { attempted: false, sent: 0, failed: 0, skippedReason: error.message };
      }
      throw error;
    }

    const client = this.createApiClient(material);
    const objectId = this.getObjectId(pass.serialNumber, material);

    try {
      const existing = await this.getObject(client, objectId);
      if (!existing) {
        logInfo("google_wallet.pass_update.skipped", {
          passId: pass.id,
          serialNumber: pass.serialNumber,
          objectId,
          reason: "not_saved_to_google_wallet"
        });
        return { attempted: false, sent: 0, failed: 0, skippedReason: "Pass has not been saved to Google Wallet." };
      }

      await client.request({
        url: `${WALLET_OBJECTS_API}/genericObject/${encodeURIComponent(objectId)}`,
        method: "PATCH",
        data: this.createObject(material, pass)
      });

      // `addMessage` with TEXT_AND_NOTIFY is the closest analogue to Apple's
      // per-field `changeMessage`: Google shows it under the pass and sends a
      // notification. Google caps notifications at three per object per day,
      // so a failure here is logged but does not fail the update.
      await this.addUpdateMessage(client, objectId, pass);

      logInfo("google_wallet.pass_update.complete", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        objectId
      });
      return { attempted: true, sent: 1, failed: 0 };
    } catch (error) {
      logError("google_wallet.pass_update.error", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        objectId,
        error: describeError(error)
      });
      return { attempted: true, sent: 0, failed: 1, skippedReason: "Google Wallet API request failed." };
    }
  }

  private createApiClient(material: GoogleSigningMaterial): JWT {
    return new JWT({
      email: material.clientEmail,
      key: material.privateKey,
      scopes: [WALLET_OBJECTS_SCOPE]
    });
  }

  private async ensureClass(client: JWT, material: GoogleSigningMaterial): Promise<void> {
    const found = await this.fetchOrNull(client, `${WALLET_OBJECTS_API}/genericClass/${encodeURIComponent(material.classId)}`);
    if (found) {
      return;
    }

    await client.request({
      url: `${WALLET_OBJECTS_API}/genericClass`,
      method: "POST",
      data: { id: material.classId }
    });
    logInfo("google_wallet.class.created", { classId: material.classId });
  }

  private async upsertObject(client: JWT, material: GoogleSigningMaterial, pass: WalletPass): Promise<void> {
    const object = this.createObject(material, pass);
    const existing = await this.getObject(client, object.id);

    await client.request({
      url: existing
        ? `${WALLET_OBJECTS_API}/genericObject/${encodeURIComponent(object.id)}`
        : `${WALLET_OBJECTS_API}/genericObject`,
      method: existing ? "PUT" : "POST",
      data: object
    });
  }

  private getObject(client: JWT, objectId: string): Promise<GenericObject | null> {
    return this.fetchOrNull<GenericObject>(client, `${WALLET_OBJECTS_API}/genericObject/${encodeURIComponent(objectId)}`);
  }

  private async addUpdateMessage(client: JWT, objectId: string, pass: WalletPass): Promise<void> {
    try {
      await client.request({
        url: `${WALLET_OBJECTS_API}/genericObject/${encodeURIComponent(objectId)}/addMessage`,
        method: "POST",
        data: {
          message: {
            header: "WalletFun update",
            body: pass.updateMessage ?? `Pass holder updated to ${pass.firstName} ${pass.lastName}.`,
            messageType: "TEXT_AND_NOTIFY"
          }
        }
      });
    } catch (error) {
      logWarn("google_wallet.pass_update.message_failed", { objectId, error: describeError(error) });
    }
  }

  private async fetchOrNull<T>(client: JWT, url: string): Promise<T | null> {
    try {
      const response = await client.request<T>({ url, method: "GET" });
      return response.data;
    } catch (error) {
      if (isHttpError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private createObject(material: GoogleSigningMaterial, pass: WalletPass): GenericObject {
    const fullName = `${pass.firstName} ${pass.lastName}`.trim();

    return {
      id: this.getObjectId(pass.serialNumber, material),
      classId: material.classId,
      state: pass.status === "voided" ? "INACTIVE" : "ACTIVE",
      cardTitle: localized("WalletFun"),
      header: localized(fullName),
      subheader: localized("PASS HOLDER"),
      hexBackgroundColor: "#0f766e",
      barcode: { type: "QR_CODE", value: pass.serialNumber, alternateText: pass.serialNumber },
      textModulesData: [
        { id: "status", header: "STATUS", body: pass.status.toUpperCase() },
        { id: "serial", header: "SERIAL", body: pass.serialNumber },
        { id: "updateMessage", header: "Latest Update", body: pass.updateMessage ?? "No updates yet." }
      ]
    };
  }
}

function localized(value: string): LocalizedString {
  return { defaultValue: { language: "en-US", value } };
}

/** Signs a "skinny" Save to Google Wallet JWT that references an existing object. */
function signSaveJwt(material: GoogleSigningMaterial, objectId: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: material.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: material.origins,
    payload: { genericObjects: [{ id: objectId }] }
  };

  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(material.privateKey);

  return `${signingInput}.${signature.toString("base64url")}`;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

interface HttpError {
  message: string;
  response?: { status?: number; data?: unknown };
}

/** Errors thrown by google-auth-library requests carry the HTTP response. */
function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && typeof (error as HttpError).response === "object";
}

/** Short, client-safe reason: HTTP status plus Google's own error message. */
function summarizeError(error: unknown): string {
  if (isHttpError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string } | string; error_description?: string }
      | undefined;
    const reason =
      (typeof data?.error === "object" ? data.error?.message : undefined) ??
      data?.error_description ??
      (typeof data?.error === "string" ? data.error : undefined) ??
      error.message;
    return `${error.response?.status ?? "No response"}: ${reason}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function describeError(error: unknown): string {
  if (isHttpError(error)) {
    const detail = JSON.stringify(error.response?.data ?? null);
    return `${error.response?.status ?? "?"} ${error.message} ${detail}`;
  }
  return error instanceof Error ? error.message : String(error);
}
