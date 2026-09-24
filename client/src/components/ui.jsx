import { X, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { initials, label, dur, useNow } from '../utils';

export const Spinner = () => <div className="spinner" role="progressbar" aria-label="Loading" />;
export const Avatar = ({ name, sm, className = '' }) => <span className={`avatar ${sm ? 'sm' : ''} ${className}`} title={name}>{initials(name)}</span>;
export const Badge = ({ tone = 'gray', children }) => <span className={`badge ${tone}`}>{children}</span>;
export const Empty = ({ title, text, action }) => <div className="empty"><h3>{title}</h3><p>{text}</p>{action}</div>;

export function PageHead({ title, sub, children }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row wrap">{children}</div></div>;
}
export function Card({ title, actions, children, flush, className = '' }) {
  return <section className={`card ${className}`}>{(title || actions) && <div className="card-h"><h3>{title}</h3><div className="row gap-sm">{actions}</div></div>}<div className={`card-b ${flush ? 'flush' : ''}`}>{children}</div></section>;
}
export function Stat({ icon: Icon, label: l, value, tone = '', sub }) {
  return <div className="card stat"><div className={`ico ${tone}`}><Icon size={19} /></div><div><div className="v">{value}</div><div className="l">{l}</div>{sub && <div className="small muted">{sub}</div>}</div></div>;
}
export function Field({ label: l, hint, children }) { return <div className="field"><label>{l}</label>{children}{hint && <span className="hint">{hint}</span>}</div>; }

export function Modal({ open, title, onClose, children, footer, wide }) {
  if (!open) return null;
  return (<div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
    <div className={`modal ${wide ? 'wide' : ''}`}><div className="modal-h"><h2>{title}</h2><button className="btn ghost icon" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <div className="modal-b">{children}</div>{footer && <div className="modal-f">{footer}</div>}</div></div>);
}
export function Pager({ page, pages, total, onChange }) {
  return (<div className="pager"><span>{total} result{total === 1 ? '' : 's'}</span>
    <div className="row gap-sm"><button className="btn sm icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {pages}</span><button className="btn sm icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>);
}
export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={`tab ${value === k ? 'active' : ''}`} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

const STATUS_TONE = { new: 'blue', assigned: 'violet', in_progress: 'teal', on_hold: 'amber', resolved: 'green', closed: 'gray', reopened: 'red' };
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'gray'}>{label(status)}</Badge>;
export const PriorityBadge = ({ priority }) => priority ? <span className="row gap-sm" style={{ display: 'inline-flex' }}><i className="dot" style={{ background: priority.color || '#94a3b8' }} /><span>{priority.name}</span></span> : <span className="muted">-</span>;
const ASSET_TONE = { procurement: 'blue', in_stock: 'teal', assigned: 'green', in_repair: 'amber', retired: 'gray', disposed: 'gray' };
export const AssetBadge = ({ status }) => <Badge tone={ASSET_TONE[status] || 'gray'}>{label(status)}</Badge>;

// Live SLA countdown. `done` = date the milestone was met (or null while running).
export function SlaTimer({ due, done, breached, paused }) {
  const now = useNow();
  if (!due) return <span className="muted">No SLA</span>;
  if (done) { const late = new Date(done) > new Date(due) || breached; return <span className={`sla ${late ? 'bad' : 'done'}`}>{late ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{late ? 'Missed' : 'Met'}</span>; }
  if (paused) return <span className="sla done"><Clock size={14} />Paused</span>;
  const left = new Date(due) - now;
  if (left < 0) return <span className="sla bad"><AlertTriangle size={14} />Overdue {dur(left)}</span>;
  return <span className={`sla ${left < 3600000 * 2 ? 'warn' : 'ok'}`}><Clock size={14} />{dur(left)} left</span>;
}
export function Meter({ pct }) { const p = Math.max(0, Math.min(100, pct)); return <div className={`meter ${pct >= 100 ? 'bad' : pct >= 75 ? 'warn' : 'ok'}`}><i style={{ width: `${p}%` }} /></div>; }
