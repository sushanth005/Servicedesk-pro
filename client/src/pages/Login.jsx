import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sparkles, Timer, Package, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/Auth';
import { errMsg } from '../api';
import { Field } from '../components/ui';
import logoSrc from '../logo.png';

const DEMO = [
  ['Admin', 'admin@acme.com', 'Full system access'],
  ['IT Manager', 'manager@acme.com', 'Team oversight'],
  ['Technician', 'tech2@acme.com', 'Ticket handler'],
  ['Asset Mgr', 'assets@acme.com', 'Asset register'],
  ['Employee', 'employee1@acme.com', 'Raise tickets'],
];

const FEATURES = [
  { icon: Sparkles, title: 'AI-Powered Triage', desc: 'Tickets are categorised and prioritised the moment they arrive' },
  { icon: Timer, title: 'Smart SLA Timers', desc: 'Pause outside business hours, escalate automatically on breach' },
  { icon: Package, title: 'Asset Lifecycle', desc: 'From procurement to retirement, every device tracked' },
];

export default function Login() {
  const { user, login, register } = useAuth(); const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', orgCode: 'ACME' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { if (mode === 'login') await login(f.email, f.password); else await register(f); nav('/'); }
    catch (x) { setErr(errMsg(x)); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      {/* ── Left art panel ── */}
      <div className="auth-art">
        <div className="auth-art-content">
          {/* Logo */}
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <img src={logoSrc} alt="ServiceDesk Pro" />
            </div>
            <span className="auth-brand-name">ServiceDesk Pro</span>
          </div>

          {/* Headline */}
          <div className="auth-headline">
            <h1>IT support & assets,<br />handled with precision.</h1>
            <p>The all-in-one service desk built for modern IT teams — with AI triage, SLA enforcement, and full asset lifecycle management.</p>
          </div>

          {/* Feature pills */}
          <div className="auth-features">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="auth-feature">
                <div className="auth-feature-icon"><Icon size={18} /></div>
                <div>
                  <div className="auth-feature-title">{title}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div className="auth-trust">
            <CheckCircle size={14} />
            <span>Trusted by IT teams to keep operations running</span>
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <form className="auth-card" onSubmit={submit}>
          {/* Mode tabs */}
          <div className="auth-tabs">
            <button type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setErr(''); }}>Sign In</button>
            <button type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setErr(''); }}>Create Account</button>
          </div>

          <div className="auth-card-body">
            <div className="auth-card-title">
              <h2>{mode === 'login' ? 'Welcome back' : 'Get started'}</h2>
              <p>{mode === 'login' ? 'Enter your credentials to continue.' : 'Create your account to raise and track tickets.'}</p>
            </div>

            {err && <div className="auth-err" role="alert"><span>⚠</span>{err}</div>}

            {mode === 'register' && (
              <>
                <Field label="Full name">
                  <input className="input" value={f.name} onChange={set('name')} required placeholder="Jane Smith" />
                </Field>
                <Field label="Organisation code" hint="Ask your IT team. Demo org is ACME.">
                  <input className="input" value={f.orgCode} onChange={set('orgCode')} required />
                </Field>
              </>
            )}

            <Field label="Work email">
              <input className="input" type="email" value={f.email} onChange={set('email')}
                required autoComplete="username" placeholder="you@company.com" />
            </Field>

            <Field label="Password">
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} value={f.password}
                  onChange={set('password')} required minLength={mode === 'register' ? 8 : 1}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                  style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <button className="btn primary auth-submit" disabled={busy}>
              {busy ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="auth-spinner" />Please wait…
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowRight size={16} />
                </span>
              )}
            </button>

            {/* Demo quick-fill */}
            {mode === 'login' && (
              <div className="auth-demo">
                <div className="auth-demo-label">Quick demo login <span>(password: Password@123)</span></div>
                <div className="auth-demo-pills">
                  {DEMO.map(([lbl, email, role]) => (
                    <button key={email} type="button"
                      className={`auth-demo-pill ${f.email === email ? 'active' : ''}`}
                      onClick={() => setF({ ...f, email, password: 'Password@123' })}>
                      <span className="auth-demo-pill-name">{lbl}</span>
                      <span className="auth-demo-pill-role">{role}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer note */}
        <p className="auth-footer-note">
          {mode === 'login'
            ? <>Don't have an account? <button type="button" className="auth-switch" onClick={() => { setMode('register'); setErr(''); }}>Create one →</button></>
            : <>Already registered? <button type="button" className="auth-switch" onClick={() => { setMode('login'); setErr(''); }}>Sign in →</button></>}
        </p>
      </div>
    </div>
  );
}
