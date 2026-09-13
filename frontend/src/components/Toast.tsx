import React, { useEffect } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warn';
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<Toast['type'], string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warn: '⚠️',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}`}
      onClick={() => onDismiss(toast.id)}
      style={{ cursor: 'pointer' }}
    >
      <span>{ICONS[toast.type]}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>✕</span>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
