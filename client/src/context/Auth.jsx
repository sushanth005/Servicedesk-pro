import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(!!localStorage.getItem('sdp_token'));
  useEffect(() => { if (!localStorage.getItem('sdp_token')) return; api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.removeItem('sdp_token')).finally(() => setLoading(false)); }, []);
  const accept = ({ token, user }) => { localStorage.setItem('sdp_token', token); setUser(user); return user; };
  const login = useCallback(async (email, password) => accept((await api.post('/auth/login', { email, password })).data), []);
  const register = useCallback(async (body) => accept((await api.post('/auth/register', body)).data), []);
  const logout = useCallback(() => { localStorage.removeItem('sdp_token'); setUser(null); }, []);
  const can = useCallback((...roles) => !!user && roles.includes(user.role), [user]);
  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout, can }}>{children}</Ctx.Provider>;
}
