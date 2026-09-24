import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
import { GoogleWalletPassService, GoogleWalletUpdateResult } from "./GoogleWalletPassService.js";
import { PassPushNotificationResult, PassPushNotificationService } from "./PassPushNotificationService.js";

export interface WalletUpdateResults {
  apple: PassPushNotificationResult;
  google: GoogleWalletUpdateResult;
}

/**
 * Fans a pass change out to every wallet platform. Apple Wallet gets an APNs
 * wake-up so it re-downloads the pass; Google Wallet gets the object patched
 * directly. Each side reports independently so admins can see both outcomes.
 */
export class WalletUpdateService {
  private readonly applePush: PassPushNotificationService;
  private readonly google = new GoogleWalletPassService();

  constructor(contentProvider: ContentProvider) {
    this.applePush = new PassPushNotificationService(contentProvider);
  }

  async notifyPassUpdated(pass: WalletPass): Promise<WalletUpdateResults> {
    const [apple, google] = await Promise.all([
      this.applePush.notifyPassUpdated(pass),
      this.google.notifyPassUpdated(pass)
    ]);

    return { apple, google };
  }
}
