import { Prisma } from '@prisma/client';

// Keep the legacy primary category readable by older mobile clients.
export const categorySelection = { select: { category: { select: { id: true, name: true, slug: true, icon: true } } } } as const;

export function categoryFilter(value: string, field: 'id' | 'slug', includeChildren = true): Prisma.BookWhereInput {
  const category: Prisma.CategoryWhereInput = {
    OR: [{ [field]: value }, ...(includeChildren ? [{ parent: { [field]: value } }] : [])],
  };
  return { OR: [{ category }, { categories: { some: { category } } }] };
}

export function flattenCategories(book: any) {
  const categories = new Map<string, any>();
  if (book.category) categories.set(book.category.id, book.category);
  for (const entry of book.categories ?? []) categories.set(entry.category.id, entry.category);
  return [...categories.values()];
}
