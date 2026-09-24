import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { ContentProvider, WalletPass } from "../content/ContentProvider.js";
import { logInfo } from "../logger.js";
import { GoogleWalletPassService } from "../wallet/GoogleWalletPassService.js";
import { GoogleWalletConfigurationError, readGoogleSigningMaterial } from "../wallet/GoogleSigningMaterial.js";
import { WalletUpdateService } from "../wallet/WalletUpdateService.js";

const updateSchema = z.object({
  message: z.string().trim().min(1).max(240)
});

const updateNameSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80)
});

export function createAdminRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const updateService = new WalletUpdateService(contentProvider);
  const googleWalletService = new GoogleWalletPassService();

  router.get("/passes", async (_request, response, next) => {
    try {
      response.json({ passes: (await contentProvider.listPasses()).map(toAdminPass) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/passes/:passId/wallet-metadata", async (request, response, next) => {
    try {
      const pass = await contentProvider.getPassById(request.params.passId);
      if (!pass) {
        response.sendStatus(404);
        return;
      }

      response.json({
        passId: pass.id,
        serialNumber: pass.serialNumber,
        passTypeIdentifier: config.applePassTypeIdentifier,
        teamIdentifierConfigured: Boolean(config.appleTeamIdentifier),
        webServiceURL: config.publicApiBaseUrl,
        authenticationTokenConfigured: pass.appleAuthenticationToken.length > 0,
        authenticationTokenLength: pass.appleAuthenticationToken.length,
        googleWallet: describeGoogleWallet(googleWalletService, pass.serialNumber),
        updatedAt: pass.updatedAt
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/passes/:passId/updates", async (request, response, next) => {
    try {
      const input = updateSchema.parse(request.body);
      logInfo("admin.pass_update.requested", { passId: request.params.passId });
      const update = await contentProvider.createPassUpdate(request.params.passId, input.message);
      const pass = await contentProvider.getPassById(request.params.passId);
      const results = pass ? await updateService.notifyPassUpdated(pass) : undefined;
      logInfo("admin.pass_update.complete", { passId: request.params.passId, results });
      response.status(201).json({ update, push: results?.apple, googleWallet: results?.google });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/passes/:passId/name", async (request, response, next) => {
    try {
      const input = updateNameSchema.parse(request.body);
      logInfo("admin.pass_name_update.requested", { passId: request.params.passId });
      const pass = await contentProvider.updatePassName(request.params.passId, input);
      const results = await updateService.notifyPassUpdated(pass);
      logInfo("admin.pass_name_update.complete", {
        passId: pass.id,
        serialNumber: pass.serialNumber,
        updatedAt: pass.updatedAt,
        results
      });
      response.json({ pass: toAdminPass(pass), push: results.apple, googleWallet: results.google });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function toAdminPass(pass: WalletPass): Omit<WalletPass, "appleAuthenticationToken"> {
  const { appleAuthenticationToken: _appleAuthenticationToken, ...adminPass } = pass;
  return adminPass;
}

function describeGoogleWallet(service: GoogleWalletPassService, serialNumber: string) {
  try {
    const material = readGoogleSigningMaterial();
    return {
      configured: true,
      issuerId: material.issuerId,
      classId: material.classId,
      objectId: service.getObjectId(serialNumber, material)
    };
  } catch (error) {
    if (error instanceof GoogleWalletConfigurationError) {
      return { configured: false, detail: error.message };
    }
    throw error;
  }
}
