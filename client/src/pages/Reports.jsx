import { useState } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from 'recharts';
import api, { download, errMsg } from '../api';
import { useToast } from '../context/Toast';
import { useApi } from '../utils';
import { Card, PageHead, Spinner, Empty, Badge, PriorityBadge, SlaTimer } from '../components/ui';
import { Link } from 'react-router-dom';
export default function Reports() {
  const toast = useToast(); const [days, setDays] = useState(30);
  const { data, loading } = useApi(async () => (await api.get('/reports/overview', { params: { days } })).data, [days]);
  const exp = (url, format, name) => download(url, { format }, `${name}.${format}`).catch((e) => toast.error(errMsg(e)));
  return (<><PageHead title="Reports" sub="SLA performance, technician output and demand.">
    <select className="select" style={{ width: 150 }} value={days} onChange={(e) => setDays(+e.target.value)} aria-label="Period"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option></select>
    <button className="btn" onClick={() => exp('/tickets/export', 'csv', 'tickets')}><Download size={16} />Tickets CSV</button><button className="btn" onClick={() => exp('/tickets/export', 'pdf', 'tickets')}><Download size={16} />Tickets PDF</button><button className="btn" onClick={() => exp('/assets/export', 'pdf', 'assets')}><Download size={16} />Assets PDF</button></PageHead>
    {loading || !data ? <Spinner /> : <>
      <div className="grid g-wide mb">
        <Card flush title="SLA compliance by priority"><div className="table-wrap"><table><thead><tr><th>Priority</th><th>Tickets</th><th>Resolved</th><th>Resolution breaches</th><th>Response breaches</th><th>Avg resolution</th><th>Compliance</th></tr></thead><tbody>
          {data.byPriority.map((p) => <tr key={p.name}><td><PriorityBadge priority={p} /></td><td>{p.total}</td><td>{p.resolved}</td><td>{p.breached ? <Badge tone="red">{p.breached}</Badge> : 0}</td><td>{p.respBreached ? <Badge tone="amber">{p.respBreached}</Badge> : 0}</td><td>{p.avgResolutionHours != null ? `${p.avgResolutionHours}h` : '-'}</td><td><Badge tone={p.compliance >= 90 ? 'green' : p.compliance >= 75 ? 'amber' : 'red'}>{p.compliance}%</Badge></td></tr>)}</tbody></table>{!data.byPriority.length && <Empty title="No data" text="No tickets in this period." />}</div></Card>
        <Card title="Demand by category"><div style={{ height: 240 }}><ResponsiveContainer><BarChart data={data.byCategory} layout="vertical" margin={{ left: 10 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#3d4a66' }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#f4f6fa' }} /><Bar dataKey="count" fill="#2458d6" radius={5} barSize={14} /></BarChart></ResponsiveContainer></div></Card></div>
      <div className="grid g2 mb">
        <Card title="Tickets created per day"><div style={{ height: 230 }}><ResponsiveContainer><LineChart data={data.trend} margin={{ left: -20, right: 8 }}><CartesianGrid stroke="#e9edf5" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7692' }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7692' }} tickLine={false} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="tickets" stroke="#2458d6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card flush title="Technician performance"><div className="table-wrap"><table><thead><tr><th>Technician</th><th>Resolved</th><th>Breached</th><th>Avg resolution</th><th>Time logged</th></tr></thead><tbody>{data.technicians.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.resolved}</td><td>{t.breached || 0}</td><td>{t.avgResolutionHours}h</td><td>{t.loggedHours}h</td></tr>)}</tbody></table>{!data.technicians.length && <Empty title="No resolutions yet" text="Resolved tickets will appear here." />}</div></Card></div>
      <Card flush title="Open tickets with a breached SLA">{data.breached.length ? <div className="table-wrap"><table><tbody>{data.breached.map((t) => <tr key={t._id}><td className="mono"><Link to={`/tickets/${t._id}`}>{t.number}</Link></td><td className="title-cell">{t.title}</td><td><PriorityBadge priority={t.priority} /></td><td>{t.assignee?.name || 'Unassigned'}</td><td><SlaTimer due={t.sla?.resolutionDue} breached /></td></tr>)}</tbody></table></div> : <Empty title="No breaches" text="Every open ticket is within its SLA." />}</Card></>}</>);
}
