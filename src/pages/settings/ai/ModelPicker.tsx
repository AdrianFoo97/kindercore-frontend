import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAiModels, type ProviderId } from '../../../api/ai.js';
import { S, SC } from '../cardStyles.js';

// Settings → AI: choose a model from the list the provider gives for this
// key (no guessing names). "Other…" is there for a model the list doesn't
// show yet — the only time anyone types one.

const OTHER = '__other';

export interface ModelPickerProps {
  provider: ProviderId;
  /** The provider has a usable key — the list can be loaded. */
  hasKey: boolean;
  /** The chosen model ('' = the empty option below). */
  value: string;
  onChange: (model: string) => void;
  /** What the empty option means, e.g. "Default — claude-opus-5-5"; null = nothing chosen yet. */
  emptyLabel: string | null;
  disabled?: boolean;
  label: string;
}

export function ModelPicker({ provider, hasKey, value, onChange, emptyLabel, disabled = false, label }: ModelPickerProps) {
  const { data, isLoading } = useQuery({ queryKey: ['ai-models', provider], queryFn: () => fetchAiModels(provider), enabled: hasKey, staleTime: 10 * 60_000 });
  const models = data?.models ?? [];
  const listed = models.some(m => m.id === value);
  const [typing, setTyping] = useState(false);
  const other = typing || (value !== '' && !listed && !isLoading);

  const selectValue = other ? OTHER : value;
  const pick = (v: string) => {
    if (v === OTHER) { setTyping(true); return; }
    setTyping(false);
    onChange(v);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select aria-label={label} value={selectValue} disabled={disabled || (!hasKey && !value)} onChange={e => pick(e.target.value)}
        style={{ ...S.input, cursor: disabled || (!hasKey && !value) ? 'default' : 'pointer' }}>
        {emptyLabel !== null ? <option value="">{emptyLabel}</option> : <option value="" disabled>{hasKey ? 'Choose a model…' : 'Add a key to choose a model'}</option>}
        {isLoading && <option value="__loading" disabled>Loading models…</option>}
        {models.map(m => <option key={m.id} value={m.id}>{m.label === m.id ? m.id : `${m.label} (${m.id})`}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {other && (
        <input aria-label={`${label} (typed)`} autoFocus={typing} value={value} maxLength={80} disabled={disabled}
          placeholder="Model name exactly as the provider writes it" onChange={e => onChange(e.target.value.trim())} style={S.input} />
      )}
      {hasKey && data?.message && <span style={{ ...S.hint, color: SC.danger }}>{data.message}</span>}
    </div>
  );
}
