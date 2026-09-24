import { useNavigate } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import api from '../api';
import { useApi } from '../utils';
import { Card, PageHead, Spinner, Meter, Badge, Empty, Avatar } from '../components/ui';
export default function Workload() {
  const nav = useNavigate(); const { data, loading } = useApi(async () => (await api.get('/reports/workload')).data, []);
  if (loading || !data) return <Spinner />;
  const total = data.reduce((n, t) => n + t.open, 0);
  return (<><PageHead title="Technician workload" sub={`${total} open tickets across ${data.length} technicians. Utilisation compares open tickets with each person's capacity.`} />
    {!data.length ? <Card><Empty title="No technicians" text="Add users with the Technician role." /></Card> : <div className="grid g3">{data.map((t) => (
      <Card key={t._id}><div className="row"><Avatar name={t.name} /><div className="grow"><b>{t.name}</b><div className="small muted">Capacity {t.capacity} tickets</div></div>{t.breached > 0 && <Badge tone="red">{t.breached} breached</Badge>}</div>
        <div className="row between mt" style={{ marginTop: 14 }}><span className="small muted">Utilisation</span><b>{t.utilization}%</b></div><Meter pct={t.utilization} />
        <div className="grid g3 mt" style={{ marginTop: 14, gap: 8, textAlign: 'center' }}><div><div style={{ fontSize: 20, fontWeight: 600 }}>{t.open}</div><div className="small muted">Open</div></div><div><div style={{ fontSize: 20, fontWeight: 600 }}>{t.resolved7}</div><div className="small muted">Resolved 7d</div></div><div><div style={{ fontSize: 20, fontWeight: 600 }}>{Math.round(t.minutes7 / 6) / 10}h</div><div className="small muted">Logged 7d</div></div></div>
        <div className="row wrap gap-sm mt" style={{ marginTop: 12 }}>{Object.entries(t.byStatus).map(([s, n]) => <Badge key={s}>{s.replace('_', ' ')}: {n}</Badge>)}</div>
        <button className="btn sm mt" style={{ marginTop: 12, width: '100%' }} onClick={() => nav(`/tickets?assignee=${t._id}&open=true`)}>View tickets</button></Card>))}</div>}</>);
}
