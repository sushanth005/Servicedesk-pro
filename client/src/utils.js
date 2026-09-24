import { useCallback, useEffect, useRef, useState } from 'react';
export const fmtDT = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtD = (d) => (d ? new Date(d).toLocaleDateString([], { dateStyle: 'medium' }) : '-');
export const inputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const money = (n) => (n == null ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n));
export const initials = (n = '?') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const label = (s = '') => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };
export const dur = (ms) => { const m = Math.round(Math.abs(ms) / 60000); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 48) return `${h}h ${m % 60}m`; return `${Math.floor(h / 24)}d ${h % 24}h`; };
export const bytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const STAFF = ['admin', 'manager', 'technician'];
export const ROLE_LABEL = { admin: 'System Admin', manager: 'IT Manager', technician: 'Technician', employee: 'Employee', asset_manager: 'Asset Manager' };

// Fetch helper with reload + stale-response protection
export function useApi(fn, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null }); const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current; set((s) => ({ ...s, loading: true }));
    try { const data = await fn(); if (id === seq.current) set({ data, loading: false, error: null }); }
    catch (e) { if (id === seq.current) set({ data: null, loading: false, error: e }); }
  }, deps); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
export const useDebounced = (v, ms = 350) => { const [d, set] = useState(v); useEffect(() => { const t = setTimeout(() => set(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; };
export const useNow = (ms = 30000) => { const [n, set] = useState(Date.now()); useEffect(() => { const t = setInterval(() => set(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; };
