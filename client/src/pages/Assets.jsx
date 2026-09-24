import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Download, Search, Laptop, AppWindow } from 'lucide-react';
import api, { errMsg, download } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useApi, useDebounced, fmtD, money, label, inputDate } from '../utils';
import { Card, PageHead, Spinner, Empty, Pager, AssetBadge, Modal, Field, Badge } from '../components/ui';

const CATS = ['Laptop', 'Desktop', 'Monitor', 'Server', 'Network', 'Printer', 'Mobile', 'Peripheral', 'Subscription', 'License', 'Other'];
const soon = (d) => d && new Date(d) < new Date(Date.now() + 60 * 864e5);
const BLANK = { name: '', type: 'hardware', category: 'Laptop', brand: '', model: '', serialNumber: '', vendor: '', purchaseDate: '', purchaseCost: '', warrantyExpiry: '', licenseSeats: '', licenseExpiry: '', location: '', notes: '', assetTag: '' };

export default function Assets() {
  const { user, can } = useAuth(); const toast = useToast(); const manage = can('admin', 'asset_manager'), view = can('admin', 'manager', 'technician', 'asset_manager');
  const [f, setF] = useState({ q: '', status: '', type: '', expiring: '' }); const [page, setPage] = useState(1); const dq = useDebounced(f.q);
  useEffect(() => setPage(1), [dq, f.status, f.type, f.expiring]);
  const list = useApi(async () => (await api.get('/assets', { params: { ...f, q: dq, page, limit: 15 } })).data, [dq, f.status, f.type, f.expiring, page]);
  const vendors = useApi(async () => (can('employee', 'manager') ? [] : (await api.get('/vendors', { params: { limit: 100 } })).data.items), []);
  const [form, setForm] = useState(null); const [detail, setDetail] = useState(null); const [saving, setSaving] = useState(false);
  const openDetail = async (id) => setDetail((await api.get(`/assets/${id}`)).data);
  const save = async () => { setSaving(true); try { const b = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')); if (form._id) await api.put(`/assets/${form._id}`, b); else await api.post('/assets', b); toast.success('Asset saved'); setForm(null); list.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); } };
  const edit = (a) => setForm({ ...BLANK, ...a, vendor: a.vendor?._id || '', purchaseDate: inputDate(a.purchaseDate), warrantyExpiry: inputDate(a.warrantyExpiry), licenseExpiry: inputDate(a.licenseExpiry), purchaseCost: a.purchaseCost ?? '', licenseSeats: a.licenseSeats ?? '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (<>
    <PageHead title={can('employee', 'manager') ? 'My assets' : 'Assets'} sub={can('employee', 'manager') ? 'Devices and licences assigned to you.' : 'Hardware and software from procurement to retirement.'}>
      {view && <><button className="btn" onClick={() => download('/assets/export', { ...f, q: dq, format: 'csv' }, 'assets.csv')}><Download size={16} />CSV</button><button className="btn" onClick={() => download('/assets/export', { ...f, q: dq, format: 'pdf' }, 'assets.pdf')}><Download size={16} />PDF</button></>}
      {manage && <button className="btn primary" onClick={() => setForm({ ...BLANK })}><Plus size={16} />Register asset</button>}</PageHead>
    <Card flush>
      {view && <div className="toolbar"><div className="search" style={{ minWidth: 240 }}><Search size={15} /><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search tag, name, serial or brand" aria-label="Search assets" /></div>
        <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{['procurement', 'in_stock', 'assigned', 'in_repair', 'retired', 'disposed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Type"><option value="">Hardware and software</option><option value="hardware">Hardware</option><option value="software">Software</option></select>
        <button className={`chip ${f.expiring ? 'on' : ''}`} onClick={() => setF({ ...f, expiring: f.expiring ? '' : 'true' })}>Expiring in 60 days</button></div>}
      {list.loading && !list.data ? <Spinner /> : !list.data?.items.length ? <Empty title="No assets found" text={can('employee', 'manager') ? 'No devices are assigned to you yet.' : 'Adjust the filters or register a new asset.'} /> :
        <div className="table-wrap"><table><thead><tr><th>Tag</th><th>Asset</th><th>Category</th><th>Status</th><th>Assigned to</th><th>Warranty / licence</th>{view && <th>Cost</th>}</tr></thead>
          <tbody>{list.data.items.map((a) => { const end = a.type === 'software' ? a.licenseExpiry : a.warrantyExpiry; return <tr key={a._id} className="click" onClick={() => openDetail(a._id)}>
            <td className="mono">{a.assetTag}</td><td className="title-cell"><span className="row gap-sm">{a.type === 'software' ? <AppWindow size={15} color="var(--ai)" /> : <Laptop size={15} color="var(--primary)" />}{a.name}</span><div className="small muted">{[a.brand, a.model].filter(Boolean).join(' ') || (a.licenseSeats ? `${a.licenseSeats} seats` : '')}</div></td>
            <td>{a.category}</td><td><AssetBadge status={a.status} /></td><td>{a.assignedTo?.name || <span className="muted">-</span>}</td>
            <td>{end ? <span className={soon(end) && !['retired', 'disposed'].includes(a.status) ? 'sla warn' : ''}>{fmtD(end)}</span> : '-'}</td>{view && <td>{money(a.purchaseCost)}</td>}</tr>; })}</tbody></table></div>}
      {list.data && <Pager page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={setPage} />}
    </Card>

    <Modal open={!!form} wide title={form?._id ? 'Edit asset' : 'Register asset'} onClose={() => setForm(null)} footer={<><button className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>Save asset</button></>}>
      {form && <div className="grid g2">
        <Field label="Name"><input className="input" value={form.name} onChange={set('name')} required /></Field>
        <Field label="Asset tag" hint="Leave blank to auto-generate"><input className="input" value={form.assetTag} onChange={set('assetTag')} disabled={!!form._id} /></Field>
        <Field label="Type"><select className="select" value={form.type} onChange={set('type')}><option value="hardware">Hardware</option><option value="software">Software</option></select></Field>
        <Field label="Category"><select className="select" value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Brand"><input className="input" value={form.brand} onChange={set('brand')} /></Field><Field label="Model"><input className="input" value={form.model} onChange={set('model')} /></Field>
        <Field label="Serial number"><input className="input" value={form.serialNumber} onChange={set('serialNumber')} /></Field>
        <Field label="Vendor"><select className="select" value={form.vendor} onChange={set('vendor')}><option value="">None</option>{(vendors.data || []).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</select></Field>
        <Field label="Purchase date"><input className="input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} /></Field><Field label="Purchase cost (INR)"><input className="input" type="number" min="0" value={form.purchaseCost} onChange={set('purchaseCost')} /></Field>
        {form.type === 'hardware' ? <Field label="Warranty ends"><input className="input" type="date" value={form.warrantyExpiry} onChange={set('warrantyExpiry')} /></Field> : <><Field label="Licence seats"><input className="input" type="number" min="1" value={form.licenseSeats} onChange={set('licenseSeats')} /></Field><Field label="Licence ends"><input className="input" type="date" value={form.licenseExpiry} onChange={set('licenseExpiry')} /></Field></>}
        <Field label="Location"><input className="input" value={form.location} onChange={set('location')} /></Field>
        <div style={{ gridColumn: '1/-1' }}><Field label="Notes"><textarea className="textarea" value={form.notes} onChange={set('notes')} /></Field></div></div>}
    </Modal>
    {detail && <AssetDetail data={detail} manage={manage} canRepair={can('admin', 'asset_manager', 'technician')} onClose={() => setDetail(null)} onChanged={(a) => { setDetail((d) => ({ ...d, asset: a })); list.reload(); }} onEdit={() => { edit(detail.asset); setDetail(null); }} onDelete={async () => { if (!confirm('Delete this asset?')) return; try { await api.delete(`/assets/${detail.asset._id}`); toast.success('Deleted'); setDetail(null); list.reload(); } catch (e) { toast.error(errMsg(e)); } }} />}
  </>);
}

function AssetDetail({ data, manage, canRepair, onClose, onChanged, onEdit, onDelete }) {
  const { asset: a, tickets } = data; const toast = useToast(); const [mode, setMode] = useState(null); const [val, setVal] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const people = useApi(async () => (mode === 'assign' ? (await api.get('/users', { params: { limit: 200, active: true } })).data.items : []), [mode]);
  const stock = useApi(async () => (mode === 'replace' ? (await api.get('/assets', { params: { status: 'in_stock', type: a.type, limit: 100 } })).data.items : []), [mode]);
  const run = async (action, extra = {}) => { setBusy(true); try { const { data: n } = await api.post(`/assets/${a._id}/transition`, { action, note: note || undefined, ...extra }); toast.success('Asset updated'); setMode(null); setVal(''); setNote(''); onChanged(n); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const S = a.status; const btn = (l, fn, cls = '') => <button className={`btn sm ${cls}`} disabled={busy} onClick={fn}>{l}</button>;
  return (<Modal open wide title={`${a.assetTag} · ${a.name}`} onClose={onClose}>
    <div className="row wrap between mb"><div className="row wrap gap-sm"><AssetBadge status={S} /><Badge>{a.category}</Badge>{a.assignedTo && <Badge tone="blue">{a.assignedTo.name}</Badge>}</div>
      {manage && <div className="row"><button className="btn sm" onClick={onEdit}>Edit</button>{['procurement', 'disposed'].includes(S) && <button className="btn sm danger" onClick={onDelete}>Delete</button>}</div>}</div>
    <dl className="kv mb"><dt>Vendor</dt><dd>{a.vendor?.name || '-'}</dd><dt>Serial</dt><dd className="mono">{a.serialNumber || '-'}</dd><dt>Purchased</dt><dd>{fmtD(a.purchaseDate)} · {money(a.purchaseCost)}</dd><dt>{a.type === 'software' ? 'Licence' : 'Warranty'}</dt><dd>{fmtD(a.type === 'software' ? a.licenseExpiry : a.warrantyExpiry)}{a.licenseSeats ? ` · ${a.licenseSeats} seats` : ''}</dd><dt>Location</dt><dd>{a.location || '-'}</dd>{a.replacedBy && <><dt>Replaced by</dt><dd>{a.replacedBy.assetTag}</dd></>}{a.notes && <><dt>Notes</dt><dd>{a.notes}</dd></>}</dl>
    {canRepair && !['retired', 'disposed'].includes(S) && <div className="card mb"><div className="card-b"><b className="small">Lifecycle actions</b>
      <div className="row wrap" style={{ marginTop: 10 }}>
        {manage && S === 'procurement' && btn('Receive into stock', () => run('receive'), 'primary')}
        {manage && S === 'in_stock' && btn('Assign to user', () => setMode('assign'), 'primary')}
        {manage && S === 'assigned' && btn('Return to stock', () => run('unassign'))}
        {['assigned', 'in_stock'].includes(S) && btn('Send for repair', () => run('send_repair'))}
        {S === 'in_repair' && btn('Complete repair', () => run('complete_repair'), 'primary')}
        {manage && ['assigned', 'in_repair'].includes(S) && btn('Replace', () => setMode('replace'))}
        {manage && ['in_stock', 'assigned', 'in_repair'].includes(S) && btn('Retire', () => confirm('Retire this asset?') && run('retire'), 'danger')}</div>
      {mode === 'assign' && <div className="row mt" style={{ marginTop: 12 }}><select className="select" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Choose a person</option>{(people.data || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>{btn('Assign', () => run('assign', { assignedTo: val }), 'primary')}{btn('Cancel', () => setMode(null))}</div>}
      {mode === 'replace' && <div className="row mt" style={{ marginTop: 12 }}><select className="select" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Choose in-stock replacement</option>{(stock.data || []).map((u) => <option key={u._id} value={u._id}>{u.assetTag} · {u.name}</option>)}</select>{btn('Replace', () => run('replace', { replacementAssetId: val }), 'primary')}{btn('Cancel', () => setMode(null))}</div>}
      <input className="input" style={{ marginTop: 12 }} placeholder="Optional note for the history" value={note} onChange={(e) => setNote(e.target.value)} /></div></div>}
    {S === 'retired' && manage && <div className="mb">{btn('Mark as disposed', () => run('dispose'))}</div>}
    <h3 style={{ marginBottom: 8 }}>Lifecycle history</h3>
    <ul className="timeline">{[...(a.history || [])].reverse().map((h, i) => <li key={i}><div><b>{label(h.action)}</b>{h.to && <> {h.from ? `${label(h.from)} to ` : 'as '}{label(h.to)}</>}{h.note && <span className="muted"> · {h.note}</span>}</div><div className="small muted">{h.by?.name || 'System'} · {fmtD(h.at)}</div></li>)}</ul>
    {tickets.length > 0 && <><h3 style={{ margin: '8px 0' }}>Related tickets</h3>{tickets.map((t) => <div key={t._id} className="small"><Link to={`/tickets/${t._id}`}><span className="mono">{t.number}</span> {t.title}</Link></div>)}</>}
  </Modal>);
}
