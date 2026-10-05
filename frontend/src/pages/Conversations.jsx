import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Clock, MessageSquare, User, Bot, FileText,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { listConversations, getMessages } from '../api/client';

const OUTCOME_BADGE = {
  'qualified':    'badge-success',
  'in_progress':  'badge-orange',
  'nurture':      'badge-info',
  'lost':         'badge-error',
  'new':          'badge-neutral',
};

const STATUS_DISPLAY = {
  'qualified': 'Qualified',
  'in_progress': 'In Progress',
  'nurture': 'Nurture',
  'lost': 'Lost',
  'new': 'New',
};

const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function Conversations() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchConvs = async () => {
      try {
        const res = await listConversations();
        setConversations(res.data || []);
      } catch (err) {
        console.error('Fetch conversations error:', err);
      }
    };
    
    fetchConvs();
    const interval = setInterval(fetchConvs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = async (conv) => {
    setSelected(conv);
    setMessages([]);
    try {
      const res = await getMessages(conv.id);
      setMessages(res.data.messages || []);
    } catch (e) {
      console.error('Load session error:', e);
    }
  };

  const filtered = conversations.filter(c =>
    (c.lead_name || 'Unknown').toLowerCase().includes(search.toLowerCase()) ||
    (c.lead_company || '').toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Conversation <span>History</span></h1>
          <p className="page-desc">Browse transcripts, inspect sources and review lead extractions.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20, transition: 'grid-template-columns 0.3s ease' }}>
        {/* Conversation List */}
        <div>
          {/* Search */}
          <div className="search-wrap" style={{ marginBottom: 14 }}>
            <Search size={13} className="search-icon" />
            <input
              className="form-input search-input"
              placeholder="Search by name, company or session ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="conv-search"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AnimatePresence>
              {filtered.map((conv, i) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleSelect(conv)}
                  style={{
                    background: 'white',
                    border: `1px solid ${selected?.id === conv.id ? 'var(--orange-300)' : 'var(--border-light)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    boxShadow: selected?.id === conv.id ? 'var(--shadow-orange)' : 'var(--shadow-xs)',
                    transition: 'all 0.2s ease',
                  }}
                  whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, var(--orange-400), var(--orange-600))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0
                    }}>
                      {(conv.lead_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{conv.lead_name || 'Unknown'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {conv.lead_company || '-'}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.id}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span className={`badge ${OUTCOME_BADGE[conv.lead_outcome] || 'badge-neutral'}`} style={{ fontSize: 10 }}>{STATUS_DISPLAY[conv.lead_outcome] || 'New'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} /> {formatDuration(conv.duration_seconds)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MessageSquare size={10} /> {conv.turn_count} turns
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{conv.language}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{new Date(conv.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon"><MessageSquare size={32} /></div>
                <div className="empty-title">No conversations found</div>
                <div className="empty-desc">Try a different search term.</div>
              </div>
            )}
          </div>
        </div>

        {/* Transcript Detail */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* Header */}
              <div className="card">
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{selected.lead_name || 'Unknown User'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.lead_company || '-'} · {selected.id} · {new Date(selected.started_at).toLocaleString()}</div>
                    </div>
                    <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm" id="close-transcript-btn">✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`badge ${OUTCOME_BADGE[selected.lead_outcome] || 'badge-neutral'}`}>{STATUS_DISPLAY[selected.lead_outcome] || 'New'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} /> {formatDuration(selected.duration_seconds)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.language}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: selected.lead_score >= 70 ? 'var(--success)' : 'var(--orange-500)' }}>
                      Score: {selected.lead_score}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                  <div className="card-title">Transcript</div>
                </div>
                <div className="transcript-panel" style={{ borderRadius: '0 0 14px 14px', flex: 1, overflowY: 'auto' }}>
                  {messages.map((msg, i) => (
                    <div key={i} className={`transcript-msg ${msg.role}`}>
                      <div className={`transcript-avatar ${msg.role}`}>
                        {msg.role === 'ai' ? <Bot size={12} /> : <User size={12} />}
                      </div>
                      <div>
                        <div className="transcript-bubble">{msg.content}</div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="transcript-source">
                            <FileText size={10} /> {msg.sources[0].document} · Score: {(msg.sources[0].similarity * 100).toFixed(1)}%
                          </div>
                        )}
                        <div className="transcript-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</div>
                      </div>
                    </div>
                  ))}
                  {messages.filter(m => m.flagged).map((msg, i) => (
                    <div key={`flag-${i}`} style={{
                      padding: '10px 12px', background: 'var(--warning-bg)',
                      borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.15)',
                      display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12
                    }}>
                      <AlertCircle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <strong>Flagged:</strong> {msg.flag_reason}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading transcript...</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
