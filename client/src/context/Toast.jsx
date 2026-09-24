import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }) {
  const [items, set] = useState([]);
  const push = useCallback((message, type = 'info') => { const id = Math.random(); set((s) => [...s, { id, message, type }]); setTimeout(() => set((s) => s.filter((t) => t.id !== id)), 4500); }, []);
  const api = { success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m) };
  return (<Ctx.Provider value={api}>{children}
    <div className="toasts" role="status" aria-live="polite">{items.map((t) => (<div key={t.id} className={`toast ${t.type}`}>{t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}<span>{t.message}</span></div>))}</div>
  </Ctx.Provider>);
}
