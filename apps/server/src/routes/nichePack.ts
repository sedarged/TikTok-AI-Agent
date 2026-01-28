import { Router } from 'express';
import { NICHE_PACKS, getNichePack } from '../services/nichePacks.js';

export const nichePackRoutes = Router();

// Get all niche packs
nichePackRoutes.get('/', (req, res) => {
  const packs = NICHE_PACKS.map(pack => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
  }));
  res.json(packs);
});

// Get single niche pack with full details
nichePackRoutes.get('/:id', (req, res) => {
  const pack = getNichePack(req.params.id);
  if (!pack) {
    return res.status(404).json({ error: 'Niche pack not found' });
  }
  res.json(pack);
});
