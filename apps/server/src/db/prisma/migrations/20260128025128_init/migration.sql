-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "nichePackId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "targetLengthSec" INTEGER NOT NULL,
    "tempo" TEXT NOT NULL,
    "voicePreset" TEXT NOT NULL,
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
    "hookOptionsJson" TEXT NOT NULL,
    "hookSelected" TEXT,
    "outline" TEXT,
    "scriptFull" TEXT,
    "estimatesJson" TEXT,
    "validationJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "narrationText" TEXT NOT NULL,
    "onScreenText" TEXT NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "negativePrompt" TEXT NOT NULL,
    "effectPreset" TEXT NOT NULL,
    "durationTargetSec" REAL NOT NULL,
    "startTimeSec" REAL,
    "endTimeSec" REAL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scene_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "logsJson" TEXT,
    "artifactsJson" TEXT,
    "resumeStateJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Run_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "hashKey" TEXT NOT NULL,
    "resultJson" TEXT,
    "payloadPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Cache_hashKey_key" ON "Cache"("hashKey");
