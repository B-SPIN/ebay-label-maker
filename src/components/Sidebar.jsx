import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, AlertCircle, Printer, Settings, Box, Moon, Sun, PanelLeftClose, PanelLeftOpen, BookOpen, ShoppingBag, FileText, List, Package, ShoppingCart, History } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import AppLogo from './AppLogo';
import { getSetting, saveSetting } from '../db/database';

function getInitialCollapsed() {
  return localStorage.getItem('ebay-label-sidebar') === 'collapsed';
}

export default function Sidebar({ className = "" }) {
  const [theme, setTheme] = useState('light');
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    const loadTheme = async () => {
      const saved = await getSetting('theme');
      if (saved) {
        setTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };
    loadTheme();
  }, []);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isAdmin = searchParams.get('admin') === '1';

  useEffect(() => {
    localStorage.setItem('ebay-label-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    await saveSetting('theme', newTheme);
  };


  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${className}`}>
      {/* Header */}
      <div className="sidebar-header" style={{ alignItems: 'center', padding: collapsed ? '20px 0' : '20px' }}>
        <AppLogo size={collapsed ? 32 : 36} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <h2 style={{
            margin: 0,
            lineHeight: '1.1',
            fontSize: '1.2rem',
            fontWeight: 800,
            letterSpacing: '-0.5px'
          }}>
            ebay<br />
            Label Maker
          </h2>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(prev => !prev)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed && <span>Collapse</span>}
      </button>

      {/* Nav links */}
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Dashboard">
          <LayoutDashboard />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/review" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Review Issues">
          <AlertCircle />
          {!collapsed && <span>Review Issues</span>}
        </NavLink>
        <NavLink to="/labels" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Print Labels">
          <Printer />
          {!collapsed && <span>Print Labels</span>}
        </NavLink>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 16px', opacity: 0.5 }} />

        <NavLink to="/amazon" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Amazon to Auspost">
          <Package />
          {!collapsed && <span>Amazon to Auspost</span>}
        </NavLink>
        <NavLink to="/ebay" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Ebay to Auspost">
          <ShoppingBag />
          {!collapsed && <span>Ebay to Auspost</span>}
        </NavLink>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 16px', opacity: 0.5 }} />

        <NavLink to="/sales-terminal" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Sales Terminal">
          <ShoppingCart />
          {!collapsed && <span>Sales Terminal</span>}
        </NavLink>
        <NavLink to="/invoices" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Invoice History">
          <History />
          {!collapsed && <span>Invoice History</span>}
        </NavLink>
        <NavLink to="/invoice-items" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Products">
          <Box />
          {!collapsed && <span>Products</span>}
        </NavLink>



        {/* Spacer */}
        <div style={{ flex: 1 }}></div>

        {/* Bottom items */}
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <NavLink to="/settings" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Settings" style={{ marginTop: '4px' }}>
          <Settings />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <NavLink to="/guide" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="User Guide" style={{ marginTop: '4px' }}>
          <BookOpen />
          {!collapsed && <span>User Guide</span>}
        </NavLink>
      </nav>
    </aside>
  );
}
