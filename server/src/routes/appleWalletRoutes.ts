import { Router } from "express";
import { z } from "zod";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
import { config } from "../config.js";
import { logInfo, logWarn, tokenFingerprint } from "../logger.js";
import { PassSigningConfigurationError } from "../wallet/AppleSigningMaterial.js";
import { WalletPassPackageService } from "../wallet/WalletPassPackageService.js";

const registrationSchema = z.object({
  pushToken: z.string().trim().min(1)
});

export function createAppleWalletRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const packageService = new WalletPassPackageService();

  router.use((request, response, next) => {
    response.on("finish", () => {
      logInfo("wallet.web_service.request", {
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        userAgent: request.get("User-Agent")
      });
    });
    next();
  });

  router.post("/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
    try {
      const input = registrationSchema.parse(request.body);
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass || request.params.passTypeIdentifier !== config.applePassTypeIdentifier) {
        logWarn("wallet.registration.rejected", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "pass_not_found_or_wrong_type"
        });
        response.sendStatus(404);
        return;
      }

      if (!isAuthorized(request.get("Authorization"), pass)) {
        logWarn("wallet.registration.rejected", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "unauthorized"
        });
        response.sendStatus(401);
        return;
      }

      await contentProvider.registerDevice({
        deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
        passTypeIdentifier: request.params.passTypeIdentifier,
        serialNumber: request.params.serialNumber,
        pushToken: input.pushToken,
        createdAt: new Date().toISOString()
      });
      logInfo("wallet.registration.saved", {
        deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
        passTypeIdentifier: request.params.passTypeIdentifier,
        serialNumber: request.params.serialNumber,
        pushTokenFingerprint: tokenFingerprint(input.pushToken)
      });
      response.sendStatus(201);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass || request.params.passTypeIdentifier !== config.applePassTypeIdentifier) {
        logWarn("wallet.registration_delete.rejected", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "pass_not_found_or_wrong_type"
        });
        response.sendStatus(404);
        return;
      }

      if (!isAuthorized(request.get("Authorization"), pass)) {
        logWarn("wallet.registration_delete.rejected", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "unauthorized"
        });
        response.sendStatus(401);
        return;
      }

      await contentProvider.unregisterDevice(
        request.params.deviceLibraryIdentifier,
        request.params.passTypeIdentifier,
        request.params.serialNumber
      );
      logInfo("wallet.registration.deleted", {
        deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
        passTypeIdentifier: request.params.passTypeIdentifier,
        serialNumber: request.params.serialNumber
      });
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  router.get("/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier", async (request, response, next) => {
    try {
      if (request.params.passTypeIdentifier !== config.applePassTypeIdentifier) {
        logWarn("wallet.updated_serials.rejected", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          reason: "wrong_pass_type"
        });
        response.sendStatus(404);
        return;
      }

      const passesUpdatedSince =
        typeof request.query.passesUpdatedSince === "string" ? request.query.passesUpdatedSince : undefined;
      const updates = await contentProvider.listUpdatedPassSerials(
        request.params.deviceLibraryIdentifier,
        request.params.passTypeIdentifier,
        passesUpdatedSince
      );

      if (!updates) {
        logInfo("wallet.updated_serials.none", {
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          passTypeIdentifier: request.params.passTypeIdentifier,
          passesUpdatedSince
        });
        response.sendStatus(204);
        return;
      }

      logInfo("wallet.updated_serials.found", {
        deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
        passTypeIdentifier: request.params.passTypeIdentifier,
        passesUpdatedSince,
        serialNumbers: updates.serialNumbers,
        lastUpdated: updates.lastUpdated
      });
      response.json(updates);
    } catch (error) {
      next(error);
    }
  });

  router.get("/passes/:passTypeIdentifier/:serialNumber", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassBySerialNumber(request.params.serialNumber);
      if (!pass || request.params.passTypeIdentifier !== config.applePassTypeIdentifier) {
        logWarn("wallet.pass_download.rejected", {
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "pass_not_found_or_wrong_type"
        });
        response.sendStatus(404);
        return;
      }

      if (!isAuthorized(request.get("Authorization"), pass)) {
        logWarn("wallet.pass_download.rejected", {
          passTypeIdentifier: request.params.passTypeIdentifier,
          serialNumber: request.params.serialNumber,
          reason: "unauthorized"
        });
        response.sendStatus(401);
        return;
      }

      const packageBuffer = await packageService.createPackage(pass);
      logInfo("wallet.pass_download.served", {
        passId: pass.id,
        passTypeIdentifier: request.params.passTypeIdentifier,
        serialNumber: pass.serialNumber,
        updatedAt: pass.updatedAt,
        contentLength: packageBuffer.byteLength
      });

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

  router.post("/log", (request, response) => {
    logInfo("wallet.device_log", { body: request.body });
    response.sendStatus(200);
  });

  router.use((request, response) => {
    logWarn("wallet.web_service.not_found", {
      method: request.method,
      path: request.originalUrl,
      userAgent: request.get("User-Agent")
    });
    response.sendStatus(404);
  });

  return router;
}

function isAuthorized(authorizationHeader: string | undefined, pass: WalletPass): boolean {
  return authorizationHeader === `ApplePass ${pass.appleAuthenticationToken}`;
}
