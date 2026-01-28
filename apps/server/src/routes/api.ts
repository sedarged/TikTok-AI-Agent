import { Router } from 'express';
import { projectRouter } from './project.js';
import { planRouter } from './plan.js';
import { sceneRouter } from './scene.js';
import { runRouter } from './run.js';
import { packsRouter } from './packs.js';

export const apiRouter = Router();

apiRouter.use(packsRouter);
apiRouter.use(projectRouter);
apiRouter.use(planRouter);
apiRouter.use(sceneRouter);
apiRouter.use(runRouter);

