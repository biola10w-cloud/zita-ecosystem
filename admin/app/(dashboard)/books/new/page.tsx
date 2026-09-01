import { apiFetch } from '../../../../lib/api';
import { getSessionToken } from '../../../../lib/auth';
import { UploadForm } from './upload-form';

interface CategoryOption {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export default async function NewBookPage() {
  const token = getSessionToken();
  let categories: CategoryOption[] = [];

  try {
    const result = await apiFetch<CategoryOption[]>('/admin/categories', token);
    categories = result.data;
  } catch {
    // Non-fatal — the form still works without a category selected
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-primary">Upload New Book</h1>
      <p className="mb-6 text-sm text-gray-500">
        Content is encrypted with AES-256-GCM before storage. Publish it from the Books list once encryption completes.
      </p>

      <UploadForm categories={categories} />
    </div>
  );
}
