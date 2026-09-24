import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Paperclip, X, BookOpen } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useApi, useDebounced, STAFF, bytes } from '../utils';
import { Card, PageHead, Field, Badge } from '../components/ui';

export default function TicketNew() {
  const { user } = useAuth(); const toast = useToast(); const nav = useNavigate(); const staff = STAFF.includes(user.role);
  const [f, setF] = useState({ title: '', description: '', type: 'incident', category: '', priority: '', asset: '', requester: '', department: '' }); const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null); const [aiBusy, setAiBusy] = useState(false); const [kb, setKb] = useState(null); const fileRef = useRef(); const seq = useRef(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const look = useApi(async () => { const [c, p, a, u, d] = await Promise.all([api.get('/categories', { params: { limit: 100, active: true } }), api.get('/priorities'), api.get('/assets', { params: { limit: 200 } }), staff ? api.get('/users', { params: { limit: 200 } }) : { data: { items: [] } }, api.get('/departments', { params: { limit: 100 } })]); return { cat: c.data.items, pri: p.data.items, assets: a.data.items, users: u.data.items, deps: d.data.items }; }, []);
  const L = look.data || { cat: [], pri: [], assets: [], users: [], deps: [] };
  const text = useDebounced(`${f.title}\n${f.description}`, 900);

  const analyse = async (auto) => {
    if (f.title.trim().length + f.description.trim().length < 20) { if (!auto) toast.error('Add a little more detail so the AI can analyse it'); return; }
    const id = ++seq.current; setAiBusy(true);
    try {
      const [c, s] = await Promise.all([api.post('/ai/classify', { title: f.title, description: f.description }), api.post('/ai/suggest', { title: f.title, description: f.description })]);
      if (id === seq.current) { setAi(c.data); setKb(s.data); }
    } catch (e) { if (!auto) toast.error(errMsg(e)); } finally { if (id === seq.current) setAiBusy(false); }
  };
  useEffect(() => { if (f.title.trim().length >= 5 && f.description.trim().length >= 15) analyse(true); }, [text]); // eslint-disable-line
  const apply = () => setF({ ...f, category: ai.categoryId || f.category, priority: staff ? ai.priorityId || f.priority : f.priority });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(); Object.entries(f).forEach(([k, v]) => v && fd.append(k, v)); files.forEach((x) => fd.append('files', x));
      const { data } = await api.post('/tickets', fd); toast.success(`Ticket ${data.number} created`); nav(`/tickets/${data._id}`);
    } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const pick = (e) => { const add = [...e.target.files]; setFiles((cur) => [...cur, ...add].slice(0, 5)); e.target.value = ''; };

  return (<>
    <PageHead title="New ticket" sub="Describe the problem. Our AI reads it as you type and suggests the right category and possible fixes." />
    <div className="grid g-main">
      <form onSubmit={submit}><Card>
        <Field label="What is the problem?"><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. VPN disconnects every few minutes" required minLength={5} maxLength={200} /></Field>
        <Field label="Details" hint="What happened, when it started, any error text, what you already tried."><textarea className="textarea" style={{ minHeight: 140 }} value={f.description} onChange={set('description')} required minLength={10} /></Field>
        <div className="grid g2">
          <Field label="Category" hint={ai && !f.category ? 'Left blank, the AI suggestion will be used' : undefined}><select className="select" value={f.category} onChange={set('category')}><option value="">Let AI decide</option>{L.cat.map((c) => <option key={c._id} value={c._id}>{c.name}{c.requiresApproval ? ' (needs approval)' : ''}</option>)}</select></Field>
          {staff ? <Field label="Priority"><select className="select" value={f.priority} onChange={set('priority')}><option value="">Let AI decide</option>{L.pri.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
            : <Field label="Type"><select className="select" value={f.type} onChange={set('type')}><option value="incident">Something is broken</option><option value="request">I need something</option></select></Field>}
          {staff && <Field label="Raise on behalf of"><select className="select" value={f.requester} onChange={set('requester')}><option value="">Myself</option>{L.users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></Field>}
          <Field label="Related asset" hint="Optional"><select className="select" value={f.asset} onChange={set('asset')}><option value="">None</option>{L.assets.filter((a) => a.type === 'hardware' || staff).map((a) => <option key={a._id} value={a._id}>{a.assetTag} · {a.name}</option>)}</select></Field>
        </div>
        <Field label="Evidence" hint="Screenshots, logs or documents. Up to 5 files, 5 MB each.">
          <div className="dz" onClick={() => fileRef.current.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current.click()}><Paperclip size={16} style={{ verticalAlign: -3 }} /> Choose files</div>
          <input ref={fileRef} type="file" multiple hidden onChange={pick} />
          {files.length > 0 && <div className="row wrap mt" style={{ marginTop: 8 }}>{files.map((x, i) => <span key={i} className="file"><Paperclip size={13} />{x.name} <span className="muted small">{bytes(x.size)}</span><X size={13} style={{ cursor: 'pointer' }} onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove file" /></span>)}</div>}
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => nav(-1)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit ticket'}</button></div>
      </Card></form>

      <div className="col">
        <div className="ai-panel"><div className="card-h"><span className="ai-title"><Sparkles size={17} />AI assistant</span><button type="button" className="btn ai sm" disabled={aiBusy} onClick={() => analyse(false)}>{aiBusy ? 'Analysing...' : 'Analyse now'}</button></div>
          <div className="card-b">{!ai ? <p className="muted small" style={{ margin: 0 }}>Start describing the problem. I will suggest a category, priority and a likely cause.</p> : <div className="col" style={{ gap: 10 }}>
            <div className="row wrap gap-sm"><Badge tone="violet">{ai.category}</Badge>{staff && <Badge tone="blue">{ai.priority} priority</Badge>}<span className="small muted">{Math.round(ai.confidence * 100)}% confident</span></div>
            <div className="small"><b>Probable issue:</b> {ai.probableIssue}</div><div className="small muted">{ai.reasoning}</div>
            <div className="row"><button type="button" className="btn ai sm" onClick={apply}>Use this category{staff ? ' and priority' : ''}</button><span className="small muted">via {ai.source === 'groq' ? 'Groq' : 'built-in rules'}</span></div></div>}</div></div>
        {kb?.suggestions?.length > 0 && <Card title={<span className="row gap-sm"><BookOpen size={16} />Try these first</span>}><div className="col" style={{ gap: 10 }}>{kb.suggestions.slice(0, 3).map((s) => <div className="sugg" key={s.article._id}><Link to={`/knowledge?open=${s.article._id}`} target="_blank"><b>{s.article.title}</b></Link>{s.steps.length > 0 && <ol className="steps">{s.steps.slice(0, 3).map((st, i) => <li key={i}>{st}</li>)}</ol>}</div>)}<span className="small muted">These may fix it without waiting for a technician.</span></div></Card>}
      </div>
    </div></>);
}
