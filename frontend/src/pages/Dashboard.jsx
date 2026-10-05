import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Users, Clock, Mic2,
  AlertTriangle, Target, BarChart2, RefreshCw, Loader2
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell
} from 'recharts';
import KpiCard from '../components/KpiCard';
import { getDashboardStats } from '../api/client';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border-light)',
        borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)',
        fontSize: 12
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [dateFilter, setDateFilter] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getDashboardStats(dateFilter);
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchStats();
    
    // Real-time polling every 5 seconds
    const interval = setInterval(() => fetchStats(false), 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !data) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <span style={{ marginLeft: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Loading Real-time Analytics...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="page-content">Failed to load analytics. Ensure the backend is running.</div>;
  }

  const { kpis, charts } = data;

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">
            Executive <span>Dashboard</span>
          </h1>
          <p className="page-desc">Real-time intelligence across all conversations and lead outcomes.</p>
        </div>
        <div className="filters-row">
          {['24h', '7d', '30d', '90d'].map(f => (
            <button
              key={f}
              className={`filter-btn ${dateFilter === f ? 'active' : ''}`}
              onClick={() => setDateFilter(f)}
              id={`date-filter-${f}`}
            >{f}</button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => fetchStats(true)} disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid mb-6">
        <KpiCard icon={MessageSquare} label="Total Conversations" value={kpis.total_conversations} change={`in last ${dateFilter}`} changePositive delay={0} />
        <KpiCard icon={Users} label="Qualified Leads" value={kpis.qualified_leads} change="AI Scored ≥ 70" changePositive delay={0.08}
          color="var(--success)" iconBg="var(--success-bg)" iconColor="var(--success)" />
        <KpiCard icon={Target} label="Conversion Rate" value={kpis.conversion_rate} change="Qualified / Total" changePositive delay={0.16}
          color="var(--info)" iconBg="var(--info-bg)" iconColor="var(--info)" />
        <KpiCard icon={Clock} label="Avg Response Time" value={kpis.avg_response_time} change="Groq Latency" changePositive delay={0.24}
          color="var(--warning)" iconBg="var(--warning-bg)" iconColor="var(--warning)" />
        <KpiCard icon={AlertTriangle} label="Unanswered Qs" value={kpis.unanswered_qs} change="Needs knowledge base update" changePositive={false} delay={0.32}
          color="var(--error)" iconBg="var(--error-bg)" iconColor="var(--error)" />
        <KpiCard icon={Mic2} label="Active Sessions" value={kpis.active_sessions} change="Live now" changePositive delay={0.4}
          color="#8B5CF6" iconBg="#F5F3FF" iconColor="#8B5CF6" />
      </div>

      {/* Charts Row 1 */}
      <div className="section-grid section-grid-2 mb-6" style={{ gap: 20 }}>
        {/* Conversations Area Chart */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Conversations & Outcomes</div>
              <div className="card-subtitle">Daily breakdown — total, qualified, lost</div>
            </div>
            <BarChart2 size={16} color="var(--text-muted)" />
          </div>
          <div className="card-body">
            <div className="chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.conversationData}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradQual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#F97316" strokeWidth={2} fill="url(#gradTotal)" dot={false} />
                  <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#10B981" strokeWidth={2} fill="url(#gradQual)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Response Latency */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Response Latency</div>
              <div className="card-subtitle">p50 and p95 latency in seconds</div>
            </div>
            <Clock size={16} color="var(--text-muted)" />
          </div>
          <div className="card-body">
            <div className="chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.latencyData}>
                  <defs>
                    <linearGradient id="gradP50" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradP95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="s" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="p50" name="p50" stroke="#F97316" strokeWidth={2} fill="url(#gradP50)" dot={false} />
                  <Area type="monotone" dataKey="p95" name="p95" stroke="#3B82F6" strokeWidth={2} fill="url(#gradP95)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="section-grid section-grid-3 mb-6" style={{ gap: 20, gridTemplateColumns: '1fr 1fr 1.2fr' }}>
        {/* Conversion Funnel */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Conversion Funnel</div>
              <div className="card-subtitle">AI-Driven pipeline stages</div>
            </div>
          </div>
          <div className="card-body">
            {charts.funnelData.map((step, i) => (
              <div className="funnel-step" key={step.label}>
                <div className="funnel-label">{step.label}</div>
                <div className="funnel-bar-wrap">
                  <motion.div
                    className="funnel-bar-fill"
                    style={{ width: `${step.pct}%`, opacity: 1 - i * 0.12 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${step.pct}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                  />
                </div>
                <div className="funnel-num">{step.value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Objections Pie */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Objection Breakdown</div>
              <div className="card-subtitle">Top customer concerns</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 160, display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.objectionData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {charts.objectionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {charts.objectionData.map(o => (
                <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: o.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{o.name}</span>
                  <span style={{ fontWeight: 700 }}>{o.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Unanswered Questions */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}
          style={{ borderLeft: '3px solid var(--error)' }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Unanswered Questions</div>
              <div className="card-subtitle">Gaps in knowledge base</div>
            </div>
            <AlertTriangle size={16} color="var(--error)" />
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {charts.unanswered.length === 0 ? (
                 <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, padding: 10 }}>All questions successfully answered!</div>
              ) : charts.unanswered.map((q, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--error-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(239,68,68,0.1)'
                }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                    {q.question}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600 }}>
                    Asked {q.count} times
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions Bar */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {kpis.immediate_followups} leads need immediate follow-up
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            High-priority leads with score ≥ 70 awaiting human review
          </div>
        </div>
        <a href="/voice-agent" className="btn btn-primary" id="start-agent-btn">
          <Mic2 size={14} /> Start New Conversation
        </a>
        <a href="/leads" className="btn btn-secondary" id="view-leads-btn">
          <Users size={14} /> Review Leads
        </a>
      </motion.div>
    </div>
  );
}
