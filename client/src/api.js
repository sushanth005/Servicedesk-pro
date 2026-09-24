import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use((c) => { const t = localStorage.getItem('sdp_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config.url.includes('/auth/login')) { localStorage.removeItem('sdp_token'); if (!location.pathname.startsWith('/login')) location.href = '/login'; }
  return Promise.reject(e);
});
export const errMsg = (e) => { const d = e.response?.data; if (d?.details?.length) return d.details.map((x) => x.message).join(' · '); return d?.message || e.message || 'Something went wrong'; };
export async function download(url, params, filename) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}
export default api;
