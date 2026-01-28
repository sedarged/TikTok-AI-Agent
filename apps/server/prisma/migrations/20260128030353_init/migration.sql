-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "nichePackId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "targetLengthSec" INTEGER NOT NULL DEFAULT 60,
    "tempo" TEXT NOT NULL DEFAULT 'normal',
    "voicePreset" TEXT NOT NULL DEFAULT 'alloy',
    "visualStylePreset" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT_PLAN',
    "latestPlanVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hookOptionsJson" TEXT NOT NULL DEFAULT '[]',
    "hookSelected" TEXT NOT NULL DEFAULT '',
    "outline" TEXT NOT NULL DEFAULT '',
    "scriptFull" TEXT NOT NULL DEFAULT '',
    "estimatesJson" TEXT NOT NULL DEFAULT '{}',
    "validationJson" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "PlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "narrationText" TEXT NOT NULL DEFAULT '',
    "onScreenText" TEXT NOT NULL DEFAULT '',
    "visualPrompt" TEXT NOT NULL DEFAULT '',
    "negativePrompt" TEXT NOT NULL DEFAULT '',
    "effectPreset" TEXT NOT NULL DEFAULT 'slow_zoom_in',
    "durationTargetSec" REAL NOT NULL DEFAULT 5.0,
    "startTimeSec" REAL NOT NULL DEFAULT 0.0,
    "endTimeSec" REAL NOT NULL DEFAULT 5.0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT NOT NULL DEFAULT '',
    "logsJson" TEXT NOT NULL DEFAULT '[]',
    "artifactsJson" TEXT NOT NULL DEFAULT '{}',
    "resumeStateJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Run_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "hashKey" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL DEFAULT '{}',
    "payloadPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Cache_hashKey_key" ON "Cache"("hashKey");
