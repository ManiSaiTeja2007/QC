import React, { useState, useRef, useEffect, useCallback } from 'react';

interface FloatingToolboxProps {
  title: string;
  defaultPosition?: { x: number; y: number };
  collapsedByDefault?: boolean;
  children: React.ReactNode;
  width?: number;
  /** Accent color for the header left border */
  accentColor?: string;
}

/**
 * Reusable draggable, collapsible floating toolbox panel.
 * Used for quantum gate palette (Builder), classical logic gate palette (Verilog Studio),
 * and the cross-verify panel (Live Simulation).
 *
 * position: fixed — floats above canvas content, below modals.
 */
export const FloatingToolbox: React.FC<FloatingToolboxProps> = ({
  title,
  defaultPosition = { x: 16, y: 120 },
  collapsedByDefault = false,
  children,
  width = 230,
  accentColor = '#3b82f6',
}) => {
  const [pos, setPos] = useState(defaultPosition);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag on the header itself, not the collapse button
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    },
    [pos]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - width, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset.current.y));
      setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [width]);

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width,
        zIndex: 200,
        background: 'rgba(9, 15, 29, 0.97)',
        border: '1px solid #1e293b',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Drag handle header */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px 6px 10px',
          background: '#0b1222',
          cursor: isDragging.current ? 'grabbing' : 'grab',
          gap: 6,
          borderBottom: collapsed ? 'none' : '1px solid #1a2744',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: '0.70rem',
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          {title}
        </span>

        {/* Drag indicator */}
        <span style={{ color: '#334155', fontSize: '0.65rem', letterSpacing: 1 }}>⠿</span>

        {/* Collapse / expand button */}
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            lineHeight: 1.4,
            fontWeight: 700,
          }}
          title={collapsed ? 'Expand toolbox' : 'Collapse toolbox'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <div
          style={{
            maxHeight: '65vh',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
