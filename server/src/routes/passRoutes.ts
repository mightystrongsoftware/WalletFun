import { Router } from "express";
import { z } from "zod";
import { NextFunction, Response } from "express";
import { ContentProvider } from "../content/ContentProvider.js";
import { PassService } from "../wallet/passService.js";
import { PassSigningConfigurationError } from "../wallet/AppleSigningMaterial.js";
import { GoogleWalletConfigurationError } from "../wallet/GoogleSigningMaterial.js";
import { GoogleWalletApiError, GoogleWalletPassService } from "../wallet/GoogleWalletPassService.js";
import { WalletPassPackageService } from "../wallet/WalletPassPackageService.js";
import { WalletUpdateService } from "../wallet/WalletUpdateService.js";

const createPassSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().regex(/^[A-Za-z0-9._-]{4,64}$/).optional()
});

export function createPassRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const passService = new PassService(contentProvider);
  const packageService = new WalletPassPackageService();
  const googleWalletService = new GoogleWalletPassService();
  const updateService = new WalletUpdateService(contentProvider);

  router.post("/", async (request, response, next) => {
    try {
      const input = createPassSchema.parse(request.body);

      // Creating with an existing serial number updates that pass instead,
      // pushing the new holder name to installed Apple and Google Wallet copies.
      if (input.serialNumber) {
        const existing = await contentProvider.getPassBySerialNumber(input.serialNumber);
        if (existing) {
          const pass = await contentProvider.updatePassName(existing.id, {
            firstName: input.firstName,
            lastName: input.lastName
          });
          await updateService.notifyPassUpdated(pass);
          response.status(200).json(passService.toCreatePassResponse(pass, true));
          return;
        }
      }

      response.status(201).json(await passService.createPass(input));
    } catch (error) {
      next(error);
    }
  });

  // Apple Wallet: signed .pkpass package for PKAddPassesViewController.
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

  // Google Wallet: signed Save to Google Wallet JWT for PayClient.savePassesJwt.
  router.get("/:serialNumber/google-wallet", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass) {
        response.sendStatus(404);
        return;
      }

      response.set("Cache-Control", "no-store").json(await googleWalletService.createSavePayload(pass));
    } catch (error) {
      handleGoogleWalletError(error, response, next);
    }
  });

  // Google Wallet: shareable link. Redirects to pay.google.com so a recipient
  // without the app can add the pass from any browser or Android device.
  router.get("/:serialNumber/google-wallet/save", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass) {
        response.sendStatus(404);
        return;
      }

      const payload = await googleWalletService.createSavePayload(pass);
      response.set("Cache-Control", "no-store").redirect(302, payload.saveUrl);
    } catch (error) {
      handleGoogleWalletError(error, response, next);
    }
  });

  return router;
}

/** 503 when our Google settings are missing or unreadable, 502 when Google rejects the request. */
function handleGoogleWalletError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof GoogleWalletConfigurationError) {
    response.status(503).json({ message: "Google Wallet is not configured.", detail: error.message });
    return;
  }

  if (error instanceof GoogleWalletApiError) {
    response.status(502).json({ message: "Google Wallet API request failed.", detail: error.message });
    return;
  }

  next(error);
}
