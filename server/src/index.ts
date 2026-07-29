import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { createContentProvider } from "./content/createContentProvider.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";
import { createAppleWalletRoutes } from "./routes/appleWalletRoutes.js";
import { createPassRoutes } from "./routes/passRoutes.js";

const app = express();
const contentProvider = createContentProvider();

app.use(cors({ origin: config.webOrigin }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api/passes", createPassRoutes(contentProvider));
app.use("/api/admin", createAdminRoutes(contentProvider));
app.use("/v1", createAppleWalletRoutes(contentProvider));

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ message: "Invalid request", issues: error.flatten() });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Internal server error" });
};

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`WalletFun server listening on http://127.0.0.1:${config.port}`);
});

