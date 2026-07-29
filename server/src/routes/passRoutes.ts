import { Router } from "express";
import { z } from "zod";
import { ContentProvider } from "../content/ContentProvider.js";
import { PassService } from "../wallet/passService.js";

const createPassSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80)
});

export function createPassRoutes(contentProvider: ContentProvider): Router {
  const router = Router();
  const passService = new PassService(contentProvider);

  router.post("/", async (request, response, next) => {
    try {
      const input = createPassSchema.parse(request.body);
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

      response
        .status(501)
        .json({
          message: "Pass package signing is not implemented yet. Keep Apple certificates outside Git and wire them in through environment-backed storage.",
          serialNumber: pass.serialNumber
        });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

