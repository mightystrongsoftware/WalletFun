import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";
import { PassPushNotificationService } from "../wallet/PassPushNotificationService.js";

const updateSchema = z.object({
  message: z.string().trim().min(1).max(240)
});

const updateNameSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80)
});

export function createAdminRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const pushService = new PassPushNotificationService(contentProvider);

  router.get("/passes", async (_request, response, next) => {
    try {
      response.json({ passes: await contentProvider.listPasses() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/passes/:passId/updates", async (request, response, next) => {
    try {
      const input = updateSchema.parse(request.body);
      const update = await contentProvider.createPassUpdate(request.params.passId, input.message);
      const pass = await contentProvider.getPassById(request.params.passId);
      const push = pass ? await pushService.notifyPassUpdated(pass) : undefined;
      response.status(201).json({ update, push });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/passes/:passId/name", async (request, response, next) => {
    try {
      const input = updateNameSchema.parse(request.body);
      const pass = await contentProvider.updatePassName(request.params.passId, input);
      const push = await pushService.notifyPassUpdated(pass);
      response.json({ pass, push });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
