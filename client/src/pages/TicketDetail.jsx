import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Sparkles, Paperclip, Lock, Send, CheckCircle2, RotateCcw, UserPlus, Wand2, ArrowUpCircle, Clock, Trash2, BookPlus, ThumbsUp, ThumbsDown, PauseCircle, PlayCircle } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useApi, fmtDT, ago, label, STAFF, bytes } from '../utils';
import { Card, Spinner, Avatar, Badge, StatusBadge, PriorityBadge, SlaTimer, Modal, Field, Tabs, Empty } from '../components/ui';

const NEXT = { new: ['in_progress', 'on_hold'], assigned: ['in_progress', 'on_hold'], in_progress: ['on_hold'], on_hold: ['in_progress'], reopened: ['in_progress', 'on_hold'], resolved: [], closed: [] };

export default function TicketDetail() {
  const { id } = useParams(); const { user, can } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const staff = STAFF.includes(user.role), lead = can('admin', 'manager');
  const { data, loading, reload } = useApi(async () => (await api.get(`/tickets/${id}`)).data, [id]);
  const lookups = useApi(async () => { const [p, c, t] = await Promise.all([api.get('/priorities'), api.get('/categories', { params: { limit: 100 } }), staff ? api.get('/users', { params: { limit: 100 } }) : { data: { items: [] } }]); return { pri: p.data.items, cat: c.data.items, staffUsers: t.data.items.filter((u) => ['technician', 'manager', 'admin'].includes(u.role)) }; }, []);
  const ai = useApi(async () => (staff ? (await api.get(`/tickets/${id}/suggestions`)).data : null), [id]);
  const [tab, setTab] = useState('conversation'); const [body, setBody] = useState(''); const [internal, setInternal] = useState(false); const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null); const [dlgText, setDlgText] = useState(''); const [dlgArticle, setDlgArticle] = useState('');
  const [wl, setWl] = useState({ minutes: '', description: '' });
  if (loading && !data) return <Spinner />; if (!data) return <Empty title="Ticket not found" text="It may have been removed, or you may not have access." action={<Link to="/tickets" className="btn sm">Back to tickets</Link>} />;
  const { ticket: t, comments, worklogs } = data; const L = lookups.data || { pri: [], cat: [], staffUsers: [] };
  const isReq = t.requester?._id === user._id, open = !['resolved', 'closed'].includes(t.status), pending = t.approval?.status === 'pending';
  const mine = t.assignee?._id === user._id, canWork = staff && (lead || !t.assignee || mine);
  const act = async (fn, ok) => { setBusy(true); try { const r = await fn(); if (ok) toast.success(ok); reload(); return r; } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const post = (path, payload, ok) => act(() => api.post(`/tickets/${id}/${path}`, payload), ok);

  const send = async (e) => { e.preventDefault(); if (!body.trim()) return; const r = await act(() => api.post(`/tickets/${id}/comments`, { body, internal })); if (r) setBody(''); };
  const upload = async (e) => { const fd = new FormData(); [...e.target.files].forEach((f) => fd.append('files', f)); e.target.value = ''; act(() => api.post(`/tickets/${id}/attachments`, fd), 'Attached'); };
  const openFile = async (a) => { try { const r = await api.get(`/tickets/${id}/attachments/${a._id}`, { responseType: 'blob' }); const u = URL.createObjectURL(r.data); const l = document.createElement('a'); l.href = u; l.download = a.originalName; l.click(); URL.revokeObjectURL(u); } catch (x) { toast.error(errMsg(x)); } };
  const submitDlg = async () => {
    const m = { resolve: () => post('status', { status: 'resolved', summary: dlgText, article: dlgArticle || undefined }, 'Marked as resolved'), reopen: () => post('reopen', { reason: dlgText }, 'Ticket reopened'), escalate: () => post('escalate', { reason: dlgText }, lead ? 'Escalated' : 'Escalation requested'), hold: () => post('status', { status: 'on_hold', note: dlgText }, 'Put on hold'), reject: () => post('approval', { decision: 'rejected', note: dlgText }, 'Rejected') };
    await m[dlg](); setDlg(null); setDlgText(''); setDlgArticle('');
  };
  const addLog = async (e) => { e.preventDefault(); const r = await act(() => api.post(`/tickets/${id}/worklogs`, wl), 'Time logged'); if (r) setWl({ minutes: '', description: '' }); };
  const makeArticle = async () => { const r = await act(() => api.post(`/articles/from-ticket/${id}`), 'Draft article created in the knowledge base'); if (r) nav('/knowledge'); };
  const insertReply = (text) => { setInternal(false); setBody((b) => (b ? `${b}\n\n${text}` : text)); setTab('conversation'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cls = t.aiClassification;

  return (<>
    <div className="row wrap mb" style={{ alignItems: 'flex-start' }}>
      <div className="grow"><div className="row wrap gap-sm"><span className="mono muted">{t.number}</span><StatusBadge status={t.status} />{t.type === 'request' && <Badge tone="teal">Request</Badge>}{pending && <Badge tone="amber">Awaiting approval</Badge>}{t.reopenCount > 0 && <Badge tone="red">Reopened {t.reopenCount}x</Badge>}</div>
        <h1 style={{ marginTop: 6 }}>{t.title}</h1><div className="small muted">Raised by {t.requester?.name} in {t.department?.name || 'no department'} · {fmtDT(t.createdAt)}</div></div>
      <div className="row wrap">
        {isReq && t.status === 'resolved' && <button className="btn primary" disabled={busy} onClick={() => post('confirm', {}, 'Thanks for confirming')}><CheckCircle2 size={16} />Confirm it is fixed</button>}
        {(isReq || lead) && ['resolved', 'closed'].includes(t.status) && <button className="btn" onClick={() => setDlg('reopen')}><RotateCcw size={16} />Reopen</button>}
        {staff && open && <button className="btn" onClick={() => setDlg('escalate')}><ArrowUpCircle size={16} />{lead ? 'Escalate' : 'Request escalation'}</button>}
        {canWork && open && !pending && t.status !== 'on_hold' && <button className="btn primary" onClick={() => setDlg('resolve')}><CheckCircle2 size={16} />Resolve</button>}
      </div></div>

    {pending && <div className="card mb" style={{ borderColor: '#f6dfa7', background: 'var(--warn-50)' }}><div className="card-b row between wrap"><div><b>This request needs manager approval before work can start.</b><div className="small muted">Category: {t.category?.name}</div></div>
      {lead ? <div className="row"><button className="btn danger" onClick={() => setDlg('reject')}>Reject</button><button className="btn primary" disabled={busy} onClick={() => post('approval', { decision: 'approved' }, 'Approved')}>Approve</button></div> : <Badge tone="amber">Pending</Badge>}</div></div>}
    {t.approval?.status && ['approved', 'rejected'].includes(t.approval.status) && <div className="small muted mb">Approval {t.approval.status} by {t.approval.approver?.name}{t.approval.note ? `: ${t.approval.note}` : ''}</div>}

    <div className="grid g-main">
      <div className="col">
        <Card><div className="pre">{t.description}</div>
          {t.attachments?.length > 0 && <div className="row wrap" style={{ marginTop: 14 }}>{t.attachments.map((a) => <button key={a._id} className="file" style={{ cursor: 'pointer' }} onClick={() => openFile(a)}><Paperclip size={13} />{a.originalName}<span className="muted small">{bytes(a.size)}</span></button>)}</div>}
          {open && <label className="btn sm mt" style={{ marginTop: 12 }}><Paperclip size={14} />Add attachment<input type="file" multiple hidden onChange={upload} /></label>}</Card>

        {t.resolution?.summary && <div className="card" style={{ borderColor: '#bfe3cb', background: 'var(--ok-50)' }}><div className="card-b"><div className="row between"><b style={{ color: 'var(--ok)' }}>Resolution</b>{staff && <button className="btn sm" onClick={makeArticle}><BookPlus size={14} />Create KB article</button>}</div><div className="pre" style={{ marginTop: 6 }}>{t.resolution.summary}</div><div className="small muted mt" style={{ marginTop: 8 }}>{t.resolution.resolvedBy?.name} · {fmtDT(t.resolution.resolvedAt)}{t.resolution.article && <> · Article: {t.resolution.article.title}</>}</div></div></div>}

        <Card flush>
          <div style={{ padding: '4px 16px 0' }}><Tabs value={tab} onChange={setTab} tabs={[['conversation', `Conversation (${comments.length})`], ...(staff ? [['worklogs', `Work logs (${worklogs.length})`]] : []), ['activity', 'History']]} /></div>
          <div className="card-b" style={{ paddingTop: 0 }}>
            {tab === 'conversation' && <>
              <div className="thread">{comments.length === 0 && <div className="muted small">No messages yet.</div>}{comments.map((c) => <div key={c._id} className={`msg ${c.author?._id === user._id ? 'mine' : ''} ${c.internal ? 'internal' : ''}`}><Avatar name={c.author?.name} /><div className="bubble"><div className="meta"><b>{c.author?.name}</b>{STAFF.includes(c.author?.role) && <Badge tone="blue">Staff</Badge>}{c.internal && <Badge tone="amber"><Lock size={11} />Internal note</Badge>}<span>{ago(c.createdAt)}</span></div><div className="pre">{c.body}</div></div></div>)}</div>
              {t.status !== 'closed' ? <form onSubmit={send} className="mt" style={{ marginTop: 16 }}>
                <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? 'Write an internal note. The requester will not see it.' : 'Write a reply...'} style={internal ? { background: 'var(--warn-50)' } : undefined} aria-label="Message" />
                <div className="row between" style={{ marginTop: 8 }}>{staff ? <label className="check"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /><Lock size={13} />Internal note</label> : <span />}<button className="btn primary" disabled={busy || !body.trim()}><Send size={15} />{internal ? 'Add note' : 'Send reply'}</button></div></form> : <div className="small muted mt" style={{ marginTop: 14 }}>This ticket is closed. Reopen it to continue the conversation.</div>}</>}
            {tab === 'worklogs' && staff && <>
              {worklogs.length ? <table><thead><tr><th>Technician</th><th>Work done</th><th>Time</th><th>Date</th><th /></tr></thead><tbody>{worklogs.map((w) => <tr key={w._id}><td>{w.technician?.name}</td><td>{w.description}</td><td>{w.minutes} min</td><td className="small muted">{fmtDT(w.date)}</td><td>{(w.technician?._id === user._id || user.role === 'admin') && <button className="btn sm ghost icon" aria-label="Delete work log" onClick={() => act(() => api.delete(`/tickets/${id}/worklogs/${w._id}`))}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table> : <div className="muted small">No time logged yet.</div>}
              {canWork && open && <form onSubmit={addLog} className="row wrap" style={{ marginTop: 14, alignItems: 'flex-end' }}><Field label="Minutes"><input className="input" type="number" min="1" max="1440" style={{ width: 100 }} value={wl.minutes} onChange={(e) => setWl({ ...wl, minutes: e.target.value })} required /></Field><div className="grow"><Field label="What did you do?"><input className="input" value={wl.description} onChange={(e) => setWl({ ...wl, description: e.target.value })} required minLength={3} /></Field></div><button className="btn primary" style={{ marginBottom: 14 }} disabled={busy}>Log time</button></form>}
              <div className="small muted">Total logged: <b>{worklogs.reduce((n, w) => n + w.minutes, 0)} min</b></div></>}
            {tab === 'activity' && <ul className="timeline" style={{ marginTop: 6 }}>{[...t.activity].reverse().map((a, i) => <li key={i}><div>{a.detail || label(a.action)}</div><div className="small muted">{a.by?.name || 'System'} · {fmtDT(a.at)}</div></li>)}</ul>}
          </div></Card>
      </div>

      <aside className="col">
        <Card title="Details"><dl className="kv">
          <dt>Priority</dt><dd>{staff && open ? <select className="select" value={t.priority?._id || ''} onChange={(e) => act(() => api.put(`/tickets/${id}`, { priority: e.target.value }), 'Priority updated')} disabled={!canWork}>{L.pri.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select> : <PriorityBadge priority={t.priority} />}</dd>
          <dt>Category</dt><dd>{staff && open ? <select className="select" value={t.category?._id || ''} onChange={(e) => act(() => api.put(`/tickets/${id}`, { category: e.target.value }), 'Category updated')} disabled={!canWork}>{L.cat.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select> : t.category?.name}</dd>
          <dt>Assignee</dt><dd>{lead && open ? <div className="row gap-sm"><select className="select" value={t.assignee?._id || ''} onChange={(e) => post('assign', { assignee: e.target.value || null }, 'Assignment updated')}><option value="">Unassigned</option>{L.staffUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select><button className="btn sm icon" title="Auto-assign by workload and skills" aria-label="Auto-assign" onClick={() => post('auto-assign', {}, 'Assigned')}><Wand2 size={15} /></button></div> : t.assignee ? <span className="row gap-sm"><Avatar sm name={t.assignee.name} />{t.assignee.name}</span> : <span className="row gap-sm"><span className="muted">Unassigned</span>{user.role === 'technician' && open && <button className="btn sm" onClick={() => post('assign', { assignee: user._id }, 'Ticket assigned to you')}><UserPlus size={14} />Take it</button>}</span>}</dd>
          <dt>Requester</dt><dd>{t.requester?.name}<div className="small muted">{t.requester?.email}</div></dd>
          <dt>Department</dt><dd>{t.department?.name || '-'}</dd>
          {t.asset && <><dt>Asset</dt><dd><Link to="/assets">{t.asset.assetTag}</Link> <span className="muted small">{t.asset.name}</span></dd></>}
          <dt>Updated</dt><dd>{ago(t.updatedAt)}</dd></dl>
          {staff && canWork && NEXT[t.status]?.length > 0 && !pending && <div className="row wrap" style={{ marginTop: 14 }}>
            {NEXT[t.status].map((s) => s === 'on_hold' ? <button key={s} className="btn sm" onClick={() => setDlg('hold')}><PauseCircle size={14} />Put on hold</button> : <button key={s} className="btn sm" disabled={busy} onClick={() => post('status', { status: s }, `Status: ${label(s)}`)}><PlayCircle size={14} />{t.status === 'on_hold' ? 'Resume work' : 'Start work'}</button>)}</div>}
        </Card>

        <Card title="SLA"><div className="col" style={{ gap: 12 }}>
          <div className="row between"><span className="muted small">First response</span><SlaTimer due={t.sla?.responseDue} done={t.sla?.respondedAt} breached={t.sla?.responseBreached} paused={t.status === 'on_hold'} /></div>
          <div className="small muted" style={{ marginTop: -8 }}>Due {fmtDT(t.sla?.responseDue)}</div>
          <div className="row between"><span className="muted small">Resolution</span><SlaTimer due={t.sla?.resolutionDue} done={t.resolvedAt} breached={t.sla?.resolutionBreached} paused={t.status === 'on_hold'} /></div>
          <div className="small muted" style={{ marginTop: -8 }}>Due {fmtDT(t.sla?.resolutionDue)}</div>
          {t.sla?.policy && <div className="small muted">Policy: {t.sla.policy.name} {t.sla.policy.useBusinessHours ? '(business hours)' : '(24x7)'}</div>}
          {t.sla?.escalationLevel > 0 && <Badge tone="amber">Escalation level {t.sla.escalationLevel}</Badge>}</div></Card>

        {staff && <div className="ai-panel"><div className="card-h"><span className="ai-title"><Sparkles size={17} />AI insights</span><button className="btn ai sm" disabled={busy} onClick={() => act(() => api.post(`/tickets/${id}/classify`), 'Re-analysed').then(() => ai.reload())}>Re-analyse</button></div>
          <div className="card-b col" style={{ gap: 12 }}>
            {cls?.probableIssue ? <div className="col" style={{ gap: 6 }}><div className="row wrap gap-sm"><Badge tone="violet">{cls.category}</Badge><Badge tone="blue">{cls.priority}</Badge><span className="small muted">{Math.round((cls.confidence || 0) * 100)}%</span></div><div className="small"><b>Probable issue:</b> {cls.probableIssue}</div><div className="small muted">{cls.reasoning}</div>
              {(cls.category !== t.category?.name || cls.priority !== t.priority?.name) && canWork && <button className="btn ai sm" onClick={() => act(() => api.post(`/tickets/${id}/classify?apply=true`), 'AI classification applied')}>Apply AI category and priority</button>}</div> : <div className="small muted">No classification yet.</div>}
            <div style={{ borderTop: '1px solid var(--ai-100)', paddingTop: 12 }}><b className="small">Suggested solutions</b>
              {ai.loading ? <div className="small muted">Searching the knowledge base...</div> : !ai.data?.suggestions?.length ? <div className="small muted" style={{ marginTop: 4 }}>No matching articles. Resolve it, then create one from the resolution.</div> :
                <div className="col" style={{ gap: 8, marginTop: 8 }}>{ai.data.suggestions.slice(0, 3).map((s) => <div className="sugg" key={s.article._id}><div className="row between"><Link to={`/knowledge?open=${s.article._id}`}><b className="small">{s.article.title}</b></Link><Badge tone="violet">{Math.round(s.relevance * 100)}%</Badge></div><div className="small muted">{s.reason}</div>
                  {s.steps.length > 0 && <ol className="steps">{s.steps.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ol>}
                  {canWork && open && <button className="btn sm mt" style={{ marginTop: 8 }} onClick={() => insertReply(`Hi ${t.requester?.name.split(' ')[0]}, please try the following:\n${s.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}`)}>Use in reply</button>}</div>)}</div>}
              {ai.data?.suggestedReply && canWork && open && <div className="sugg" style={{ marginTop: 8 }}><div className="small muted">Draft reply</div><div className="small pre">{ai.data.suggestedReply}</div><button className="btn sm" style={{ marginTop: 8 }} onClick={() => insertReply(ai.data.suggestedReply)}>Use draft</button></div>}
              {ai.data?.similarTickets?.length > 0 && <div style={{ marginTop: 10 }}><div className="small muted">Similar resolved tickets</div>{ai.data.similarTickets.map((s) => <div key={s._id} className="small"><Link to={`/tickets/${s._id}`}><span className="mono">{s.number}</span> {s.title}</Link></div>)}</div>}
            </div></div></div>}
      </aside>
    </div>

    <Modal open={!!dlg} onClose={() => setDlg(null)} title={{ resolve: 'Resolve ticket', reopen: 'Reopen ticket', escalate: lead ? 'Escalate ticket' : 'Request escalation', hold: 'Put ticket on hold', reject: 'Reject request' }[dlg] || ''}
      footer={<><button className="btn" onClick={() => setDlg(null)}>Cancel</button><button className="btn primary" disabled={busy || dlgText.trim().length < (dlg === 'hold' ? 0 : 3)} onClick={submitDlg}>Confirm</button></>}>
      {dlg === 'resolve' && ai.data?.suggestions?.length > 0 && <Field label="Fixed using a knowledge article?"><select className="select" value={dlgArticle} onChange={(e) => { setDlgArticle(e.target.value); const s = ai.data.suggestions.find((x) => x.article._id === e.target.value); if (s && !dlgText) setDlgText(`Resolved by following "${s.article.title}": ${s.steps.join('; ')}`); }}><option value="">No article</option>{ai.data.suggestions.map((s) => <option key={s.article._id} value={s.article._id}>{s.article.title}</option>)}</select></Field>}
      <Field label={{ resolve: 'What fixed it?', reopen: 'Why is it not resolved?', escalate: 'Reason for escalation', hold: 'Waiting on what? (optional)', reject: 'Reason' }[dlg] || ''} hint={dlg === 'resolve' ? 'The requester sees this and is asked to confirm.' : undefined}><textarea className="textarea" value={dlgText} onChange={(e) => setDlgText(e.target.value)} autoFocus /></Field>
    </Modal></>);
}
