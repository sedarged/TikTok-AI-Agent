-- CreateIndex
CREATE INDEX "Cache_kind_idx" ON "Cache"("kind");

-- CreateIndex
CREATE INDEX "PlanVersion_projectId_idx" ON "PlanVersion"("projectId");

-- CreateIndex
CREATE INDEX "PlanVersion_createdAt_idx" ON "PlanVersion"("createdAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Scene_planVersionId_idx" ON "Scene"("planVersionId");

-- CreateIndex
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");

-- CreateIndex
CREATE INDEX "Scene_planVersionId_sceneIdx_idx" ON "Scene"("planVersionId", "idx");
