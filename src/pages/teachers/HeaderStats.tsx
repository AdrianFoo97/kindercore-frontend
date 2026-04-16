import { Fragment } from 'react';
import { TP_C, TP_RADIUS } from './tokens.js';

export interface HeaderStatsData {
  total: number;
  fullTime: number;
  partTime: number;
}

interface HeaderStatsProps {
  stats: HeaderStatsData;
}

type Tone = 'default' | 'muted';

interface StatItem {
  value: string;
  label: string;
  dotColor: string;
  tone: Tone;
}

export function HeaderStats({ stats }: HeaderStatsProps) {
  const items: StatItem[] = [
    {
      value: String(stats.total),
      label: 'Staff',
      dotColor: TP_C.primary,
      tone: 'default',
    },
    {
      value: String(stats.fullTime),
      label: 'Full-time',
      dotColor: stats.fullTime > 0 ? TP_C.green : TP_C.dim,
      tone: stats.fullTime === 0 ? 'muted' : 'default',
    },
    {
      value: String(stats.partTime),
      label: 'Part-time',
      dotColor: stats.partTime > 0 ? TP_C.amber : TP_C.dim,
      tone: stats.partTime === 0 ? 'muted' : 'default',
    },
  ];

  return (
    <div style={styles.wrap}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <div style={styles.divider} />}
          <div style={styles.item}>
            <div style={styles.labelRow}>
              <span style={{
                ...styles.dot,
                background: item.dotColor,
              }} />
              <span style={styles.label}>{item.label}</span>
            </div>
            <div style={{
              ...styles.value,
              color: item.tone === 'muted' ? TP_C.mutedMore : TP_C.text,
            }}>{item.value}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: '18px 28px',
    background: TP_C.card,
    border: `1px solid ${TP_C.borderSoft}`,
    borderRadius: TP_RADIUS.card,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
    marginBottom: 20,
  },
  item: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 6,
    minWidth: 96,
  },
  labelRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    color: TP_C.mutedMore,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  value: {
    fontSize: 22,
    fontWeight: 800,
    color: TP_C.text,
    letterSpacing: '-0.025em',
    fontVariantNumeric: 'tabular-nums' as const,
    lineHeight: 1.1,
  },
  divider: {
    width: 1,
    background: TP_C.borderSoft,
    margin: '0 32px',
  },
};
