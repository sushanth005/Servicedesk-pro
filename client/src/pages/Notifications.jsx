import { Link } from 'react-router-dom';
import api from '../api';
import { useApi, ago } from '../utils';
import { Card, PageHead, Spinner, Empty } from '../components/ui';
const TONE = { danger: 'var(--bad)', warning: '#f08c00', success: 'var(--ok)', info: 'var(--primary)' };
export default function Notifications() {
  const { data, loading, reload } = useApi(async () => (await api.get('/notifications', { params: { limit: 100 } })).data, []);
  const readAll = async () => { await api.post('/notifications/read-all'); reload(); };
  return (<><PageHead title="Notifications" sub={data ? `${data.unread} unread` : ''}><button className="btn" onClick={readAll}>Mark all as read</button></PageHead>
    <Card flush>{loading && !data ? <Spinner /> : !data?.items.length ? <Empty title="Nothing here" text="Alerts about your tickets and assets appear here." /> : data.items.map((n) => (
      <Link key={n._id} to={n.link || '/'} onClick={() => api.put(`/notifications/${n._id}/read`)} className="row" style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', color: 'inherit', textDecoration: 'none', background: n.read ? '' : 'var(--primary-50)' }}>
        <i className="dot" style={{ background: TONE[n.type] }} /><div className="grow"><b>{n.title}</b><div className="small muted">{n.message}</div></div><span className="small muted">{ago(n.createdAt)}</span></Link>))}</Card></>);
}
