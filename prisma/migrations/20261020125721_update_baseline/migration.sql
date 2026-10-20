-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceHelpfulVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceHelpfulVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceHelpfulVote_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reporterId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ResourceReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceReport_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certification" ("code", "codeKey", "createdAt", "createdById", "description", "id", "provider", "providerKey", "title", "updatedAt") SELECT "code", "codeKey", "createdAt", "createdById", "description", "id", "provider", "providerKey", "title", "updatedAt" FROM "Certification";
DROP TABLE "Certification";
ALTER TABLE "new_Certification" RENAME TO "Certification";
CREATE INDEX "Certification_providerKey_idx" ON "Certification"("providerKey");
CREATE INDEX "Certification_updatedAt_idx" ON "Certification"("updatedAt");
CREATE UNIQUE INDEX "Certification_providerKey_codeKey_key" ON "Certification"("providerKey", "codeKey");
CREATE TABLE "new_Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '{}',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "language" TEXT NOT NULL DEFAULT 'en',
    "estimatedMinutes" INTEGER,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "hiddenAt" DATETIME,
    "hiddenById" TEXT,
    "storageName" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "certificationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resource_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Resource_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Resource_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Resource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Resource" ("certificationId", "content", "createdAt", "createdById", "fileSize", "id", "mimeType", "originalFileName", "storageName", "title", "type", "updatedAt") SELECT "certificationId", "content", "createdAt", "createdById", "fileSize", "id", "mimeType", "originalFileName", "storageName", "title", "type", "updatedAt" FROM "Resource";
DROP TABLE "Resource";
ALTER TABLE "new_Resource" RENAME TO "Resource";
CREATE INDEX "Resource_certificationId_type_idx" ON "Resource"("certificationId", "type");
CREATE INDEX "Resource_createdById_idx" ON "Resource"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_resourceId_key" ON "Bookmark"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceHelpfulVote_resourceId_idx" ON "ResourceHelpfulVote"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceHelpfulVote_userId_resourceId_key" ON "ResourceHelpfulVote"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceReport_status_createdAt_idx" ON "ResourceReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceReport_resourceId_idx" ON "ResourceReport"("resourceId");
