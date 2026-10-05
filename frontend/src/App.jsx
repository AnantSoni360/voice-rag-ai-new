import { Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastContainer } from './components/Toast';
import Dashboard from './pages/Dashboard';
import VoiceAgent from './pages/VoiceAgent';
import Leads from './pages/Leads';
import KnowledgeBase from './pages/KnowledgeBase';
import Conversations from './pages/Conversations';
import ControlRoom from './pages/ControlRoom';
import Settings from './pages/Settings';

function BackgroundCanvas() {
  return (
    <div className="bg-canvas" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
    </div>
  );
}

export default function App() {
  return (
    <div className="app-layout">
      <BackgroundCanvas />
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <motion.div
          key="route-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/voice-agent" element={<VoiceAgent />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/control-room" element={<ControlRoom />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </motion.div>
      </div>
      <ToastContainer />
    </div>
  );
}
