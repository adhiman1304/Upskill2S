-- CreateTable
CREATE TABLE "UserProviderKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "encryptedKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "lastValidatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProviderKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "certificationId" TEXT,
    "intakeSessionId" TEXT,
    "requestedById" TEXT NOT NULL,
    "useServerKey" BOOLEAN NOT NULL DEFAULT false,
    "progress" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "resultBriefId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "ResearchJob_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "jobId" TEXT,
    "requestedById" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyBrief_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyBrief_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistProgress_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistProgress_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "StudyBrief" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BriefFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BriefFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BriefFeedback_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "StudyBrief" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STUDYING',
    "targetDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntakeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inputText" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "extractedText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "result" TEXT,
    "model" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntakeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "examVersion" TEXT,
    "examUpdatedAt" DATETIME,
    "officialUrl" TEXT,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "isCatalog" BOOLEAN NOT NULL DEFAULT false,
    "lastResearchedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certification" ("code", "codeKey", "createdAt", "createdById", "description", "examUpdatedAt", "examVersion", "id", "provider", "providerKey", "status", "title", "updatedAt") SELECT "code", "codeKey", "createdAt", "createdById", "description", "examUpdatedAt", "examVersion", "id", "provider", "providerKey", "status", "title", "updatedAt" FROM "Certification";
DROP TABLE "Certification";
ALTER TABLE "new_Certification" RENAME TO "Certification";
CREATE INDEX "Certification_providerKey_idx" ON "Certification"("providerKey");
CREATE INDEX "Certification_updatedAt_idx" ON "Certification"("updatedAt");
CREATE UNIQUE INDEX "Certification_providerKey_codeKey_key" ON "Certification"("providerKey", "codeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserProviderKey_userId_provider_key" ON "UserProviderKey"("userId", "provider");

-- CreateIndex
CREATE INDEX "ResearchJob_status_createdAt_idx" ON "ResearchJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchJob_certificationId_createdAt_idx" ON "ResearchJob"("certificationId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchJob_requestedById_createdAt_idx" ON "ResearchJob"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "StudyBrief_certificationId_status_idx" ON "StudyBrief"("certificationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudyBrief_certificationId_version_key" ON "StudyBrief"("certificationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistProgress_userId_certificationId_itemId_key" ON "ChecklistProgress"("userId", "certificationId", "itemId");

-- CreateIndex
CREATE INDEX "BriefFeedback_briefId_idx" ON "BriefFeedback"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefFeedback_userId_briefId_itemType_itemId_key" ON "BriefFeedback"("userId", "briefId", "itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCertification_userId_certificationId_key" ON "UserCertification"("userId", "certificationId");

-- CreateIndex
CREATE INDEX "IntakeSession_userId_createdAt_idx" ON "IntakeSession"("userId", "createdAt");
