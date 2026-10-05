import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Mic2, Users, BookOpen,
  MessageSquare, Zap, Settings, ChevronRight, PhoneCall
} from 'lucide-react';

const navItems = [
  {
    section: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/voice-agent', label: 'Live Voice Agent', icon: Mic2, badge: 'LIVE' },
    ]
  },
  {
    section: 'CRM',
    items: [
      { to: '/leads', label: 'Lead Management', icon: Users },
      { to: '/conversations', label: 'Conversation History', icon: MessageSquare },
      { to: '/control-room', label: 'Outbound Control Room', icon: PhoneCall, badge: 'NEW' },
    ]
  },
  {
    section: 'Knowledge',
    items: [
      { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    ]
  },
  {
    section: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
    ]
  }
];

export default function Sidebar() {
  return (
    <motion.aside
      className="sidebar"
      initial={{ x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <Zap size={20} color="white" strokeWidth={2.5} />
          </div>
          <div className="logo-text-block">
            <div className="logo-title">Voice RAG AI</div>
            <div className="logo-subtitle">Sales Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <div className="nav-item-icon">
                      <item.icon size={15} />
                    </div>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span className="nav-item-badge">{item.badge}</span>
                    )}
                    {isActive && !item.badge && (
                      <ChevronRight size={12} style={{ opacity: 0.4 }} />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-status">
          <div className="status-dot" />
          <div className="status-text">Ollama · Connected</div>
        </div>
      </div>
    </motion.aside>
  );
}
