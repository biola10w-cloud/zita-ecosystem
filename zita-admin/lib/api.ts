const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res  = await fetch(`${BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, credentials: 'include' });
  const json = await res.json();
  if (!json.success) throw new ApiError(res.status, json.error?.code, json.error?.message);
  return json.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceFingerprint: 'admin-panel', platform: 'WEB' }) }),
    me:     () => request<any>('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  books: {
    list:    (page = 1, limit = 20) => request<any>(`/books?page=${page}&limit=${limit}`),
    get:     (slug: string)         => request<any>(`/books/${slug}`),
    create:  (formData: FormData)   => fetch(`${BASE_URL}/admin/books`, { method: 'POST', body: formData, credentials: 'include' }).then(r => r.json()),
    publish: (id: string)           => request(`/admin/books/${id}/publish`, { method: 'PUT' }),
    requestTranslation: (bookId: string, targetLanguage: string) => request('/admin/translations', { method: 'POST', body: JSON.stringify({ bookId, targetLanguage }) }),
  },
  users: {
    list:       (page = 1, limit = 20, search?: string, role?: string) => request<any>(`/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${role ? `&role=${role}` : ''}`),
    get:        (id: string) => request<any>(`/admin/users/${id}`),
    create:     (data: { email: string; password: string; displayName: string; role: string; preferredLanguage: string }) => request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    update:     (id: string, data: { displayName?: string; preferredLanguage?: string }) => request<any>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateRole: (id: string, role: string) => request<any>(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    delete:     (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    stats:      () => request<any>('/admin/stats'),
  },
  analytics: { dashboard: (days = 30) => request<any>(`/analytics/dashboard?days=${days}`) },
  community: {
    reports:      (status = 'PENDING', page = 1) => request<any>(`/admin/reports?status=${status}&page=${page}`),
    reviewReport: (id: string, action: 'ACTIONED' | 'DISMISSED') => request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify({ action }) }),
  },
};

