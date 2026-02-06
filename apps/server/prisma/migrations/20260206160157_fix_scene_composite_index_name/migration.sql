-- RedefineIndex
DROP INDEX "Scene_planVersionId_idx_idx";
CREATE INDEX "Scene_planVersionId_sceneIdx_idx" ON "Scene"("planVersionId", "idx");
