import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Download, Save, Trash2, Search, X, Filter } from 'lucide-react';
import api, { errMsg, download } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useApi, useDebounced, fmtDT, STAFF } from '../utils';
import { Card, PageHead, Spinner, Empty, Pager, StatusBadge, PriorityBadge, SlaTimer, Avatar } from '../components/ui';

const STATUSES = ['new', 'assigned', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'];
const KEYS = ['q', 'status', 'priority', 'category', 'assignee', 'department', 'breached', 'unassigned', 'mine', 'open', 'sort'];

export default function Tickets() {
  const { user, can } = useAuth(); const toast = useToast(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const filters = Object.fromEntries(KEYS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k)])); const page = +sp.get('page') || 1;
  const [q, setQ] = useState(sp.get('q') || ''); const dq = useDebounced(q);
  const update = (patch) => { const n = { ...filters, ...patch }; Object.keys(n).forEach((k) => !n[k] && delete n[k]); setSp(n.page ? n : { ...n }); };
  useEffect(() => { if ((sp.get('q') || '') !== dq) update({ q: dq, page: undefined }); }, [dq]); // eslint-disable-line
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp.get('q')]); // eslint-disable-line
  const lookups = useApi(async () => { const [p, c, u, s] = await Promise.all([api.get('/priorities'), api.get('/categories', { params: { limit: 100 } }), STAFF.includes(user.role) ? api.get('/users', { params: { role: 'technician', limit: 100 } }) : { data: { items: [] } }, api.get('/saved-filters')]); return { pri: p.data.items, cat: c.data.items, tech: u.data.items, saved: s.data }; }, []);
  const list = useApi(async () => (await api.get('/tickets', { params: { ...filters, page, limit: 15 } })).data, [sp.toString()]);
  const L = lookups.data || { pri: [], cat: [], tech: [], saved: [] };
  const saveFilter = async () => { const name = prompt('Name this filter'); if (!name) return; try { await api.post('/saved-filters', { name, query: filters }); toast.success('Filter saved'); lookups.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const delFilter = async (id) => { await api.delete(`/saved-filters/${id}`); lookups.reload(); };
  const exp = (format) => download('/tickets/export', { ...filters, format }, `tickets.${format}`).catch((e) => toast.error(errMsg(e)));
  const active = Object.keys(filters).filter((k) => k !== 'sort').length;
  const chip = (k, v, l) => <button className={`chip ${filters[k] === v ? 'on' : ''}`} onClick={() => update({ [k]: filters[k] === v ? undefined : v, page: undefined })}>{l}</button>;

  return (<>
    <PageHead title={can('employee') ? 'My tickets' : 'Tickets'} sub={can('employee') ? 'Everything you have raised and where it stands.' : 'Search, filter and work the queue.'}>
      {STAFF.includes(user.role) && <><button className="btn" onClick={() => exp('csv')}><Download size={16} />CSV</button><button className="btn" onClick={() => exp('pdf')}><Download size={16} />PDF</button></>}
      <Link to="/tickets/new" className="btn primary">New ticket</Link></PageHead>
    <Card flush>
      <div className="toolbar">
        <div className="search" style={{ minWidth: 240 }}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, description or TKT-1001" aria-label="Search tickets" /></div>
        <select className="select" value={filters.status || ''} onChange={(e) => update({ status: e.target.value, page: undefined })} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        <select className="select" value={filters.priority || ''} onChange={(e) => update({ priority: e.target.value, page: undefined })} aria-label="Priority"><option value="">All priorities</option>{L.pri.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        <select className="select" value={filters.category || ''} onChange={(e) => update({ category: e.target.value, page: undefined })} aria-label="Category"><option value="">All categories</option>{L.cat.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        {STAFF.includes(user.role) && <select className="select" value={filters.assignee || ''} onChange={(e) => update({ assignee: e.target.value, page: undefined })} aria-label="Assignee"><option value="">Any assignee</option>{L.tech.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>}
        <select className="select" value={filters.sort || ''} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort"><option value="">Newest first</option><option value="oldest">Oldest first</option><option value="updated">Recently updated</option><option value="due">SLA due soonest</option></select>
      </div>
      <div className="toolbar" style={{ background: 'var(--surface-2)' }}>
        <Filter size={15} color="var(--muted)" />{chip('open', 'true', 'Open only')}{STAFF.includes(user.role) && <>{chip('breached', 'true', 'SLA breached')}{chip('unassigned', 'true', 'Unassigned')}{user.role === 'technician' && chip('mine', 'true', 'Assigned to me')}</>}
        {L.saved.map((s) => <span key={s._id} className="chip" onClick={() => setSp(s.query)}>{s.name}<X size={12} onClick={(e) => { e.stopPropagation(); delFilter(s._id); }} aria-label="Delete saved filter" /></span>)}
        <div className="grow" />{active > 0 && <><button className="btn sm ghost" onClick={() => { setSp({}); setQ(''); }}>Clear</button><button className="btn sm" onClick={saveFilter}><Save size={14} />Save filter</button></>}
      </div>
      {list.loading && !list.data ? <Spinner /> : !list.data?.items.length ? <Empty title="No tickets match" text={active ? 'Try clearing a filter.' : 'Nothing has been raised yet.'} /> :
        <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Title</th><th>Status</th><th>Priority</th><th>{can('employee') ? 'Category' : 'Requester'}</th><th>Assignee</th><th>SLA</th><th>Created</th></tr></thead>
          <tbody>{list.data.items.map((t) => <tr key={t._id} className="click" onClick={() => nav(`/tickets/${t._id}`)}>
            <td className="mono">{t.number}</td><td className="title-cell"><div className="clip" style={{ maxWidth: 380 }}>{t.title}</div><div className="small muted">{t.category?.name}</div></td><td><StatusBadge status={t.status} /></td><td><PriorityBadge priority={t.priority} /></td>
            <td>{can('employee') ? t.category?.name : <span className="row gap-sm"><Avatar sm name={t.requester?.name} />{t.requester?.name}</span>}</td>
            <td>{t.assignee ? <span className="row gap-sm"><Avatar sm name={t.assignee.name} />{t.assignee.name}</span> : <span className="muted">Unassigned</span>}</td>
            <td>{['resolved', 'closed'].includes(t.status) ? <SlaTimer due={t.sla?.resolutionDue} done={t.resolvedAt} breached={t.sla?.resolutionBreached} /> : <SlaTimer due={t.sla?.resolutionDue} breached={t.sla?.resolutionBreached} paused={t.status === 'on_hold'} />}</td>
            <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDT(t.createdAt)}</td></tr>)}</tbody></table></div>}
      {list.data && <Pager page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={(p) => update({ page: String(p) })} />}
    </Card></>);
}
