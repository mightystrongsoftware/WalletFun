import { Notification, Provider } from "@parse/node-apn";
import { config } from "../config.js";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
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
    if (!config.applePushUpdatesEnabled) {
      return { attempted: false, sent: 0, failed: 0, skippedReason: "Apple Wallet push updates are disabled." };
    }

    try {
      const signingMaterial = readAppleSigningMaterial();
      const registrations = await this.contentProvider.listDeviceRegistrationsForPass(
        signingMaterial.passTypeIdentifier,
        pass.serialNumber
      );

      if (registrations.length === 0) {
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
      notification.payload = {};
      notification.expiry = Math.floor(Date.now() / 1000) + 3600;
      notification.priority = 10;

      const result = await provider.send(
        notification,
        registrations.map((registration) => registration.pushToken)
      );
      await provider.shutdown();

      if (result.failed.length > 0) {
        console.warn("Apple Wallet pass push notification failures", result.failed);
      }

      return {
        attempted: true,
        sent: result.sent.length,
        failed: result.failed.length
      };
    } catch (error) {
      if (error instanceof PassSigningConfigurationError) {
        return { attempted: false, sent: 0, failed: 0, skippedReason: error.message };
      }

      console.error("Apple Wallet pass push notification failed", error);
      return { attempted: true, sent: 0, failed: 1, skippedReason: "APNs request failed." };
    }
  }
}
