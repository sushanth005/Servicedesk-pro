import { Link, useNavigate } from 'react-router-dom';
import {
  Ticket, AlertTriangle, Users, Clock, CheckCircle2, Timer, Package,
  Wrench, ShieldCheck, Inbox, Gauge, Sparkles, TrendingUp, ArrowRight,
  Activity, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/Auth';
import { useApi, ago, label, ROLE_LABEL } from '../utils';
import { Card, Stat, Spinner, StatusBadge, PriorityBadge, SlaTimer, Empty, Meter } from '../components/ui';

const PALETTE = ['#2563eb', '#7c3aed', '#0891b2', '#d97706', '#dc2626', '#64748b', '#16a34a', '#0891b2'];
const STATUS_COLOR = { new: '#2563eb', assigned: '#7c3aed', in_progress: '#0891b2', on_hold: '#d97706', resolved: '#16a34a', closed: '#94a3b8', reopened: '#dc2626' };

const CustomTooltip = ({ active, payload, label: lbl }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-lg)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>{lbl}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--muted)' }}>{p.name}:</span>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, can } = useAuth(); const nav = useNavigate();
  const { data, loading } = useApi(async () => (await api.get('/reports/dashboard')).data, []);
  if (loading || !data) return <Spinner />;
  const c = data.counts, staff = can('admin', 'manager', 'technician'), lead = can('admin', 'manager');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greetIcon = hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙';

  const stats = can('employee') ? [
    { icon: Ticket, label: 'My Open Tickets', value: c.open, tone: '' },
    { icon: CheckCircle2, label: 'Awaiting Confirmation', value: c.awaiting, tone: 'green' },
    { icon: Clock, label: 'Resolved (30 days)', value: c.resolved30, tone: 'violet' },
    { icon: Package, label: 'My Assets', value: c.myAssets, tone: 'amber' },
  ] : can('technician') ? [
    { icon: Wrench, label: 'Assigned to Me', value: c.mineOpen, tone: '' },
    { icon: Inbox, label: 'Unassigned Queue', value: c.unassigned, tone: 'violet' },
    { icon: Timer, label: 'Due Within 4h', value: c.atRisk, tone: 'amber' },
    { icon: AlertTriangle, label: 'SLA Breached', value: c.breached, tone: 'red' },
  ] : can('asset_manager') ? [
    { icon: Package, label: 'Total Assets', value: data.assets?.total ?? 0, tone: '' },
    { icon: CheckCircle2, label: 'Assigned', value: data.assets?.assigned ?? 0, tone: 'green' },
    { icon: Wrench, label: 'In Repair', value: data.assets?.inRepair ?? 0, tone: 'amber' },
    { icon: AlertTriangle, label: 'Expiring Soon', value: (data.assets?.warrantyExpiring ?? 0) + (data.assets?.licenseExpiring ?? 0), tone: 'red' },
  ] : [
    { icon: Ticket, label: 'Open Tickets', value: c.open, tone: '' },
    { icon: Inbox, label: 'Unassigned', value: c.unassigned, tone: 'violet' },
    { icon: AlertTriangle, label: 'SLA Breached', value: c.breached, tone: 'red', sub: `${c.atRisk} due within 4h` },
    { icon: ShieldCheck, label: 'SLA Compliance', value: `${data.sla.resolutionCompliance}%`, tone: 'green', sub: data.sla.avgFirstResponseMin != null ? `Avg response ${data.sla.avgFirstResponseMin}m` : undefined },
  ];

  return (
    <>
      {/* ── Hero greeting banner ── */}
      <div className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <div className="dash-greeting-line">
              <span className="dash-greet-icon">{greetIcon}</span>
              <h1 className="dash-greeting">{greet}, {user.name.split(' ')[0]}!</h1>
            </div>
            <p className="dash-sub">
              {ROLE_LABEL[user.role]} · Here's your operational snapshot for today
            </p>
          </div>
          <div className="dash-hero-actions">
            <Link to="/tickets/new" className="btn primary dash-cta">
              <Zap size={16} /> New Ticket
            </Link>
            {can('admin', 'manager') && (
              <Link to="/reports" className="btn dash-cta-outline">
                <TrendingUp size={16} /> Reports
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="dash-stats">
        {stats.map((s, i) => (
          <div key={s.label} className={`dash-stat-card tone-${s.tone || 'blue'}`}>
            <div className={`dash-stat-icon tone-${s.tone || 'blue'}`}>
              <s.icon size={20} />
            </div>
            <div className="dash-stat-body">
              <div className="dash-stat-value">{s.value ?? '—'}</div>
              <div className="dash-stat-label">{s.label}</div>
              {s.sub && <div className="dash-stat-sub">{s.sub}</div>}
            </div>
            <div className="dash-stat-glow" />
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      {!can('asset_manager') && (
        <div className="grid g-wide mb">
          <Card title="Ticket Volume — Last 14 Days" actions={<span className="badge blue"><Activity size={11} />Live</span>}>
            <div style={{ height: 240, marginTop: 8 }}>
              <ResponsiveContainer>
                <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity=".2" />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11.5, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="created" name="Created" stroke="#2563eb" strokeWidth={2.5} fill="url(#gCreated)" dot={false} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2.5} fill="url(#gResolved)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Open by Priority">
            {data.byPriority.length ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                <div style={{ width: 160, height: 180, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.byPriority} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                        {data.byPriority.map((p) => <Cell key={p.name} fill={p.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {data.byPriority.map((p) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                        {p.name}
                      </span>
                      <b style={{ fontWeight: 600 }}>{p.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Empty title="Nothing open" text="No open tickets right now." />}
          </Card>
        </div>
      )}

      {/* ── Attention table + status bar chart ── */}
      {staff && (
        <div className="grid g-wide mb">
          <Card flush title={lead ? 'Needs Attention' : 'Due Soon or Breached'}
            actions={<Link to="/tickets?breached=true" className="small dash-link">View breached <ArrowRight size={12} /></Link>}>
            {data.attention.length ? (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {data.attention.map((t) => (
                      <tr key={t._id} className="click" onClick={() => nav(`/tickets/${t._id}`)}>
                        <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t.number}</td>
                        <td className="title-cell clip">{t.title}</td>
                        <td><PriorityBadge priority={t.priority} /></td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{t.assignee?.name || <span className="muted">Unassigned</span>}</td>
                        <td><SlaTimer due={t.sla?.resolutionDue} breached={t.sla?.resolutionBreached} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="All clear! 🎉" text="No tickets are close to breaching their SLA." />}
          </Card>

          <Card title="Open by Status">
            <div style={{ height: 220, marginTop: 4 }}>
              <ResponsiveContainer>
                <BarChart
                  data={data.byStatus.filter((s) => !['closed', 'resolved'].includes(s.status)).map((s) => ({ ...s, name: label(s.status) }))}
                  layout="vertical" margin={{ left: 10, right: 16 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                    {data.byStatus.filter((s) => !['closed', 'resolved'].includes(s.status)).map((s) => (
                      <Cell key={s.status} fill={STATUS_COLOR[s.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ── Workload + categories ── */}
      {lead && (
        <div className="grid g2 mb">
          <Card flush title="Technician Workload" actions={<Link to="/workload" className="small dash-link">Details <ArrowRight size={12} /></Link>}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Technician</th><th>Open</th><th>Breached</th><th style={{ width: 160 }}>Utilisation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workload.map((w) => (
                    <tr key={w._id}>
                      <td style={{ fontWeight: 500 }}>{w.name}</td>
                      <td>{w.open}</td>
                      <td>{w.breached ? <span className="badge red">{w.breached}</span> : <span className="muted">0</span>}</td>
                      <td>
                        <div className="row">
                          <div className="grow"><Meter pct={w.utilization} /></div>
                          <span className="small muted">{w.utilization}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Categories This Month">
            <div style={{ height: 220, marginTop: 4 }}>
              <ResponsiveContainer>
                <BarChart data={data.byCategory} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={54} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={22}>
                    {data.byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ── Asset summary ── */}
      {data.assets && can('admin', 'manager', 'asset_manager', 'technician') && (
        <div className="grid g2 mb">
          <Card title="Assets by Status" actions={<Link to="/assets" className="small dash-link">Open register <ArrowRight size={12} /></Link>}>
            <div className="dash-asset-grid">
              {data.assets.byStatus.map((s) => (
                <div key={s.status} className="dash-asset-stat">
                  <div className="dash-asset-val">{s.count}</div>
                  <div className="dash-asset-lbl">{label(s.status)}</div>
                </div>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 12 }}>
              {data.assets.active} active · {data.assets.warrantyExpiring} warranties expiring · {data.assets.licenseExpiring} licences expiring (60d)
            </div>
          </Card>
          <Card title="Active Assets by Category">
            <div style={{ height: 170, marginTop: 4 }}>
              <ResponsiveContainer>
                <BarChart data={data.assets.byCategory} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ── Recent tickets ── */}
      <Card flush title={can('employee') ? 'My Recent Tickets' : 'Recent Tickets'}
        actions={<Link to="/tickets" className="small dash-link">View all <ArrowRight size={12} /></Link>}>
        {data.recent.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Title</th><th>Status</th><th>Priority</th><th>Age</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((t) => (
                  <tr key={t._id} className="click" onClick={() => nav(`/tickets/${t._id}`)}>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t.number}</td>
                    <td className="title-cell clip" style={{ fontWeight: 500 }}>{t.title}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td className="muted small">{ago(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No tickets yet" text="Raise your first ticket and it will show up here."
            action={<Link to="/tickets/new" className="btn primary sm">New ticket</Link>} />
        )}
      </Card>
    </>
  );
}
