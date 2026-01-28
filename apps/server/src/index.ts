import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./env.js";
import { ensureNichePacksFile } from "./services/plan/nichePacks.js";
import { statusRouter } from "./routes/statusRoutes.js";
import { packRouter } from "./routes/packRoutes.js";
import { projectRouter } from "./routes/projectRoutes.js";
import { planRouter } from "./routes/planRoutes.js";
import { runRouter } from "./routes/runRoutes.js";

async function bootstrap() {
  await ensureNichePacksFile();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", statusRouter);
  app.use("/api", packRouter);
  app.use("/api", projectRouter);
  app.use("/api", planRouter);
  app.use("/api", runRouter);

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
