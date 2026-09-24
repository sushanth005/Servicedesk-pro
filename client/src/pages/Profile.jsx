import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { ROLE_LABEL } from '../utils';
import { Card, PageHead, Field, Badge, Avatar } from '../components/ui';
export default function Profile() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const [p, setP] = useState({ name: user.name, phone: user.phone || '', jobTitle: user.jobTitle || '' }); const [pw, setPw] = useState({ current: '', next: '' });
  const saveP = async (e) => { e.preventDefault(); try { setUser((await api.put('/auth/profile', p)).data); toast.success('Profile updated'); } catch (x) { toast.error(errMsg(x)); } };
  const savePw = async (e) => { e.preventDefault(); try { await api.put('/auth/password', pw); setPw({ current: '', next: '' }); toast.success('Password changed'); } catch (x) { toast.error(errMsg(x)); } };
  return (<><PageHead title="Your profile" /><div className="grid g2">
    <Card title="Details"><div className="row mb"><Avatar name={user.name} /><div><b>{user.email}</b><div className="row gap-sm"><Badge tone="blue">{ROLE_LABEL[user.role]}</Badge><span className="small muted">{user.department?.name}</span></div></div></div>
      <form onSubmit={saveP}><Field label="Full name"><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></Field><Field label="Job title"><input className="input" value={p.jobTitle} onChange={(e) => setP({ ...p, jobTitle: e.target.value })} /></Field><Field label="Phone"><input className="input" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field><button className="btn primary">Save changes</button></form></Card>
    <Card title="Change password"><form onSubmit={savePw}><Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></Field><Field label="New password" hint="At least 8 characters"><input className="input" type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required autoComplete="new-password" /></Field><button className="btn primary">Update password</button></form></Card></div></>);
}
