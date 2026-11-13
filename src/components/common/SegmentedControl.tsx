// iOS-style segmented control — one choice among closely related views of the
// same list (design guide: equal-width segments, ≤ 5 on iPhone, text only,
// selection only — never actions). For several filters on at once use toggle
// chips; for whole sections use the tab bar.

export interface Segment<K extends string> {
  key: K;
  label: string;
  /** Shown after the label, e.g. how many items are in that view. */
  count?: number;
}

interface Props<K extends string> {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  /** The selected segment's text colour (the page accent). */
  accent?: string;
}

export default function SegmentedControl<K extends string>({ segments, value, onChange, ariaLabel, accent = '#0f172a' }: Props<K>) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{
      display: 'grid', gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`, gap: 2,
      padding: 2, borderRadius: 10, background: '#eef0f4',
    }}>
      {segments.map(s => {
        const on = s.key === value;
        return (
          <button key={s.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(s.key)} className="tap" style={{
            minHeight: 36, padding: '0 8px', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13,
            fontWeight: on ? 700 : 600, color: on ? accent : '#475569', background: on ? '#fff' : 'transparent',
            boxShadow: on ? '0 1px 3px rgba(15,23,42,0.12)' : 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0,
            WebkitTapHighlightColor: 'transparent', transition: 'background-color 150ms, color 150ms',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            {s.count !== undefined && (
              <span style={{ fontSize: 12, fontWeight: 700, color: on ? accent : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
