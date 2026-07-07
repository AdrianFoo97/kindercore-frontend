import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { Settings } from '../../types/index.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#0f172a',
  muted: '#64748b',
  divider: '#f1f5f9',
  green: '#059669',
  indigo: '#4f46e5',
  red: '#dc2626',
};

// Single source of truth for the defaults — matches the fallbacks used by
// TeacherCompensationPage when settings haven't been saved yet.
export const DEFAULT_PERFORMER_THRESHOLD = 60;
export const DEFAULT_HIGH_PERFORMER_THRESHOLD = 80;

export const PERFORMER_THRESHOLD_KEY = 'minimum_appraisal_for_eligibility';
export const HIGH_PERFORMER_THRESHOLD_KEY = 'high_performer_appraisal_threshold';

export function readScore(settings: Settings | undefined, key: string, fallback: number): number {
  const v = settings?.[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : fallback;
}

export default function CompensationSettingsPage() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const performer = readScore(settings, PERFORMER_THRESHOLD_KEY, DEFAULT_PERFORMER_THRESHOLD);
  const highPerformer = readScore(settings, HIGH_PERFORMER_THRESHOLD_KEY, DEFAULT_HIGH_PERFORMER_THRESHOLD);

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Compensation Settings</h1>
        <p style={{ margin: '4px 0 20px', fontSize: 13, color: C.muted }}>
          Appraisal score thresholds that gate the Performer and High-Performer tiers on the Teacher Compensation page.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ThresholdCard
            settings={settings}
            settingKey={PERFORMER_THRESHOLD_KEY}
            fallback={DEFAULT_PERFORMER_THRESHOLD}
            otherThreshold={highPerformer}
            otherIsUpperBound
            title="Performer Threshold"
            description="Minimum appraisal score for Standing Benefits eligibility (Medical, Loyalty, Snack & Tea, Annual Team Building, Annual Dinner, Internal Training Program). Default is 60."
          />
          <ThresholdCard
            settings={settings}
            settingKey={HIGH_PERFORMER_THRESHOLD_KEY}
            fallback={DEFAULT_HIGH_PERFORMER_THRESHOLD}
            otherThreshold={performer}
            otherIsUpperBound={false}
            title="High-Performer Threshold"
            description="Score required for the High-Performer tier (Semi-Flexible Hours, Conditional Annual Leave, and gateway to Shareholding & Partnership programs). Default is 80."
          />
        </div>
      </div>
    </div>
  );
}

function ThresholdCard({
  settings,
  settingKey,
  fallback,
  otherThreshold,
  otherIsUpperBound,
  title,
  description,
}: {
  settings: Settings | undefined;
  settingKey: string;
  fallback: number;
  /** The other threshold's current value — used to validate ordering. */
  otherThreshold: number;
  /** When true, this threshold must be strictly less than `otherThreshold`
   *  (e.g. Performer < High-Performer). When false, must be greater. */
  otherIsUpperBound: boolean;
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const initial = readScore(settings, settingKey, fallback);

  const [scoreInput, setScoreInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings && scoreInput === '') {
      setScoreInput(String(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const parsed = parseInt(scoreInput, 10);
  const isWithinRange = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const orderingOK = otherIsUpperBound ? parsed < otherThreshold : parsed > otherThreshold;
  const isValid = isWithinRange && orderingOK;
  const dirty = isValid && parsed !== initial;

  const orderingMessage = otherIsUpperBound
    ? `Must be below the High-Performer threshold (${otherThreshold}).`
    : `Must be above the Performer threshold (${otherThreshold}).`;

  const save = async () => {
    if (!isWithinRange) {
      setError('Enter a score between 0 and 100.');
      return;
    }
    if (!orderingOK) {
      setError(orderingMessage);
      return;
    }
    setSaving(true); setError('');
    try {
      await patchSetting(settingKey, parsed);
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
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score (0–100)</span>
        <div style={{ display: 'flex', alignItems: 'stretch', maxWidth: 220 }}>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={scoreInput}
            onChange={e => { setScoreInput(e.target.value); setError(''); setSavedAt(null); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 16,
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              outline: 'none',
              fontFamily: 'inherit',
              color: C.text,
              fontVariantNumeric: 'tabular-nums' as any,
              background: '#fff',
            }}
          />
        </div>
      </label>

      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: C.red }}>{error}</p>}

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
