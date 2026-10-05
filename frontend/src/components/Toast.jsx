import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const icons = {
  success: { Icon: CheckCircle, color: 'var(--success)', bg: 'var(--success-bg)' },
  error:   { Icon: XCircle,     color: 'var(--error)',   bg: 'var(--error-bg)' },
  warning: { Icon: AlertCircle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
  info:    { Icon: Info,        color: 'var(--info)',    bg: 'var(--info-bg)' },
};

let addToast;

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToast = ({ type = 'info', title, message, duration = 4000 }) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, type, title, message }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
      }
    };
  }, []);

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(toast => {
          const { Icon, color, bg } = icons[toast.type] || icons.info;
          return (
            <motion.div
              key={toast.id}
              className="toast"
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="toast-icon" style={{ background: bg }}>
                <Icon size={16} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                {toast.title && <div className="toast-title">{toast.title}</div>}
                {toast.message && <div className="toast-msg">{toast.message}</div>}
              </div>
              <button
                onClick={() => setToasts(p => p.filter(t => t.id !== toast.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const toast = {
  success: (title, message) => addToast?.({ type: 'success', title, message }),
  error:   (title, message) => addToast?.({ type: 'error', title, message }),
  warning: (title, message) => addToast?.({ type: 'warning', title, message }),
  info:    (title, message) => addToast?.({ type: 'info', title, message }),
};
