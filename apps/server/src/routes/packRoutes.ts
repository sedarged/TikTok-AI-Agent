import { Router } from "express";
import { loadNichePacks, updateNichePack } from "../services/plan/nichePacks.js";

export const packRouter = Router();

packRouter.get("/packs", async (_req, res) => {
  const packs = await loadNichePacks();
  res.json({ packs });
});

packRouter.put("/packs/:id", async (req, res) => {
  const updated = await updateNichePack(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: "Pack not found." });
    return;
  }
  res.json({ pack: updated });
});
