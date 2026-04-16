import { C, SIZE, SHADOW, MOTION, fmtRMCompact } from './shared.js';

export interface SidebarGroup {
  name: string;
  count: number;
  total: number;        // sum of the currently-selected period for this group
  filledCount: number;  // how many rows have a non-zero value
}

interface CategorySidebarProps {
  groups: SidebarGroup[];
  grandTotal: number;
  periodLabel: string;         // e.g. "APR 2026"
  activeGroupName: string;
  onSelect: (name: string) => void;
}

export function CategorySidebar({
  groups, grandTotal, periodLabel, activeGroupName, onSelect,
}: CategorySidebarProps) {
  return (
    <aside style={{
      width: SIZE.sidebarWidth,
      flexShrink: 0,
      background: C.card,
      borderRadius: 14,
      boxShadow: SHADOW.card,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      position: 'sticky',
      top: 24,
    }}>
      {/* KPI — grand total */}
      <div style={{
        padding: '20px 20px 18px',
        background: `linear-gradient(180deg, ${C.primaryLight} 0%, ${C.card} 100%)`,
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}>{periodLabel} Total</div>
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          color: C.textStrong,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>{fmtRMCompact(grandTotal)}</div>
      </div>

      {/* Category list */}
      <div style={{
        padding: '14px 20px 6px',
        fontSize: 10,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>Categories</div>

      <nav style={{ padding: '2px 8px 12px' }}>
        {groups.map(g => {
          const isActive = g.name === activeGroupName;
          return (
            <button
              key={g.name}
              type="button"
              className="occ-tab"
              onClick={() => onSelect(g.name)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                background: isActive ? C.primaryLight : 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 2,
                transition: `background ${MOTION.fast}, color ${MOTION.fast}`,
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 3,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? C.primary : C.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.01em',
                }}>{g.name}</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isActive ? C.primary : (g.total > 0 ? C.textSub : C.mutedMore),
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>{fmtRMCompact(g.total)}</span>
              </div>
              <div style={{
                fontSize: 11,
                color: isActive ? C.primary : C.muted,
                opacity: isActive ? 0.75 : 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {g.count} items
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
