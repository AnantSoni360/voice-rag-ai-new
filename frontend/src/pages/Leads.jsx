import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Eye,
  Phone, Mail, Calendar
} from 'lucide-react';
import { listLeads } from '../api/client';
import { toast } from '../components/Toast';

const STATUS_STYLES = {
  'qualified':   { cls: 'badge-success', display: 'Qualified' },
  'in_progress': { cls: 'badge-orange', display: 'In Progress' },
  'nurture':     { cls: 'badge-info', display: 'Nurture' },
  'lost':        { cls: 'badge-error', display: 'Lost' },
  'new':         { cls: 'badge-neutral', display: 'New' }
};

function ScoreBar({ score }) {
  const numScore = score || 0;
  const cls = numScore >= 70 ? 'high' : numScore >= 40 ? 'medium' : 'low';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track" style={{ width: 80 }}>
        <motion.div
          className={`score-bar-fill ${cls}`}
          initial={{ width: 0 }}
          animate={{ width: `${numScore}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ width: `${numScore}%` }}
        />
      </div>
      <span className="score-value" style={{
        color: cls === 'high' ? 'var(--success)' : cls === 'medium' ? 'var(--orange-500)' : 'var(--error)'
      }}>{numScore}</span>
    </div>
  );
}

function AvatarCircle({ name, score }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  const numScore = score || 0;
  const color = numScore >= 70 ? '#10B981' : numScore >= 40 ? '#F97316' : '#EF4444';
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}33, ${color}66)`,
      border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color, flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  const handleTakeAction = (targetLead = selected) => {
    if (!targetLead) return;
    const subject = encodeURIComponent(`Follow up: Nexus CRM - ${targetLead.company && targetLead.company !== '-' ? targetLead.company : 'Your Inquiry'}`);
    const requirementsStr = targetLead.requirements && targetLead.requirements !== '-' ? `I understand you are looking for: ${targetLead.requirements}.` : 'I am reaching out regarding your recent inquiry.';
    const actionStr = targetLead.next_action ? `To move forward with our recommended next step (${targetLead.next_action}), I would love to connect.` : 'I would love to connect to discuss how Nexus CRM can help.';
    
    const body = encodeURIComponent(`Hi ${targetLead.name && targetLead.name !== 'Unknown User' ? targetLead.name.split(' ')[0] : 'there'},\n\nThank you for chatting with Sambash AI today.\n\n${requirementsStr}\n\n${actionStr}\n\nAre you available for a quick 10-minute call sometime this week?\n\nBest regards,\nYour Sales Team`);
    
    window.location.href = `mailto:${targetLead.email || ''}?subject=${subject}&body=${body}`;
    toast.success('Action Triggered', 'Opening your email client with a smart draft...');
  };

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await listLeads();
        setLeads(res.data || []);
      } catch (err) {
        console.error("Failed to fetch leads:", err);
      }
    };
    
    // Initial fetch
    fetchLeads();
    
    // Real-time polling every 3 seconds to see new leads instantly
    const interval = setInterval(fetchLeads, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = leads.filter(l => {
    const matchSearch = (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.company || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || (STATUS_STYLES[l.status]?.display || l.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Lead <span>Management</span></h1>
          <p className="page-desc">Track, qualify and follow up with every conversation lead.</p>
        </div>
        <button 
          className="btn btn-primary" 
          id="new-lead-btn"
          onClick={() => toast.info('AI Automation', 'Manual lead creation is disabled. All leads are automatically extracted and scored by Sambash AI from live voice sessions.')}
        >
          <Plus size={14} /> Add Lead
        </button>
      </div>

      {/* Summary Strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Leads', value: leads.length, color: 'var(--text-primary)' },
          { label: 'Qualified', value: leads.filter(l => l.status === 'qualified').length, color: 'var(--success)' },
          { label: 'In Progress', value: leads.filter(l => l.status === 'in_progress').length, color: 'var(--orange-500)' },
          { label: 'Nurture', value: leads.filter(l => l.status === 'nurture').length, color: 'var(--info)' },
          { label: 'Lost', value: leads.filter(l => l.status === 'lost').length, color: 'var(--error)' },
        ].map(s => (
          <motion.div
            key={s.label}
            style={{
              padding: '10px 18px', background: 'white', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-xs)'
            }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <Search size={13} className="search-icon" />
          <input
            className="form-input search-input"
            placeholder="Search leads by name or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="leads-search"
          />
        </div>
        <div className="filters-row">
          {['All', 'Qualified', 'In Progress', 'Nurture', 'Lost'].map(s => (
            <button
              key={s}
              className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
              id={`filter-${s.toLowerCase().replace(' ', '-')}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        className="table-wrap"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      >
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Score</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Timeline</th>
              <th>Objection</th>
              <th>Language</th>
              <th>Next Action</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: Math.min(i * 0.04, 0.5) }}
                  onClick={() => setSelected(lead)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarCircle name={lead.name} score={lead.score} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.name || 'Unknown User'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{lead.company || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td><ScoreBar score={lead.score} /></td>
                  <td><span className={`badge ${STATUS_STYLES[lead.status]?.cls || 'badge-neutral'}`}>{STATUS_STYLES[lead.status]?.display || lead.status}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{lead.budget_range || '-'}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{lead.purchase_timeline || '-'}</span></td>
                  <td>
                    {!lead.main_objection || lead.main_objection.toLowerCase() === 'none'
                      ? <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ None</span>
                      : <span style={{ fontSize: 12, color: 'var(--error)' }}>{lead.main_objection}</span>}
                  </td>
                  <td><span style={{ fontSize: 12.5 }}>{lead.language}</span></td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.next_action || '-'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        id={`view-lead-${lead.id}`}
                        onClick={(e) => { e.stopPropagation(); setSelected(lead); }}
                        title="View Details"
                      ><Eye size={13} /></button>
                      
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        id={`call-lead-${lead.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (lead.phone && lead.phone !== '-') {
                            window.location.href = `tel:${lead.phone}`;
                            toast.success('Calling...', `Dialing ${lead.phone}`);
                          } else {
                            toast.error('No Phone Number', 'The AI did not extract a phone number for this lead.');
                          }
                        }}
                        title="Call Lead"
                      ><Phone size={13} /></button>
                      
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        id={`email-lead-${lead.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTakeAction(lead);
                        }}
                        title="Draft Follow-up Email"
                      ><Mail size={13} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Search size={32} /></div>
            <div className="empty-title">No leads found</div>
            <div className="empty-desc">Try adjusting your search or complete a voice session.</div>
          </div>
        )}
      </motion.div>

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          >
            <motion.div
              className="modal"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="modal-header">
                <div>
                  <div className="modal-title">{selected.name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.company}</div>
                </div>
                <span className={`badge ${STATUS_STYLES[selected.status]?.cls}`}>{STATUS_STYLES[selected.status]?.display}</span>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Lead Score', value: (selected.score || 0) + '/100' },
                    { label: 'Budget Range', value: selected.budget_range || '-' },
                    { label: 'Purchase Timeline', value: selected.purchase_timeline || '-' },
                    { label: 'Main Objection', value: selected.main_objection || 'None' },
                    { label: 'Decision Authority', value: selected.decision_authority || '-' },
                    { label: 'Phone', value: selected.phone || '-' },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Requirements summary</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card-hover)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    {selected.requirements || 'No requirements extracted yet.'}
                  </div>
                </div>
                <div style={{ marginTop: 20, padding: 14, background: 'var(--orange-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--orange-100)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Recommended Next Action</div>
                  <div style={{ fontSize: 13.5, color: 'var(--orange-800)', fontWeight: 600 }}>
                    {selected.next_action || ((selected.score || 0) >= 70 ? '🎯 Schedule a product demo immediately' :
                     (selected.score || 0) >= 40 ? '📞 Follow up call to qualify further' :
                     '📧 Nurture with product information email')}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
                <button className="btn btn-primary btn-sm" id="modal-action-btn" onClick={handleTakeAction}>
                  <Calendar size={12} /> Take Recommended Action
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
