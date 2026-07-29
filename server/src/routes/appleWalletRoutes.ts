import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";
import { PassSigningConfigurationError, WalletPassPackageService } from "../wallet/WalletPassPackageService.js";

const registrationSchema = z.object({
  pushToken: z.string().trim().min(1)
});

export function createAppleWalletRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const packageService = new WalletPassPackageService();

  router.post("/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
    try {
      const input = registrationSchema.parse(request.body);
      await contentProvider.registerDevice({
        deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
        passTypeIdentifier: request.params.passTypeIdentifier,
        serialNumber: request.params.serialNumber,
        pushToken: input.pushToken,
        createdAt: new Date().toISOString()
      });
      response.sendStatus(201);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
    try {
      await contentProvider.unregisterDevice(
        request.params.deviceLibraryIdentifier,
        request.params.passTypeIdentifier,
        request.params.serialNumber
      );
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  router.get("/passes/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
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
