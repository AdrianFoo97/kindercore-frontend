import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { FormStep, StepKey } from './formSteps.js';
import { C } from './formTheme.js';

interface Props {
  steps: FormStep[];
  current: StepKey;
  onSelect: (key: StepKey) => void;
  /** Show ready / to-fix on each tab (drafts only). */
  showStatus: boolean;
}

/**
 * The appraisal form's three parts as tabs: "1 Basics · 2 What's scored ·
 * 3 Who appraises", each with a tick when ready or how many things it still
 * needs (icon + number, never colour alone). Arrow keys move between tabs.
 */
export default function FormTabs({ steps, current, onSelect, showStatus }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const next = (i + by + steps.length) % steps.length;
    onSelect(steps[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Form parts" style={{
      // Narrow screens wrap the tabs rather than scrolling them.
      display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 16,
    }}>
      <style>{'.af-tab:hover { color: #0f172a; background: #f1f5f9; }'}</style>
      {steps.map((s, i) => {
        const on = s.key === current;
        const todo = s.issues.length;
        return (
          <button key={s.key} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`af-tab-${s.key}`}
            aria-selected={on} aria-controls={`af-panel-${s.key}`} tabIndex={on ? 0 : -1}
            className={on ? undefined : 'af-tab'} onClick={() => onSelect(s.key)} onKeyDown={e => onKey(e, i)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px',
              border: 'none', borderBottom: `2px solid ${on ? C.primary : 'transparent'}`, borderRadius: '8px 8px 0 0',
              background: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap',
              color: on ? C.text : C.muted, cursor: 'pointer',
            }}>
            <span aria-hidden style={{
              width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, background: on ? C.primary : C.primarySoft, color: on ? '#fff' : C.primary,
            }}>{s.number}</span>
            {s.title}
            {showStatus && (todo
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: C.amber }}>
                  <FontAwesomeIcon icon={faTriangleExclamation} /> {todo}<span style={visuallyHidden}> to fix</span>
                </span>
              : <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.green }} aria-label="Ready" />)}
          </button>
        );
      })}
    </div>
  );
}

const visuallyHidden: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
