import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

const C = {
  card: '#fff', text: '#1e293b', muted: '#64748b', border: '#e2e8f0', primary: '#5a67d8',
};

export const PILL_HEIGHT = 36;
const PILL_SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04)';

// Shared hover/focus styles for all pill filter controls. Consumers should
// include <FilterPillStyles /> once at the top of their page.
export function FilterPillStyles() {
  return (
    <style>{`
      .pill-select:not(.pill-select--disabled):hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06) !important; }
      .pill-select:not(.pill-select--disabled):focus-within { border-color: ${C.primary}; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15) !important; }
    `}</style>
  );
}

export interface PillOption {
  value: string;
  label: string;
}

export function PillSelect({ icon, value, onChange, options, disabled }: { icon?: IconDefinition; value: string; onChange: (v: string) => void; options: PillOption[]; disabled?: boolean }) {
  const selected = options.find(o => o.value === value);
  return (
    <div
      className={disabled ? 'pill-select pill-select--disabled' : 'pill-select'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: PILL_HEIGHT,
        background: disabled ? '#f8fafc' : C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: '0 12px',
        boxShadow: disabled ? 'none' : PILL_SHADOW,
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, opacity 0.15s',
        minWidth: icon ? 104 : 128,
      }}
    >
      {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 12, color: C.muted }} />}
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: C.text,
        flex: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>
        {selected?.label ?? value}
      </span>
      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: C.muted, marginLeft: 2 }} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function PillToggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: PillOption[] }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: PILL_HEIGHT,
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 3,
      boxShadow: PILL_SHADOW,
    }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              border: 'none',
              background: active ? '#eef2ff' : 'transparent',
              color: active ? C.primary : C.muted,
              padding: '0 14px',
              height: '100%',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
