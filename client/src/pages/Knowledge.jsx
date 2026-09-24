import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ThumbsUp, ThumbsDown, Eye, Pencil, Trash2 } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useApi, useDebounced, fmtD, STAFF } from '../utils';
import { Card, PageHead, Spinner, Empty, Pager, Badge, Modal, Field } from '../components/ui';

export default function Knowledge() {
  const { user, can } = useAuth(); const toast = useToast(); const [sp, setSp] = useSearchParams(); const staff = STAFF.includes(user.role);
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
  useEffect(() => setPage(1), [dq, cat, status]);
  const cats = useApi(async () => (await api.get('/categories', { params: { limit: 100 } })).data.items, []);
  const list = useApi(async () => (await api.get('/articles', { params: { q: dq, category: cat, status, page, limit: 12 } })).data, [dq, cat, status, page]);
  const [article, setArticle] = useState(null); const [edit, setEdit] = useState(null); const [voted, setVoted] = useState(false);
  const open = async (id) => { try { setVoted(false); setArticle((await api.get(`/articles/${id}`)).data); } catch (e) { toast.error(errMsg(e)); } };
  useEffect(() => { const id = sp.get('open'); if (id) { open(id); setSp({}, { replace: true }); } }, []); // eslint-disable-line
  const vote = async (helpful) => { await api.post(`/articles/${article._id}/feedback`, { helpful }); setVoted(true); toast.success('Thanks for the feedback'); };
  const save = async () => { try { const b = { title: edit.title, body: edit.body, category: edit.category || undefined, tags: edit.tags, status: edit.status }; if (edit._id) await api.put(`/articles/${edit._id}`, b); else await api.post('/articles', b); toast.success(user.role === 'technician' ? 'Saved as draft for manager review' : 'Article saved'); setEdit(null); list.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async () => { if (!confirm('Delete this article?')) return; await api.delete(`/articles/${article._id}`); setArticle(null); list.reload(); };
  const canEdit = (a) => can('admin', 'manager') || (user.role === 'technician' && a.author?._id === user._id);

  return (<>
    <PageHead title="Knowledge base" sub="Fixes and how-tos written by the IT team. The AI draws on these when suggesting solutions.">{staff && <button className="btn primary" onClick={() => setEdit({ title: '', body: '', category: '', tags: '', status: 'published' })}><Plus size={16} />New article</button>}</PageHead>
    <div className="row wrap mb"><div className="search" style={{ maxWidth: 380 }}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by problem, tag or keyword" aria-label="Search articles" /></div>
      <select className="select" style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{(cats.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
      {staff && <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option></select>}</div>
    {list.loading && !list.data ? <Spinner /> : !list.data?.items.length ? <Card><Empty title="No articles found" text="Try different keywords." /></Card> : <>
      <div className="grid g3">{list.data.items.map((a) => <button key={a._id} className="card card-b" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => open(a._id)}>
        <div className="row between gap-sm"><Badge tone="blue">{a.category?.name || 'General'}</Badge>{a.status === 'draft' && <Badge tone="amber">Draft</Badge>}</div>
        <h3 style={{ margin: '10px 0 6px' }}>{a.title}</h3><div className="row wrap gap-sm">{(a.tags || []).slice(0, 4).map((t) => <span key={t} className="small muted">#{t}</span>)}</div>
        <div className="row gap-sm small muted" style={{ marginTop: 12 }}><Eye size={13} />{a.views}<ThumbsUp size={13} style={{ marginLeft: 8 }} />{a.helpful}<span style={{ marginLeft: 'auto' }}>{fmtD(a.updatedAt)}</span></div></button>)}</div>
      <Card flush className="mt"><Pager page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={setPage} /></Card></>}

    <Modal open={!!article} wide title={article?.title || ''} onClose={() => setArticle(null)} footer={article && canEdit(article) && <><button className="btn danger" onClick={del} style={{ marginRight: 'auto', display: can('admin', 'manager') ? '' : 'none' }}><Trash2 size={15} />Delete</button><button className="btn" onClick={() => { setEdit({ ...article, category: article.category?._id || '', tags: (article.tags || []).join(', ') }); setArticle(null); }}><Pencil size={15} />Edit</button></>}>
      {article && <><div className="row wrap gap-sm mb"><Badge tone="blue">{article.category?.name || 'General'}</Badge>{article.status === 'draft' && <Badge tone="amber">Draft</Badge>}<span className="small muted">By {article.author?.name} · Updated {fmtD(article.updatedAt)}</span></div>
        <div className="pre" style={{ lineHeight: 1.65 }}>{article.body}</div>
        {article.status === 'published' && <div className="row mt" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}><span className="muted small">Did this solve your problem?</span><button className="btn sm" disabled={voted} onClick={() => vote(true)}><ThumbsUp size={14} />Yes</button><button className="btn sm" disabled={voted} onClick={() => vote(false)}><ThumbsDown size={14} />No</button></div>}</>}
    </Modal>
    <Modal open={!!edit} wide title={edit?._id ? 'Edit article' : 'New article'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save article</button></>}>
      {edit && <><Field label="Title"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
        <div className="grid g2"><Field label="Category"><select className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}><option value="">General</option>{(cats.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
          <Field label="Status" hint={user.role === 'technician' ? 'Technician articles are saved as drafts until a manager publishes them.' : undefined}><select className="select" value={edit.status} disabled={user.role === 'technician'} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="published">Published</option><option value="draft">Draft</option></select></Field></div>
        <Field label="Tags" hint="Comma separated. Tags improve AI matching."><input className="input" value={Array.isArray(edit.tags) ? edit.tags.join(', ') : edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} /></Field>
        <Field label="Content" hint="Use numbered steps (1. 2. 3.). The AI extracts them as quick fixes."><textarea className="textarea" style={{ minHeight: 240 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field></>}
    </Modal></>);
}
