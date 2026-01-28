import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { startRender } from '../services/render/pipeline';

const router = Router();
const prisma = new PrismaClient();

// Approve Plan
router.post('/plan/:planVersionId/approve', async (req, res) => {
  try {
    const { planVersionId } = req.params;
    
    await prisma.project.updateMany({
        where: { planVersions: { some: { id: planVersionId } } },
        data: { status: 'APPROVED' }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve plan' });
  }
});

// Start Render
router.post('/plan/:planVersionId/render', async (req, res) => {
  try {
    const { planVersionId } = req.params;
    
    // Find project ID
    const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    await prisma.project.update({
        where: { id: plan.projectId },
        data: { status: 'RENDERING' }
    });

    const run = await startRender(plan.projectId, planVersionId);

    res.json(run);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to start render' });
  }
});

// Get Run Status
router.get('/run/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// Verify Artifacts (Stub)
router.get('/run/:runId/verify', async (req, res) => {
    // TODO: Implement verification
    res.json({ status: 'PASS', details: [] });
});

export { router as renderRouter };
