import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, PlusCircle, BookOpen, Gauge, Package,
  Truck, BarChart3, ScrollText, Users, Settings, Bell,
  Search, LogOut, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { useAuth } from '../context/Auth';
import api from '../api';
import { Avatar } from './ui';
import { ROLE_LABEL, ago } from '../utils';
import logoSrc from '../logo.png';

const NAV = [
  { group: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  ]},
  { group: 'Service Desk', items: [
    { to: '/tickets',     label: 'Tickets',        icon: Ticket,   end: true },
    { to: '/tickets/new', label: 'New Ticket',     icon: PlusCircle },
    { to: '/knowledge',   label: 'Knowledge Base', icon: BookOpen },
    { to: '/workload',    label: 'Workload',       icon: Gauge, roles: ['admin','manager','technician'] },
  ]},
  { group: 'Assets', items: [
    { to: '/assets',  label: 'Assets',  icon: Package, mineLabel: 'My Assets' },
    { to: '/vendors', label: 'Vendors', icon: Truck, roles: ['admin','manager','technician','asset_manager'] },
  ]},
  { group: 'Insights', roles: ['admin','manager'], items: [
    { to: '/reports', label: 'Reports',     icon: BarChart3, accent: 'reports' },
    { to: '/audit',   label: 'Audit Trail', icon: ScrollText },
  ]},
  { group: 'Admin', roles: ['admin','manager'], items: [
    { to: '/users',    label: 'Users',    icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ]},
];

function Bell_() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef();
  const load = () => api.get('/notifications').then(r => setData(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = e => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const readAll = async () => { await api.post('/notifications/read-all'); load(); };
  const click   = async n  => { if (!n.read) await api.put(`/notifications/${n._id}/read`); setOpen(false); load(); };
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn ghost icon" style={{ position: 'relative' }}
        onClick={() => { setOpen(!open); load(); }}
        aria-label={`Notifications, ${data.unread} unread`}>
        <Bell size={19} />
        {data.unread > 0 && <span className="bell-badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="row between" style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <b>Notifications</b>
            <button className="btn sm ghost" onClick={readAll}>Mark all read</button>
          </div>
          <div style={{ maxHeight:380, overflow:'auto' }}>
            {!data.items.length && <div className="empty">You are all caught up.</div>}
            {data.items.slice(0,10).map(n => (
              <Link key={n._id} to={n.link||'/notifications'}
                className={`item ${n.read?'':'unread'}`} onClick={() => click(n)}>
                <div className="row gap-sm">
                  <i className="dot" style={{ background:{ danger:'var(--bad)',warning:'#f08c00',success:'var(--ok)',info:'var(--primary)' }[n.type] }} />
                  <b className="small clip">{n.title}</b>
                </div>
                <div className="small muted clip">{n.message}</div>
                <div className="small muted">{ago(n.createdAt)}</div>
              </Link>
            ))}
          </div>
          <Link to="/notifications" className="item small right" onClick={() => setOpen(false)}>View all</Link>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [q, setQ] = useState('');
  const go = e => { e.preventDefault(); if (q.trim()) nav(`/tickets?q=${encodeURIComponent(q.trim())}`); };

  return (
    <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ═══════════════════════════════════
          FULL-WIDTH TOP HEADER
          Left: brand (same width as sidebar)
          Right: search, bell, user
      ══════════════════════════════════════ */}
      <header className="topbar">

        {/* Brand strip – matches sidebar width */}
        <div className="topbar-brand">
          <div className="brand-logo">
            <img src={logoSrc} alt="ServiceDesk Pro logo" />
          </div>
          {!collapsed && <span className="brand-name">ServiceDesk Pro</span>}
        </div>

        {/* Divider */}
        <div className="topbar-divider" />

        {/* Main topbar area */}
        <div className="topbar-main">
          {/* Hamburger — opens sidebar on mobile OR collapses on desktop */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => { if (window.innerWidth <= 900) setMobileOpen(true); else setCollapsed(!collapsed); }}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          <form className="search" onSubmit={go} role="search">
            <Search size={16} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search tickets…" aria-label="Search tickets" />
          </form>

          <div className="grow" />
          <Bell_ />
          <Link to="/profile" className="topbar-user">
            <Avatar name={user.name} />
            <span className="topbar-user-name">{user.name.split(' ')[0]}</span>
          </Link>
        </div>
      </header>

      {/* ═══════════════════════════════════
          BODY ROW  —  Sidebar + Content
      ══════════════════════════════════════ */}
      <div className="shell-body">

        {/* Mobile overlay */}
        {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

        {/* ── Sidebar ── */}
        <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>

          {/* Nav links */}
          <nav className="nav" aria-label="Main">
            {NAV.filter(g => !g.roles || can(...g.roles)).map(g => {
              const items = g.items.filter(i => !i.roles || can(...i.roles));
              if (!items.length) return null;
              return (
                <div key={g.group}>
                  {!collapsed && <div className="nav-group">{g.group}</div>}
                  {collapsed  && <div className="nav-divider" />}
                  {items.map(i => (
                    <NavLink key={i.to} to={i.to} end={i.end}
                      className={({ isActive }) => [isActive ? 'active' : '', i.accent ? `nav-accent-${i.accent}` : ''].join(' ')}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? (i.mineLabel && ['employee','manager'].includes(user.role) ? i.mineLabel : i.label) : undefined}
                    >
                      <i.icon size={18} />
                      {!collapsed && <span>{i.mineLabel && ['employee','manager'].includes(user.role) ? i.mineLabel : i.label}</span>}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* ── Sidebar Footer ── */}
          <div className="side-foot">
            <div className="side-foot-user">
              <Avatar name={user.name} className="sidebar-av" />
              {!collapsed && (
                <div className="grow">
                  <div style={{ fontWeight:600, color:'#fff', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user.name}
                  </div>
                  <div style={{ color:'rgba(255,255,255,.42)', fontSize:11.5 }}>{ROLE_LABEL[user.role]}</div>
                </div>
              )}
            </div>

            {/* Prominent logout */}
            <button
              className={`logout-btn ${collapsed ? 'logout-btn-icon' : ''}`}
              onClick={() => { logout(); nav('/login'); }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="main">
          <main className="content"><Outlet /></main>
        </div>

      </div>
    </div>
  );
}
