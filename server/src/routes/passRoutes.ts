import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";
import { PassService } from "../wallet/passService.js";
import { PassSigningConfigurationError } from "../wallet/AppleSigningMaterial.js";
import { WalletPassPackageService } from "../wallet/WalletPassPackageService.js";
import { PassPushNotificationService } from "../wallet/PassPushNotificationService.js";

const createPassSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().regex(/^[A-Za-z0-9._-]{4,64}$/).optional()
});

export function createPassRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const passService = new PassService(contentProvider);
  const packageService = new WalletPassPackageService();
  const pushService = new PassPushNotificationService(contentProvider);

  router.post("/", async (request, response, next) => {
    try {
      const input = createPassSchema.parse(request.body);

      // Creating with an existing serial number updates that pass instead,
      // pushing the new holder name to installed Wallet copies.
      if (input.serialNumber) {
        const existing = await contentProvider.getPassBySerialNumber(input.serialNumber);
        if (existing) {
          const pass = await contentProvider.updatePassName(existing.id, {
            firstName: input.firstName,
            lastName: input.lastName
          });
          await pushService.notifyPassUpdated(pass);
          response.status(200).json({
            id: pass.id,
            serialNumber: pass.serialNumber,
            downloadUrl: passService.getDownloadUrl(pass.serialNumber),
            updated: true
          });
          return;
        }
      }

      response.status(201).json(await passService.createPass(input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:serialNumber/download", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass) {
        response.sendStatus(404);
        return;
      }

      const packageBuffer = await packageService.createPackage(pass);

      response
        .status(200)
        .set({
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="${pass.serialNumber}.pkpass"`,
          "Content-Length": packageBuffer.byteLength.toString()
        })
        .send(packageBuffer);
    } catch (error) {
      if (error instanceof PassSigningConfigurationError) {
        response.status(503).json({
          message: "Apple Wallet pass signing is not configured.",
          detail: error.message
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
