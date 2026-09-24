import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { ROLE_LABEL } from '../utils';
import { Card, PageHead, Field, Badge, Avatar } from '../components/ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [p, setP] = useState({ name: user.name, phone: user.phone || '', jobTitle: user.jobTitle || '' });
  const [pw, setPw] = useState({ current: '', next: '' });

  const saveP = async (e) => {
    e.preventDefault();
    try {
      setUser((await api.put('/auth/profile', p)).data);
      toast.success('Profile updated');
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/password', pw);
      setPw({ current: '', next: '' });
      toast.success('Password changed');
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  return (
    <>
      <PageHead title="Your Profile" sub="Manage your account settings and security preferences." />
      
      <div className="profile-hero">
        <div className="profile-hero-cover"></div>
        <div className="profile-hero-content">
          <Avatar name={user.name} className="profile-avatar" />
          <div className="profile-hero-info">
            <h2>{user.name}</h2>
            <p className="profile-email">{user.email}</p>
            <div className="row gap-sm mt">
              <Badge tone="blue">{ROLE_LABEL[user.role]}</Badge>
              {user.department && <span className="small muted">{user.department.name}</span>}
              {user.jobTitle && <span className="small muted">• {user.jobTitle}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid g2 mt">
        <Card title="Personal Details" className="profile-card">
          <form onSubmit={saveP}>
            <Field label="Full name">
              <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required />
            </Field>
            <Field label="Job title">
              <input className="input" value={p.jobTitle} onChange={(e) => setP({ ...p, jobTitle: e.target.value })} />
            </Field>
            <Field label="Phone number">
              <input className="input" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
            </Field>
            <div className="profile-form-actions">
              <button className="btn primary">Save changes</button>
            </div>
          </form>
        </Card>

        <Card title="Security" className="profile-card">
          <form onSubmit={savePw}>
            <Field label="Current password">
              <input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
            </Field>
            <Field label="New password" hint="At least 8 characters">
              <input className="input" type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required autoComplete="new-password" />
            </Field>
            <div className="profile-form-actions">
              <button className="btn primary">Update password</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
