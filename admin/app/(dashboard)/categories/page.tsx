import { apiFetch } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';
import { CreateCategoryForm } from './create-category-form';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  children: { id: string; name: string; _count: { books: number } }[];
  _count: { books: number };
}

export default async function CategoriesPage() {
  const token = getSessionToken();
  let categories: Category[] = [];
  let loadError: string | null = null;

  try {
    const result = await apiFetch<Category[]>('/admin/categories', token);
    categories = result.data;
  } catch (err: any) {
    loadError = err.message ?? 'Failed to load categories';
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-primary">Categories</h1>
      <p className="mb-6 text-sm text-gray-500">
        {categories.length} top-level categories, used for the book upload picker and homepage browsing.
      </p>

      <div className="mb-6">
        <CreateCategoryForm topLevelCategories={categories} />
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">{cat.icon ?? '📁'}</span>
              <span className="font-semibold text-primary">{cat.name}</span>
              <span className="ml-auto text-xs text-gray-400">{cat._count.books} books</span>
            </div>
            <ul className="flex flex-col gap-1">
              {cat.children.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between text-sm text-gray-500">
                  <span>{sub.name}</span>
                  <span className="text-xs text-gray-400">{sub._count.books}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
