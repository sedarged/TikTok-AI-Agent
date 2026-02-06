-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "Run_projectId_idx" ON "Run"("projectId");

-- CreateIndex
CREATE INDEX "Run_scheduledPublishAt_idx" ON "Run"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");
