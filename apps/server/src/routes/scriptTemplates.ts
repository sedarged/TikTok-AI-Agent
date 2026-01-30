import { Router } from 'express';
import { SCRIPT_TEMPLATES } from '../services/plan/scriptTemplates.js';

export const scriptTemplatesRoutes = Router();

scriptTemplatesRoutes.get('/', (_req, res) => {
  res.json(SCRIPT_TEMPLATES);
});
