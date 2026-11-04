import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// The "⋯" menu on an onboarding card. Items come in groups, separated by a
// thin line — each page supplies its own (View Tasks, WhatsApp Parent, …).

export interface ActionMenuItem {
  icon: IconDefinition;
  label: string;
  onClick: () => void;
  iconColor?: string;
}

export function ActionMenu({ groups }: { groups: ActionMenuItem[][] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleGroups = groups.filter(g => g.length > 0);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? '#f1f5f9' : 'none', border: '1px solid',
          borderColor: open ? '#cbd5e1' : '#e2e8f0',
          borderRadius: 8, cursor: 'pointer', fontSize: 16, color: '#64748b',
          lineHeight: 1,
        }}
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)', minWidth: 190, padding: '4px 0',
        }}>
          {visibleGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div style={{ height: 1, background: '#f1f5f9', margin: '4px 8px' }} />}
              <div style={{ padding: '2px 4px' }}>
                {group.map(item => (
                  <button
                    key={item.label}
                    onClick={() => { item.onClick(); setOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
                      textAlign: 'left' as const, background: 'none', border: 'none',
                      fontSize: 13, fontWeight: 400, cursor: 'pointer', color: '#374151', borderRadius: 6,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eef1f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <FontAwesomeIcon icon={item.icon} fixedWidth style={{ color: item.iconColor ?? '#64748b', fontSize: 12 }} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
