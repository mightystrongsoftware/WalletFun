import { Notification, Provider } from "@parse/node-apn";
import { config } from "../config.js";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
import { logError, logInfo, logWarn, tokenFingerprint } from "../logger.js";
import { PassSigningConfigurationError, readAppleSigningMaterial } from "./AppleSigningMaterial.js";

export interface PassPushNotificationResult {
  attempted: boolean;
  sent: number;
  failed: number;
  skippedReason?: string;
}

export class PassPushNotificationService {
  constructor(private contentProvider: ContentProvider) {}

  async notifyPassUpdated(pass: WalletPass): Promise<PassPushNotificationResult> {
    logInfo("wallet.pass_push.start", {
      passId: pass.id,
      serialNumber: pass.serialNumber,
      pushUpdatesEnabled: config.applePushUpdatesEnabled,
      apnsProduction: config.appleApnsProduction
    });

    if (!config.applePushUpdatesEnabled) {
      logWarn("wallet.pass_push.skipped", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        reason: "disabled"
      });
      return { attempted: false, sent: 0, failed: 0, skippedReason: "Apple Wallet push updates are disabled." };
    }

    try {
      const signingMaterial = readAppleSigningMaterial();
      const registrations = await this.contentProvider.listDeviceRegistrationsForPass(
        signingMaterial.passTypeIdentifier,
        pass.serialNumber
      );

      logInfo("wallet.pass_push.registrations_loaded", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        passTypeIdentifier: signingMaterial.passTypeIdentifier,
        registrationCount: registrations.length,
        pushTokenFingerprints: registrations.map((registration) => tokenFingerprint(registration.pushToken))
      });

      if (registrations.length === 0) {
        logWarn("wallet.pass_push.skipped", {
          passId: pass.id,
          serialNumber: pass.serialNumber,
          reason: "no_registered_devices"
        });
        return { attempted: false, sent: 0, failed: 0, skippedReason: "No registered devices for this pass." };
      }

      const provider = new Provider({
        cert: signingMaterial.signerCert,
        key: signingMaterial.signerKey,
        ...(signingMaterial.signerKeyPassphrase ? { passphrase: signingMaterial.signerKeyPassphrase } : {}),
        production: config.appleApnsProduction
      });

      const notification = new Notification();
      notification.topic = signingMaterial.passTypeIdentifier;
      notification.rawPayload = {};
      notification.expiry = Math.floor(Date.now() / 1000) + 3600;
      notification.priority = 10;

      const result = await provider.send(
        notification,
        registrations.map((registration) => registration.pushToken)
      );
      await provider.shutdown();

      if (result.failed.length > 0) {
        logWarn("wallet.pass_push.apns_failures", {
          passId: pass.id,
          serialNumber: pass.serialNumber,
          failures: result.failed.map((failure) => ({
            device: tokenFingerprint(failure.device),
            status: failure.status,
            reason: failure.response?.reason,
            error: failure.error?.message
          }))
        });
      }

      logInfo("wallet.pass_push.complete", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        sent: result.sent.length,
        failed: result.failed.length
      });

      return {
        attempted: true,
        sent: result.sent.length,
        failed: result.failed.length
      };
    } catch (error) {
      if (error instanceof PassSigningConfigurationError) {
        logWarn("wallet.pass_push.skipped", {
          passId: pass.id,
          serialNumber: pass.serialNumber,
          reason: "signing_configuration",
          message: error.message
        });
        return { attempted: false, sent: 0, failed: 0, skippedReason: error.message };
      }

      logError("wallet.pass_push.error", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        error: error instanceof Error ? error.message : String(error)
      });
      return { attempted: true, sent: 0, failed: 1, skippedReason: "APNs request failed." };
    }
  }
}
