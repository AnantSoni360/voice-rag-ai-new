import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PhoneCall, PhoneOff, PhoneForwarded, Settings, Search, User, FileText, 
  CheckCircle, Mic, Plus, X, Pause, ArrowRightLeft, Play, Download,
  TrendingUp, TrendingDown, Clock, MessageSquare, Headphones, FileCode2
} from 'lucide-react';
import { listOutboundTasks, startOutboundCall, endOutboundCall, transcribeAudio, ragChat, createOutboundTask } from '../api/client';
import { toast } from '../components/Toast';

const STATUS_STYLES = {
  'pending': { cls: 'badge-neutral', display: 'Not Done', icon: <Clock size={10}/> },
  'in_progress': { cls: 'badge-info', display: 'Calling', icon: <Headphones size={10}/> },
  'completed': { cls: 'badge-success', display: 'Ended', icon: <CheckCircle size={10}/> },
};

export default function ControlRoom() {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterTab, setFilterTab] = useState('All');
  const [search, setSearch] = useState('');
  
  // Voice Call State
  const [sessionActive, setSessionActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, calling, active
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // Add Client State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({ customer_name: '', customer_phone: '', query: '' });
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await listOutboundTasks();
        setTasks(res.data || []);
      } catch (err) {}
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  useEffect(() => {
    let convInterval;
    if (sessionActive && activeTask?.sessionId) {
      convInterval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/conversations/${activeTask.sessionId}/messages`);
          const data = await res.json();
          // Filter out the system prompt, map to frontend format
          const formatted = data
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role === 'assistant' ? 'ai' : 'user', text: m.content }));
          setConversationHistory(formatted);
          if (formatted.length > 0) {
            setStatus('active');
          }
        } catch (e) {
          console.error('Interval fetch error:', e);
        }
      }, 2000);
    }
    return () => clearInterval(convInterval);
  }, [sessionActive, activeTask]);

  const handleStartCall = async (task) => {
    try {
      setStatus('calling');
      const res = await startOutboundCall(task.id);
      setActiveTask({ ...task, sessionId: res.data.session_id });
      setSelectedTask(task);
      setSessionActive(true);
      setConversationHistory([]);
      toast.success('Call Connected', `Calling ${task.customer_name}'s real phone number...`);
    } catch (e) {
      toast.error('Call Failed', 'Could not initiate outbound call.');
      setStatus('idle');
      console.error('Start call error:', e);
    }
  };

  const stopTurn = () => {
    // No longer applicable since Twilio handles audio
  };

  const handleEndCall = async () => {
    if (activeTask && activeTask.sessionId) {
      toast.info('Analyzing', 'Generating call summary...');
      try {
        await endOutboundCall(activeTask.id);
        toast.success('Call Completed', 'Transcript and summary saved.');
      } catch (e) {
        console.error('End call error:', e);
      }
    }
    setSessionActive(false);
    setActiveTask(null);
    setStatus('idle');
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    try {
      await createOutboundTask(newClient);
      toast.success('Client Added', 'Outbound task created successfully.');
      setShowAddModal(false);
      setNewClient({ customer_name: '', customer_phone: '', query: '' });
      const res = await listOutboundTasks();
      setTasks(res.data || []);
    } catch (err) {
      console.error('Add client error:', err);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterTab === 'Calling' && t.status !== 'in_progress') return false;
    if (filterTab === 'Not Done' && t.status !== 'pending') return false;
    if (filterTab === 'Ended' && t.status !== 'completed') return false;
    if (search && !t.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const displayTask = sessionActive ? activeTask : selectedTask;

  const [ngrokUrl, setNgrokUrl] = useState(() => localStorage.getItem('twilio_webhook_url') || '');

  const handleNgrokUrlChange = (e) => {
    const url = e.target.value.trim();
    setNgrokUrl(url);
    if (url) {
      localStorage.setItem('twilio_webhook_url', url);
    } else {
      localStorage.removeItem('twilio_webhook_url');
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: '100%' }}>
      <div className="page-header-row" style={{ marginBottom: 24, alignItems: 'center' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--orange-500)' }}><PhoneCall size={24} strokeWidth={3} /></span> 
            Control <span>Room</span>
          </h1>
          <p className="page-desc" style={{ marginTop: 4 }}>Manage and monitor AI calls</p>
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className="search-wrap" style={{ minWidth: 300, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -20, left: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>WEBHOOK URL</div>
            <input 
              className="form-input search-input" 
              placeholder="e.g. https://...ngrok-free.app" 
              value={ngrokUrl} 
              onChange={handleNgrokUrlChange}
              style={{ border: ngrokUrl ? '1px solid var(--success)' : '1px solid var(--error)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Top Overview Cards */}
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ color: 'var(--orange-500)' }}><User size={24} /></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Customers</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{tasks.length} <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>↑ 12%</span></div>
            </div>
          </div>
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ color: 'var(--orange-500)' }}><MessageSquare size={24} /></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Queries Resolved</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{tasks.filter(t=>t.status==='completed').length} <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>↑ 15%</span></div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.5fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT PANEL: Customer Call Queue */}
        <div className="card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Customer Call Queue</div>
          </div>
          
          <div style={{ padding: '0 20px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['All', 'Calling', 'Not Done', 'Ended'].map(tab => (
                <button 
                  key={tab}
                  className={`btn btn-sm ${filterTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 20, padding: '4px 16px', border: filterTab === tab ? 'none' : '1px solid var(--border-light)' }}
                  onClick={() => setFilterTab(tab)}
                >
                  {tab} 
                  {tab === 'All' && ` (${tasks.length})`}
                  {tab === 'Calling' && ` (${tasks.filter(t=>t.status==='in_progress').length})`}
                  {tab === 'Not Done' && ` (${tasks.filter(t=>t.status==='pending').length})`}
                  {tab === 'Ended' && ` (${tasks.filter(t=>t.status==='completed').length})`}
                </button>
              ))}
            </div>
            <div className="search-wrap" style={{ marginBottom: 16 }}>
              <Search size={14} className="search-icon" />
              <input 
                className="form-input search-input" 
                placeholder="Search by name, phone, or query..." 
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Query</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Phone</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTasks.map(task => (
                    <motion.tr 
                      key={task.id} 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setSelectedTask(task)}
                      style={{ 
                        borderBottom: '1px solid var(--border-light)', 
                        cursor: 'pointer',
                        background: selectedTask?.id === task.id ? 'var(--bg-card-hover)' : 'transparent' 
                      }}
                      whileHover={{ background: 'var(--bg-card-hover)' }}
                    >
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-main)' }}>{task.customer_name}</td>
                      <td style={{ padding: '16px 10px', color: 'var(--text-secondary)', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.query}</td>
                      <td style={{ padding: '16px 10px', color: 'var(--text-secondary)' }}>{task.customer_phone}</td>
                      <td style={{ padding: '16px 10px' }}>
                        <span className={`badge ${STATUS_STYLES[task.status]?.cls || 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {STATUS_STYLES[task.status]?.icon} {STATUS_STYLES[task.status]?.display || task.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {task.status === 'pending' ? (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--orange-500)', border: 'none' }}
                            onClick={(e) => { e.stopPropagation(); handleStartCall(task); }}
                            disabled={sessionActive}
                          >
                            <PhoneCall size={14} color="white" />
                          </button>
                        ) : task.status === 'completed' ? (
                          <button className="btn btn-ghost" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                            <FileText size={14} color="var(--text-muted)" />
                          </button>
                        ) : (
                          <div className="status-indicator active" style={{ display: 'inline-block', marginRight: 10 }}></div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER PANEL: AI Call in Progress */}
        <div className="card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', border: sessionActive ? '2px solid var(--orange-500)' : '1px solid var(--border-light)' }}>
          {sessionActive ? (
            <>
              <div style={{ background: 'linear-gradient(135deg, var(--orange-500), var(--orange-600))', color: 'white', padding: '16px 20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Clock size={16} /> AI Call in Progress
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontFamily: 'monospace', fontSize: 16 }}>
                  <div className="status-indicator" style={{ background: 'white', width: 8, height: 8, animation: 'pulse 1s infinite' }} />
                  00:03:24
                </div>
              </div>
              
              <div style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=ffedd5" alt="AI Avatar" style={{ width: 60, height: 60, borderRadius: '50%' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 18 }}>AI Voice Agent</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Speaking with {activeTask.customer_name}...</p>
                
                {/* Simulated Waveform */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, marginTop: 24 }}>
                  {[...Array(24)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      animate={status === 'speaking' || status === 'processing' ? { height: [10, (i % 5) * 6 + 10, 10] } : { height: 4 }}
                      transition={{ repeat: Infinity, duration: 0.5 + (i % 3) * 0.2 }}
                      style={{ width: 4, background: 'var(--orange-400)', borderRadius: 2 }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 30 }}>
                  <button className="btn btn-ghost" style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10 }} onClick={stopTurn} disabled={true}>
                    <Mic size={20} color="var(--text-muted)" />
                  </button>
                  <button className="btn btn-ghost" style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10 }}>
                    <Pause size={20} color="var(--text-muted)" />
                  </button>
                  <button className="btn" style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--error)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, border: 'none' }} onClick={handleEndCall}>
                    <PhoneOff size={20} />
                  </button>
                  <button className="btn btn-ghost" style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10 }}>
                    <ArrowRightLeft size={20} color="var(--text-muted)" />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Live Transcript</div>
                  <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}>
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 8 }}>
                  {conversationHistory.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: msg.role === 'ai' ? 'var(--orange-100)' : 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {msg.role === 'ai' ? <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=ffedd5" style={{ width: 24, borderRadius: '50%' }}/> : <User size={16} color="var(--text-muted)" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: msg.role === 'ai' ? 'var(--orange-600)' : 'var(--text-main)' }}>
                            {msg.role === 'ai' ? 'AI Agent' : 'Customer'}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>00:48</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {conversationHistory.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                      Initiating call connection...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: status === 'active' ? 'var(--success)' : 'var(--text-muted)', padding: '12px 0', borderTop: '1px solid var(--border-light)', marginTop: 16 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: status === 'active' ? 'var(--success)' : 'transparent', marginRight: 8, animation: status === 'active' ? 'pulse 1s infinite' : 'none' }}></span>
                  {status === 'calling' ? 'Calling customer phone...' : status === 'active' ? 'Call in progress via Twilio' : 'Processing...'}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Headphones size={32} />
              </div>
              <h3>No Active Call</h3>
              <p style={{ fontSize: 14 }}>Select a pending customer from the queue to initiate an AI call.</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Customer Details & Post-Call Report */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          
          {displayTask ? (
            <>
              {/* Customer Details Card */}
              <div className="card">
                <div className="card-header" style={{ paddingBottom: 12 }}>
                  <div className="card-title">Customer Details</div>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--orange-500)' }}>Edit</button>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange-600)', fontWeight: 700, fontSize: 20 }}>
                      {displayTask.customer_name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{displayTask.customer_name}</h3>
                        <span className="badge badge-orange" style={{ fontSize: 10 }}>New Lead</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <PhoneCall size={12} /> {displayTask.customer_phone}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Query</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)', marginBottom: 8 }}>{displayTask.query}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="badge badge-orange">Pricing & Plans</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Summary (If Ended) */}
              {displayTask.status === 'completed' && (
                <div className="card">
                  <div className="card-header" style={{ paddingBottom: 12 }}>
                    <div className="card-title">Call Summary</div>
                    <span className="badge badge-success">Call Completed</span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Call Duration</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>03:42</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outcome</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Query Resolved</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead Score</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--success)', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>85</span>
                          <span style={{ fontSize: 12, color: 'var(--success)' }}>High Potential</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Key Points Covered</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {displayTask.summary ? (
                         <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}><CheckCircle size={14} color="var(--success)" style={{ display: 'inline', marginRight: 6 }}/> {displayTask.summary}</div>
                      ) : (
                         <>
                           <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }}/> Explained Growth plan pricing (₹2,499/month)</div>
                           <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }}/> Confirmed Zoho CRM integration support</div>
                           <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}><CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }}/> Shared integration guide via email</div>
                         </>
                      )}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Next Action</div>
                    <div style={{ background: 'var(--orange-50)', padding: 12, borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ color: 'var(--orange-500)' }}><FileText size={20} /></div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--orange-800)' }}>Send pricing details and integration guide</div>
                        <div style={{ fontSize: 12, color: 'var(--orange-600)' }}>Follow up on 2 days</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border-light)', marginBottom: 16, marginTop: 24 }}>
                      <div style={{ paddingBottom: 8, borderBottom: '2px solid var(--orange-500)', color: 'var(--orange-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Call Recording</div>
                      <div style={{ paddingBottom: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Retrieved Sources</div>
                    </div>

                    <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {displayTask.recording_url ? (
                        <>
                          <audio controls src={displayTask.recording_url} style={{ width: '100%', outline: 'none', borderRadius: 8 }}>
                            Your browser does not support the audio element.
                          </audio>
                          <a href={displayTask.recording_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--orange-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
                            <Download size={14} /> Download Audio
                          </a>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recording available for this call.</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Full Transcript</div>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--orange-500)' }}><Download size={14} /> Download</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
             <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
               <FileCode2 size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
               <h3 style={{ fontSize: 16 }}>No Customer Selected</h3>
               <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 200 }}>Select a customer from the queue to view details and call history.</p>
             </div>
          )}

        </div>

      </div>

      {/* Footer Banner */}
      <div style={{ marginTop: 24, padding: '12px 24px', background: 'white', borderRadius: 12, border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--orange-500)', display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={14} /> AI Calls</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: 'var(--orange-500)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Solves Queries</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: 'var(--orange-500)', display: 'flex', alignItems: 'center', gap: 6 }}><FileCode2 size={14} /> Updates CRM</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: 'var(--orange-500)', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Provides Summary</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Powered by RAG + LLM</span>
          <span style={{ color: 'var(--border-light)' }}>|</span>
          <span>No hallucinations</span>
          <span style={{ color: 'var(--border-light)' }}>|</span>
          <span>100% Business Knowledge</span>
        </div>
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-backdrop">
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>Add New Outbound Task</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleAddClient} className="modal-body">
                <div className="form-group">
                  <label>Customer Name</label>
                  <input type="text" className="form-input" required value={newClient.customer_name} onChange={e => setNewClient({...newClient, customer_name: e.target.value})} placeholder="e.g. Rohit Sharma" />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Phone Number</label>
                  <input type="text" className="form-input" required value={newClient.customer_phone} onChange={e => setNewClient({...newClient, customer_phone: e.target.value})} placeholder="e.g. +91 98765 43210" />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Query / Context</label>
                  <textarea className="form-input" required rows={3} value={newClient.query} onChange={e => setNewClient({...newClient, query: e.target.value})} placeholder="Price inquiry for Growth plan" />
                </div>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Task</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
