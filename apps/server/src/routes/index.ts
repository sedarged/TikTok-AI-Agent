import { Router } from 'express';
import { projectRouter } from './project';

import { renderRouter } from './render';

export const router = Router();

router.get('/test', (req, res) => {
  res.json({ message: 'API is working' });
});

router.use(projectRouter);
router.use(renderRouter);
