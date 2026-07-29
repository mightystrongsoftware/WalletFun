import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";

const updateSchema = z.object({
  message: z.string().trim().min(1).max(240)
});

const updateNameSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80)
});

export function createAdminRoutes(contentProvider: ContentProvider): Router {
  const router = Router();

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
      response.status(201).json({ update });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/passes/:passId/name", async (request, response, next) => {
    try {
      const input = updateNameSchema.parse(request.body);
      const pass = await contentProvider.updatePassName(request.params.passId, input);
      response.json({ pass });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
