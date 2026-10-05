export interface CategoryOption {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export function CategoryPicker({ categories, selected = [] }: { categories: CategoryOption[]; selected?: string[] }) {
  return <fieldset className="rounded-lg border border-gray-200 p-4">
    <legend className="px-1 text-xs font-semibold uppercase text-gray-500">Categories</legend>
    <p className="mb-3 text-sm text-gray-500">Select all categories that apply.</p>
    {categories.length ? <div className="grid max-h-72 gap-4 overflow-y-auto sm:grid-cols-2">{categories.map((category) => <div key={category.id}>
      <label className="flex items-center gap-2 text-sm font-semibold text-primary"><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={selected.includes(category.id)} />{category.name}</label>
      <div className="ml-5 mt-2 space-y-2">{category.children.map((child) => <label key={child.id} className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" name="categoryIds" value={child.id} defaultChecked={selected.includes(child.id)} />{child.name}</label>)}</div>
    </div>)}</div> : <p className="text-sm text-gray-500">No categories available. Add categories from the Categories page.</p>}
  </fieldset>;
}
