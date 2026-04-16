import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { TP_C, TP_MOTION, TP_RADIUS } from './tokens.js';
import {
  minutesToTime, fmtRM, computeDailyHours, formatResignedDate, hexAlpha,
} from './helpers.js';
import { ActionMenu } from './ActionMenu.js';

// Loose teacher shape — the planner Teacher type is used broadly as `any` in
// this module. Row-specific fields are documented here.
interface TeacherLike {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  resignedAt?: string | null;
  positionId?: string | null;
  level?: number | null;
  isFixedSalary?: boolean;
  salaryType?: 'hourly' | 'fixed' | string;
  hourlyRate?: number | null;
  workStartMinute?: number | null;
  workEndMinute?: number | null;
  workDays?: number[] | null;
}

interface PositionLike {
  positionId: string;
  name: string;
  maxLevel: number;
}

interface SalaryLike {
  calculatedSalary: number;
  isFixedSalary: boolean;
}

interface TeacherRowProps {
  teacher: TeacherLike;
  position: PositionLike | null | undefined;
  salary: SalaryLike | undefined;
  onClick: () => void;
  onResign: () => void;
}

export const TeacherRow = memo(function TeacherRow({
  teacher: t, position: pos, salary: sal, onClick, onResign,
}: TeacherRowProps) {
  const initial = (t.name ?? '?').trim().charAt(0).toUpperCase();
  const hasSalary = !!sal && sal.calculatedSalary > 0;
  const incomplete = t.isActive && (!pos || !hasSalary);
  const workDaysCount = Array.isArray(t.workDays) ? t.workDays.length : 0;
  const dailyHours = (t.workStartMinute != null && t.workEndMinute != null)
    ? computeDailyHours(t.workStartMinute, t.workEndMinute)
    : null;
  const weeklyHours = dailyHours != null ? dailyHours * workDaysCount : 0;
  const isPartTime = weeklyHours > 0 && weeklyHours < 35;

  return (
    <tr className="tp-row" onClick={onClick}>
      {/* Teacher */}
      <td style={styles.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Avatar color={t.color} initial={initial} muted={!t.isActive} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                ...styles.name,
                color: t.isActive ? TP_C.text : TP_C.muted,
              }}>{t.name}</div>
              {incomplete && <IncompleteChip />}
              {!t.isActive && t.resignedAt && <ResignedChip date={t.resignedAt} />}
            </div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td style={styles.td}>
        {pos ? (
          <RoleCell
            position={pos}
            level={t.level ?? 0}
            showLevel={!t.isFixedSalary}
          />
        ) : (
          <span style={styles.dash}>Not assigned</span>
        )}
      </td>

      {/* Schedule */}
      <td style={styles.td}>
        {t.workStartMinute != null && t.workEndMinute != null ? (
          <ScheduleCell
            start={t.workStartMinute}
            end={t.workEndMinute}
            dailyHours={dailyHours}
            days={workDaysCount}
            isPartTime={isPartTime}
          />
        ) : (
          <span style={styles.dash}>—</span>
        )}
      </td>

      {/* Salary */}
      <td style={{ ...styles.td, textAlign: 'right' }}>
        {hasSalary && sal ? (
          <SalaryCell
            amount={sal.calculatedSalary}
            type={t.salaryType}
            hourlyRate={t.hourlyRate ?? null}
          />
        ) : (
          <span style={styles.dash}>—</span>
        )}
      </td>

      {/* Actions */}
      <td style={{ ...styles.td, padding: '0 12px 0 0', textAlign: 'right' }}>
        <div
          className="tp-actions"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            gap: 2,
            opacity: 0,
            transition: `opacity ${TP_MOTION.fast}`,
          }}
        >
          {t.isActive && <ActionMenu onResign={onResign} />}
        </div>
      </td>
    </tr>
  );
});

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ color, initial, muted }: { color: string; initial: string; muted: boolean }) {
  const bg = muted ? TP_C.subtle : hexAlpha(color, 0.14);
  const fg = muted ? TP_C.mutedMore : color;
  const ring = muted ? TP_C.borderSoft : hexAlpha(color, 0.28);
  return (
    <span style={{
      width: 38,
      height: 38,
      borderRadius: '50%',
      background: bg,
      color: fg,
      border: `1px solid ${ring}`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 700,
      flexShrink: 0,
      letterSpacing: '0.01em',
      boxSizing: 'border-box',
    }}>{initial}</span>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────────

function IncompleteChip() {
  return (
    <span
      title="Position or salary missing"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 700,
        borderRadius: TP_RADIUS.chip,
        background: TP_C.amberBg,
        color: TP_C.amber,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 9 }} />
      Incomplete
    </span>
  );
}

function ResignedChip({ date }: { date: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 700,
      borderRadius: TP_RADIUS.chip,
      background: TP_C.subtle,
      color: TP_C.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      Resigned · {formatResignedDate(date)}
    </span>
  );
}

// ── RoleCell ─────────────────────────────────────────────────────────────────

function RoleCell({ position: pos, level, showLevel }: {
  position: PositionLike;
  level: number;
  showLevel: boolean;
}) {
  const atMax = showLevel && pos.maxLevel > 0 && level === pos.maxLevel;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: TP_C.text,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>{pos.name}</div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 3,
        fontSize: 11,
        color: TP_C.mutedMore,
        fontWeight: 500,
      }}>
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: TP_C.muted,
        }}>{pos.positionId}</span>
        {showLevel && pos.maxLevel > 0 && (
          <>
            <span style={{ color: TP_C.dim }}>·</span>
            <span style={{
              color: atMax ? TP_C.primary : TP_C.mutedMore,
              fontWeight: atMax ? 700 : 500,
            }}>L{level}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── ScheduleCell ─────────────────────────────────────────────────────────────

function ScheduleCell({ start, end, dailyHours, days, isPartTime }: {
  start: number;
  end: number;
  dailyHours: number | null;
  days: number;
  isPartTime: boolean;
}) {
  const hoursLabel = dailyHours != null
    ? dailyHours.toFixed(1).replace(/\.0$/, '')
    : null;

  return (
    <div>
      <div style={{
        fontSize: 13,
        color: TP_C.textSub,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.005em',
      }}>
        {minutesToTime(start)} – {minutesToTime(end)}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginTop: 3,
        fontSize: 11,
        color: TP_C.mutedMore,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {hoursLabel != null && (
          <span>{hoursLabel}h · {days}d</span>
        )}
        {isPartTime && <span style={styles.partTimeChip}>Part-time</span>}
      </div>
    </div>
  );
}

// ── SalaryCell ───────────────────────────────────────────────────────────────

function SalaryCell({ amount, type, hourlyRate }: {
  amount: number;
  type?: string;
  hourlyRate?: number | null;
}) {
  const isHourly = type === 'hourly';
  return (
    <div>
      <div style={{
        fontSize: 14,
        fontWeight: 800,
        color: TP_C.text,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.015em',
      }}>{fmtRM(amount)}</div>
      {isHourly && hourlyRate != null && hourlyRate > 0 && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: TP_C.mutedMore,
          marginTop: 3,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtRM(hourlyRate)}<span style={{ letterSpacing: '-0.005em' }}>/hr</span>
        </div>
      )}
      {!isHourly && type === 'fixed' && (
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: TP_C.mutedMore,
          marginTop: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>Fixed</div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  td: {
    padding: '16px 16px',
    borderBottom: `1px solid ${TP_C.divider}`,
    fontSize: 13,
    color: TP_C.text,
    verticalAlign: 'middle' as const,
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    color: TP_C.text,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  dash: { color: TP_C.dim, fontSize: 12, fontStyle: 'italic' as const },
  partTimeChip: {
    padding: '1px 6px',
    borderRadius: 4,
    background: TP_C.primaryLight,
    color: TP_C.primary,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
};
