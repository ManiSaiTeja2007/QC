import React, { useEffect } from 'react';

interface Props { onClose: () => void; }

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: 'Ctrl+1', desc: 'Circuit Builder' },
  { key: 'Ctrl+2', desc: 'Single Gate Lab' },
  { key: 'Ctrl+3', desc: 'Live Simulation' },
  { key: 'Ctrl+4', desc: 'QML Lab' },
  { key: 'Ctrl+B', desc: 'Toggle sidebar' },
  { key: '?',      desc: 'Show / hide this help' },
  { key: 'Space',  desc: 'Play / Pause simulation' },
  { key: '←  →',  desc: 'Step backward / forward' },
  { key: 'Home',   desc: 'Jump to step 0' },
  { key: 'End',    desc: 'Jump to last step' },
  { key: 'Esc',    desc: 'Close modal / deselect' },
];

export const KeyboardHelpModal: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span>⌨️</span> Keyboard Shortcuts
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '12px 20px' }}>
          <table className="info-table" style={{ width: '100%' }}>
            <tbody>
              {SHORTCUTS.map(s => (
                <tr key={s.key}>
                  <td><span className="kbd">{s.key}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 400 }}>
                    {s.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
