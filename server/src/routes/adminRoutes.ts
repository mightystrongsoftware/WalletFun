import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";

const updateSchema = z.object({
  message: z.string().trim().min(1).max(240)
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

  return router;
}

