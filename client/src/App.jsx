import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/Auth';
import Layout from './components/Layout';
import { Spinner, Empty } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketNew from './pages/TicketNew';
import TicketDetail from './pages/TicketDetail';
import Assets from './pages/Assets';
import Knowledge from './pages/Knowledge';
import Vendors from './pages/Vendors';
import Workload from './pages/Workload';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

function Guard({ roles, children }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Empty title="You do not have access to this page" text="Ask your administrator if you need a different role." />;
  return children;
}
export default function App() {
  return (<Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<Guard><Layout /></Guard>}>
      <Route index element={<Dashboard />} />
      <Route path="tickets" element={<Tickets />} /><Route path="tickets/new" element={<TicketNew />} /><Route path="tickets/:id" element={<TicketDetail />} />
      <Route path="assets" element={<Assets />} />
      <Route path="knowledge" element={<Knowledge />} />
      <Route path="vendors" element={<Guard roles={['admin', 'manager', 'technician', 'asset_manager']}><Vendors /></Guard>} />
      <Route path="workload" element={<Guard roles={['admin', 'manager', 'technician']}><Workload /></Guard>} />
      <Route path="reports" element={<Guard roles={['admin', 'manager']}><Reports /></Guard>} />
      <Route path="audit" element={<Guard roles={['admin', 'manager']}><Audit /></Guard>} />
      <Route path="users" element={<Guard roles={['admin', 'manager']}><Users /></Guard>} />
      <Route path="settings" element={<Guard roles={['admin']}><Settings /></Guard>} />
      <Route path="notifications" element={<Notifications />} /><Route path="profile" element={<Profile />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>);
}
