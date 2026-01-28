import { Router } from 'express';
import { prisma } from '../db/prisma.js';

export const packsRouter = Router();

packsRouter.get('/packs', async (_req, res) => {
  const packs = await prisma.nichePack.findMany({ orderBy: { id: 'asc' } });
  res.json({
    packs: packs.map((p) => ({ id: p.id, title: p.title, config: JSON.parse(p.configJson) }))
  });
});

packsRouter.put('/packs/:id', async (req, res) => {
  const id = req.params.id;
  const { title, config } = req.body ?? {};
  if (!title || typeof title !== 'string' || !config || typeof config !== 'object') {
    res.status(400).json({ error: 'Invalid payload. Expected { title: string, config: object }.' });
    return;
  }
  const updated = await prisma.nichePack.update({
    where: { id },
    data: { title, configJson: JSON.stringify(config) }
  });
  res.json({ id: updated.id, title: updated.title, config: JSON.parse(updated.configJson) });
});

