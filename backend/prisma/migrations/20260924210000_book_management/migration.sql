CREATE TABLE "BookCategory" (
  "bookId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "BookCategory_pkey" PRIMARY KEY ("bookId", "categoryId")
);
CREATE INDEX "BookCategory_categoryId_idx" ON "BookCategory"("categoryId");
ALTER TABLE "BookCategory" ADD CONSTRAINT "BookCategory_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookCategory" ADD CONSTRAINT "BookCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve categories already assigned to uploaded books.
INSERT INTO "BookCategory" ("bookId", "categoryId")
SELECT "id", "categoryId" FROM "Book" WHERE "categoryId" IS NOT NULL;

CREATE TABLE "DeletedBook" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeletedBook_pkey" PRIMARY KEY ("id")
);
