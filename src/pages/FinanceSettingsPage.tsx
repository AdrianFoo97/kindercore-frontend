import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent, faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { Settings } from '../types/index.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  divider: '#f1f5f9',
  green: '#059669',
  indigo: '#4f46e5',
};

export const DEFAULT_EXPENSE_RATIO_TARGET = 0.8; // 80%
export const DEFAULT_PROFIT_SHARE_PERCENT = 0.04; // 4%
export const DEFAULT_ANNUAL_BONUS_PERCENT = 0.02; // 2%

function readPercent(settings: Settings | undefined, key: string, fallback: number, max: number) {
  const v = settings?.[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? n : fallback;
}

export default function FinanceSettingsPage() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Finance Settings</h1>
        <p style={{ margin: '4px 0 20px', fontSize: 13, color: C.muted }}>
          Targets and thresholds used by the Finance Analysis dashboards.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PercentSettingCard
            settings={settings}
            settingKey="expense_ratio_target"
            fallback={DEFAULT_EXPENSE_RATIO_TARGET}
            max={2}
            maxPercentInput={200}
            title="Expense Ratio Target"
            description="Target ceiling for total expenses (staff + operating) as a share of revenue. The Revenue card on Finance Analysis shows actual expenses versus this target. Default is 80%."
          />
          <PercentSettingCard
            settings={settings}
            settingKey="profit_share_percent"
            fallback={DEFAULT_PROFIT_SHARE_PERCENT}
            max={1}
            maxPercentInput={100}
            title="Profit Share Percent"
            description="Share of quarterly revenue paid out as profit-share when the Expense Ratio Target is met for the quarter. The pool drops to RM 0 if the target isn't met. Default is 4%."
          />
          <PercentSettingCard
            settings={settings}
            settingKey="annual_bonus_percent"
            fallback={DEFAULT_ANNUAL_BONUS_PERCENT}
            max={1}
            maxPercentInput={100}
            title="Annual Bonus Percent"
            description="Share of annual revenue paid out as the year-end bonus pool, summed across months that met the Expense Ratio Target. Months that miss the target contribute RM 0. Default is 2%."
          />
        </div>
      </div>
    </div>
  );
}

function PercentSettingCard({
  settings,
  settingKey,
  fallback,
  max,
  maxPercentInput,
  title,
  description,
}: {
  settings: Settings | undefined;
  settingKey: string;
  fallback: number;
  max: number;
  maxPercentInput: number;
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const initial = readPercent(settings, settingKey, fallback, max);

  const [percentInput, setPercentInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings && percentInput === '') {
      setPercentInput((initial * 100).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const parsedPercent = parseFloat(percentInput);
  const isValid = Number.isFinite(parsedPercent) && parsedPercent > 0 && parsedPercent <= maxPercentInput;
  const dirty = isValid && Math.abs(parsedPercent / 100 - initial) > 1e-6;

  const save = async () => {
    if (!isValid) {
      setError(`Enter a percentage between 1 and ${maxPercentInput}.`);
      return;
    }
    setSaving(true); setError('');
    try {
      await patchSetting(settingKey, parsedPercent / 100);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h2>
      <p style={{ margin: '4px 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        {description}
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target (%)</span>
        <div style={{ display: 'flex', alignItems: 'stretch', maxWidth: 220 }}>
          <input
            type="number"
            min={0}
            max={maxPercentInput}
            step={0.1}
            value={percentInput}
            onChange={e => { setPercentInput(e.target.value); setError(''); setSavedAt(null); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 16,
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              outline: 'none',
              fontFamily: 'inherit',
              color: C.text,
              fontVariantNumeric: 'tabular-nums' as any,
              background: '#fff',
            }}
          />
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 14px',
            fontSize: 13,
            color: C.muted,
            background: '#f8fafc',
            border: `1px solid ${C.border}`,
            borderRadius: '0 8px 8px 0',
            fontWeight: 600,
          }}>
            <FontAwesomeIcon icon={faPercent} />
          </span>
        </div>
      </label>

      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            background: dirty && !saving ? C.indigo : '#cbd5e1',
            color: '#fff',
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.green, fontWeight: 600 }}>
            <FontAwesomeIcon icon={faCheck} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
