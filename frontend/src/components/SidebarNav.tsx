import React, { useState, useEffect } from 'react';
import { StudioMode } from '../types/mode';
import { CircuitIndexEntry } from '../types/circuit';
import { circuitStore } from '../services/circuitStore';
import { useTheme } from '../context/ThemeContext';

interface SidebarNavProps {
  appMode: StudioMode;
  collapsed: boolean;
  onModeChange: (mode: StudioMode) => void;
  onToggle: () => void;
  onCircuitSelect: (arch: string) => void;
  onOpenPaper?: () => void;
  onOpenDocs?: () => void;
  onOpenCircuitHub?: () => void;
  refreshTrigger?: number;
}

const MODES: { mode: StudioMode; icon: string; label: string; badge: string }[] = [
  { mode: 'builder',          icon: '🎨', label: 'Circuit Builder',  badge: 'DRAG' },
  { mode: 'verilog-studio',   icon: '📐', label: 'Verilog Studio',   badge: 'LOGISIM' },
  { mode: 'single-gate-lab',  icon: '🔬', label: 'Single Gate Lab',  badge: '28+' },
  { mode: 'live-simulation',  icon: '⚡', label: 'Live Simulation',  badge: 'STEP' },
  { mode: 'qml-lab',          icon: '🧠', label: 'QML Lab',          badge: 'VQC' },
];

const FALLBACK_CIRCUITS: { icon: string; label: string; desc: string; arch: string }[] = [
  { icon: '🔗', label: '1-Bit ALU',     desc: '28 ops',     arch: '1_bit_alu_clifford_t' },
  { icon: '🔷', label: 'FALFG Gate',    desc: '5×5',        arch: 'falfg_5x5' },
  { icon: '🔀', label: 'Fredkin CSWAP', desc: '3-qubit',    arch: 'fredkin_cswap' },
  { icon: '➕', label: 'Bennett Adder', desc: 'Uncomputed', arch: 'bennett_adder' },
];

const W_FULL = 188;
const W_MINI = 46;

export const SidebarNav: React.FC<SidebarNavProps> = ({
  appMode,
  collapsed,
  onModeChange,
  onToggle,
  onCircuitSelect,
  onOpenPaper,
  onOpenDocs,
  onOpenCircuitHub,
  refreshTrigger,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [storedCircuits, setStoredCircuits] = useState<CircuitIndexEntry[]>([]);

  useEffect(() => {
    circuitStore.getCatalog(refreshTrigger !== undefined && refreshTrigger > 0)
      .then((res) => setStoredCircuits(res.circuits))
      .catch((err) => console.warn('Sidebar could not fetch circuits:', err));

    const unsubscribe = circuitStore.subscribe(() => {
      circuitStore.getCatalog()
        .then((res) => setStoredCircuits(res.circuits))
        .catch(() => {});
    });
    return unsubscribe;
  }, [refreshTrigger]);

  const w = collapsed ? W_MINI : W_FULL;

  return (
    <aside style={{
      width: w,
      minWidth: w,
      maxWidth: w,
      background: 'rgba(11, 17, 32, 0.98)',
      borderRight: '1px solid var(--card-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1), max-width 0.25s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      fontSize: 12,
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '8px 0' : '8px 10px',
        borderBottom: '1px solid var(--card-border)',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.25)',
        height: 38,
      }}>
        {!collapsed && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>
            Workspaces
          </span>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            border: '1px solid var(--card-border)',
            borderRadius: 4,
            color: '#64748b',
            cursor: 'pointer',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            transition: 'background 0.12s, color 0.12s',
            flexShrink: 0,
          }}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 4px' }}>
        {/* Modes section */}
        {!collapsed && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', padding: '6px 6px 3px' }}>
            Modes
          </div>
        )}
        {MODES.map(item => (
          <SideItem
            key={item.mode}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            active={appMode === item.mode}
            collapsed={collapsed}
            onClick={() => onModeChange(item.mode)}
          />
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 6px' }} />

        {/* Circuits section */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px 3px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569' }}>
              Circuits ({storedCircuits.length > 0 ? storedCircuits.length : 4})
            </span>
          </div>
        )}

        {/* Dedicated Circuit Hub & Library Modal Launcher */}
        <SideItem
          icon="📦"
          label="Circuit Hub"
          badge="HUB"
          active={false}
          collapsed={collapsed}
          onClick={() => onOpenCircuitHub?.()}
        />

        {storedCircuits.length > 0
          ? storedCircuits.map((c) => {
              let icon = '🔗';
              if (c.id.includes('falfg')) icon = '🔷';
              else if (c.id.includes('fredkin') || c.id.includes('cswap')) icon = '🔀';
              else if (c.id.includes('bennett') || c.id.includes('adder')) icon = '➕';
              else if (!c.readonly) icon = '💾';

              const badge = `${c.num_qubits}Q`;

              return (
                <SideItem
                  key={c.id}
                  icon={icon}
                  label={c.name}
                  badge={collapsed ? '' : badge}
                  active={false}
                  collapsed={collapsed}
                  onClick={() => {
                    onModeChange('live-simulation');
                    onCircuitSelect(c.id);
                  }}
                />
              );
            })
          : FALLBACK_CIRCUITS.map((c) => (
              <SideItem
                key={c.label}
                icon={c.icon}
                label={c.label}
                badge={c.desc}
                active={false}
                collapsed={collapsed}
                onClick={() => {
                  onModeChange('live-simulation');
                  onCircuitSelect(c.arch);
                }}
              />
            ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--card-border)', margin: '6px 6px' }} />

        {/* Info */}
        {!collapsed && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', padding: '3px 6px 3px' }}>
            Info
          </div>
        )}
        <SideItem
          icon="📄"
          label="IEEE TETC Paper"
          badge=""
          active={false}
          collapsed={collapsed}
          onClick={() => onOpenPaper?.()}
        />
        <SideItem
          icon="📖"
          label="Docs"
          badge=""
          active={false}
          collapsed={collapsed}
          onClick={() => onOpenDocs?.()}
        />
        <SideItem
          icon={theme === 'dark' ? '☀️' : '🌙'}
          label={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          badge=""
          active={false}
          collapsed={collapsed}
          onClick={toggleTheme}
        />
      </div>

      {/* Footer */}
      {!collapsed && (
        <div style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--card-border)',
          flexShrink: 0,
          fontSize: 9,
          color: '#475569',
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, color: '#64748b', marginBottom: 1 }}>Quantum ALU Studio v3.0</div>
          <div>Clifford+T · NCV · PennyLane</div>
          <div>IEEE TETC 2026</div>
        </div>
      )}
    </aside>
  );
};

/* ── Reusable sidebar item ───────────────────────────────────────────────── */
interface SideItemProps {
  icon: string;
  label: string;
  badge: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SideItem: React.FC<SideItemProps> = ({ icon, label, badge, active, collapsed, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? `${label}${badge ? ` (${badge})` : ''}` : undefined}
      aria-label={label}
      data-testid={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        padding: collapsed ? '7px 0' : '7px 8px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 5,
        border: 'none',
        background: active
          ? 'linear-gradient(90deg, rgba(59,130,246,0.2), rgba(6,182,212,0.08))'
          : hovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
        color: active ? '#60a5fa' : hovered ? 'var(--text-main)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        marginBottom: 1,
        transition: 'all 0.12s ease',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: '0.9rem', flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: 11,
          display: collapsed ? 'none' : 'inline',
        }}
        className="sidebar-item-label"
      >
        {label}
      </span>
      {!collapsed && badge && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
          color: active ? '#60a5fa' : '#475569',
          padding: '1px 5px',
          borderRadius: 99,
          flexShrink: 0,
        }}>{badge}</span>
      )}
    </button>
  );
};
