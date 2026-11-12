-- Keep existing book discussions; new community posts need no book association.
ALTER TABLE "Comment" ALTER COLUMN "bookId" DROP NOT NULL;
CREATE INDEX "Comment_parentId_isDeleted_createdAt_idx" ON "Comment"("parentId", "isDeleted", "createdAt");
