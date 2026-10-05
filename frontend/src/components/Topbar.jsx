import { useLocation } from 'react-router-dom';
import { Bell, Search, HelpCircle } from 'lucide-react';

const routeLabels = {
  '/': { parent: 'Voice RAG AI', current: 'Executive Dashboard' },
  '/voice-agent': { parent: 'Voice RAG AI', current: 'Live Voice Agent' },
  '/leads': { parent: 'CRM', current: 'Lead Management' },
  '/conversations': { parent: 'CRM', current: 'Conversation History' },
  '/knowledge': { parent: 'Knowledge', current: 'Knowledge Base' },
  '/settings': { parent: 'System', current: 'Settings' },
};

export default function Topbar() {
  const { pathname } = useLocation();
  const label = routeLabels[pathname] || { parent: 'Voice RAG AI', current: 'Page' };

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <span className="breadcrumb-item">{label.parent}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">{label.current}</span>
      </div>

      <div className="topbar-actions">
        <button className="topbar-btn" aria-label="Search" id="topbar-search-btn">
          <Search size={15} />
        </button>
        <button className="topbar-btn" aria-label="Notifications" id="topbar-notif-btn" style={{ position: 'relative' }}>
          <Bell size={15} />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, background: 'var(--orange-500)',
            borderRadius: '50%', border: '1.5px solid white'
          }} />
        </button>
        <button className="topbar-btn" aria-label="Help" id="topbar-help-btn">
          <HelpCircle size={15} />
        </button>
        <div className="avatar" id="topbar-avatar" title="Admin User">A</div>
      </div>
    </header>
  );
}
