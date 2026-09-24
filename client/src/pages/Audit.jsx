import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import api, { download } from '../api';
import { useApi, useDebounced, fmtDT, ROLE_LABEL } from '../utils';
import { Card, PageHead, Spinner, Empty, Pager, Badge } from '../components/ui';
export default function Audit() {
  const [q, setQ] = useState(''); const [entity, setEntity] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
  const { data, loading } = useApi(async () => (await api.get('/audit', { params: { q: dq, entity, page } })).data, [dq, entity, page]);
  return (<><PageHead title="Audit trail" sub="Every change made in the system, who made it and when.">
    <button className="btn" onClick={() => download('/audit', { q: dq, entity, format: 'csv' }, 'audit-log.csv')}><Download size={16} />CSV</button><button className="btn" onClick={() => download('/audit', { q: dq, entity, format: 'pdf' }, 'audit-log.pdf')}><Download size={16} />PDF</button></PageHead>
    <Card flush><div className="toolbar"><div className="search" style={{ minWidth: 240 }}><Search size={15} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search user or action" aria-label="Search audit log" /></div>
      <select className="select" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Area"><option value="">All areas</option>{['auth', 'tickets', 'assets', 'articles', 'users', 'organizations', 'categories', 'priorities', 'sla-policies', 'departments', 'vendors', 'sla'].map((x) => <option key={x}>{x}</option>)}</select></div>
      {loading && !data ? <Spinner /> : !data?.items.length ? <Empty title="No activity found" text="Try a different search." /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Area</th><th>IP</th></tr></thead><tbody>{data.items.map((a) => <tr key={a._id}><td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDT(a.createdAt)}</td><td>{a.userName}</td><td><Badge>{ROLE_LABEL[a.role] || a.role}</Badge></td><td className="mono">{a.action}</td><td>{a.entity}</td><td className="small muted">{a.ip}</td></tr>)}</tbody></table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}</Card></>);
}
