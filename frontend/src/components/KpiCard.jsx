import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({ icon: Icon, label, value, change, changePositive, color = 'var(--orange-400)', iconBg = 'var(--orange-50)', iconColor = 'var(--orange-500)', delay = 0 }) {
  return (
    <motion.div
      className="kpi-card"
      style={{ '--accent': color }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      <div className="kpi-icon-wrap" style={{ '--icon-bg': iconBg, '--icon-color': iconColor }}>
        <Icon size={20} />
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {change && (
        <div className={`kpi-change ${changePositive ? 'positive' : 'negative'}`}>
          {changePositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {change}
        </div>
      )}
    </motion.div>
  );
}
