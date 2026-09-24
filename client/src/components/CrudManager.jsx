import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import api, { errMsg } from '../api';
import { useToast } from '../context/Toast';
import { Modal, Field, Spinner, Empty, Pager, Card } from './ui';
import { useDebounced, inputDate } from '../utils';

const idv = (v) => (v && typeof v === 'object' && v._id ? v._id : v);
const initial = (fields, item) => Object.fromEntries(fields.map((f) => {
  let v = item ? item[f.name] : f.default;
  if (f.type === 'multiselect') v = (v || []).map(idv);
  else if (f.type === 'tags') v = (v || []).join(', ');
  else if (f.type === 'date') v = inputDate(v);
  else if (f.type === 'checkbox') v = v ?? true;
  else if (f.type === 'select') v = idv(v) ?? '';
  else v = v ?? '';
  return [f.name, v];
}));

// Generic list + create/edit modal. Field types: text email password number textarea select multiselect checkbox date color tags custom
export default function CrudManager({ title, endpoint, columns, fields, canWrite = true, canDelete = true, searchable = true, singular, extraParams, description }) {
  const toast = useToast();
  const [state, setState] = useState({ items: [], total: 0, pages: 1, loading: true }); const [page, setPage] = useState(1); const [q, setQ] = useState('');
  const dq = useDebounced(q); const [modal, setModal] = useState(null); const [form, setForm] = useState({}); const [saving, setSaving] = useState(false); const [look, setLook] = useState({});
  const load = useCallback(async () => { setState((s) => ({ ...s, loading: true })); try { const { data } = await api.get(endpoint, { params: { page, limit: 15, q: dq || undefined, ...extraParams } }); setState({ ...data, loading: false }); } catch (e) { toast.error(errMsg(e)); setState((s) => ({ ...s, loading: false })); } }, [endpoint, page, dq]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq]);
  useEffect(() => { fields.filter((f) => f.source).forEach((f) => api.get(`/${f.source}`, { params: { limit: 200 } }).then((r) => setLook((l) => ({ ...l, [f.source]: r.data.items })))); }, []); // eslint-disable-line
  const opts = (f) => (f.options || (look[f.source] || []).map((x) => ({ value: x._id, label: x.name })));
  const open = (item) => { setForm(initial(fields, item)); setModal({ item }); };
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const body = {}; const editing = modal.item;
      fields.forEach((f) => { if (f.createOnly && editing) return; let v = form[f.name];
        if (f.type === 'password' && !v) return; if (f.type === 'number') v = v === '' ? undefined : Number(v);
        if (f.type === 'tags') v = String(v).split(',').map((s) => s.trim()).filter(Boolean);
        body[f.name] = v; });
      if (editing) await api.put(`${endpoint}/${editing._id}`, body); else await api.post(endpoint, body);
      toast.success(`${singular || title} saved`); setModal(null); load();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const remove = async (item) => { if (!confirm(`Delete "${item.name || item.title}"? This cannot be undone.`)) return; try { await api.delete(`${endpoint}/${item._id}`); toast.success('Deleted'); load(); } catch (e) { toast.error(errMsg(e)); } };

  return (<Card flush title={title} actions={canWrite && <button className="btn primary sm" onClick={() => open(null)}><Plus size={15} />Add {singular || 'new'}</button>}>
    {description && <div className="small muted" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>{description}</div>}
    {searchable && <div className="toolbar"><div className="search" style={{ maxWidth: 320 }}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${title}`} /></div></div>}
    {state.loading && !state.items.length ? <Spinner /> : !state.items.length ? <Empty title={`No ${title.toLowerCase()} yet`} text={canWrite ? 'Add the first one to get started.' : 'Nothing to show.'} /> :
      <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{(canWrite || canDelete) && <th />}</tr></thead>
        <tbody>{state.items.map((it) => <tr key={it._id}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(it) : it[c.key] ?? '-'}</td>)}
          {(canWrite || canDelete) && <td className="right" style={{ whiteSpace: 'nowrap' }}>{canWrite && <button className="btn sm ghost icon" onClick={() => open(it)} aria-label="Edit"><Pencil size={15} /></button>}{canDelete && canWrite && <button className="btn sm ghost icon" onClick={() => remove(it)} aria-label="Delete"><Trash2 size={15} /></button>}</td>}</tr>)}</tbody></table></div>}
    {state.pages > 1 && <Pager page={page} pages={state.pages} total={state.total} onChange={setPage} />}
    <Modal open={!!modal} title={modal?.item ? `Edit ${singular || title}` : `Add ${singular || title}`} onClose={() => setModal(null)} wide={fields.some((f) => f.type === 'custom')}
      footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button></>}>
      {modal && fields.filter((f) => !(f.createOnly && modal.item)).map((f) => (<Field key={f.name} label={f.label} hint={f.type === 'password' && modal.item ? 'Leave blank to keep the current password' : f.hint}>
        {f.type === 'textarea' ? <textarea className="textarea" value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} />
        : f.type === 'select' ? <select className="select" value={form[f.name]} onChange={(e) => set(f.name, e.target.value)}><option value="">{f.required ? 'Select...' : 'None'}</option>{opts(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === 'multiselect' ? <div className="chips">{opts(f).map((o) => { const on = form[f.name].includes(o.value); return <button type="button" key={o.value} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set(f.name, on ? form[f.name].filter((x) => x !== o.value) : [...form[f.name], o.value])}>{o.label}</button>; })}</div>
        : f.type === 'checkbox' ? <label className="check"><input type="checkbox" checked={!!form[f.name]} onChange={(e) => set(f.name, e.target.checked)} />{f.checkLabel || 'Enabled'}</label>
        : f.type === 'custom' ? f.render({ value: form[f.name], onChange: (v) => set(f.name, v), lookups: look })
        : <input className="input" type={f.type === 'tags' ? 'text' : f.type || 'text'} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} step={f.type === 'number' ? 'any' : undefined} style={f.type === 'color' ? { padding: 3, width: 70 } : undefined} />}
      </Field>))}
    </Modal>
  </Card>);
}
