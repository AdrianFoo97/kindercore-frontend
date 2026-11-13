import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { moveItem, newPoint, type DraftPoint } from './appraisalFormDraft.js';
import { C, btn, iconBtn, input, label } from './formTheme.js';

interface Props {
  criterionName: string;
  points: DraftPoint[];
  onChange: (points: DraftPoint[]) => void;
}

/**
 * The optional third level: what a criterion is judged on (e.g. "Love and
 * patience" → "Speaks calmly", "Comforts upset children"). None = the
 * criterion is scored as one item. Return in a point adds the next one.
 */
export default function CriterionPoints({ criterionName, points, onChange }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const focusPoint = (index: number) =>
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLInputElement>('input')[index]?.focus());
  const add = (at = points.length) => {
    onChange([...points.slice(0, at), newPoint(), ...points.slice(at)]);
    focusPoint(at);
  };
  const rename = (key: string, name: string) => onChange(points.map(p => (p.key === key ? { ...p, name } : p)));
  const who = criterionName.trim() || 'this criterion';

  return (
    <div style={{ marginTop: 16 }}>
      <div style={label}>Points to look at <span style={{ fontWeight: 400, color: C.muted, marginLeft: 4 }}>Optional</span></div>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 8px', lineHeight: 1.5 }}>
        {points.length
          ? `Each point is scored the way set below. “${who}” scores the average of its points.`
          : `Add points if “${who}” is judged on several things. Leave empty to score it as one item.`}
      </p>
      {points.length > 0 && (
        <ol ref={list} style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'grid', gap: 8 }}>
          {points.map((p, i) => (
            <li key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden style={{ width: 20, fontSize: 13, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
              <input
                aria-label={`Point ${i + 1}`} style={{ ...input, marginLeft: 4 }} maxLength={191} value={p.name}
                placeholder={i === 0 ? 'e.g. Speaks calmly to children' : 'Point'}
                onChange={e => rename(p.key, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(i + 1); } }}
              />
              <button type="button" style={{ ...iconBtn, color: i === 0 ? C.borderStrong : C.muted, cursor: i === 0 ? 'default' : 'pointer' }}
                disabled={i === 0} aria-label={`Move point ${i + 1} up`} title="Move up" onClick={() => onChange(moveItem(points, i, -1))}>
                <FontAwesomeIcon icon={faArrowUp} />
              </button>
              <button type="button" style={{ ...iconBtn, color: i === points.length - 1 ? C.borderStrong : C.muted, cursor: i === points.length - 1 ? 'default' : 'pointer' }}
                disabled={i === points.length - 1} aria-label={`Move point ${i + 1} down`} title="Move down" onClick={() => onChange(moveItem(points, i, 1))}>
                <FontAwesomeIcon icon={faArrowDown} />
              </button>
              <button type="button" style={iconBtn} aria-label={`Remove point ${i + 1}`} title="Remove" onClick={() => onChange(points.filter(x => x.key !== p.key))}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" style={btn('secondary', true)} onClick={() => add()}>
        <FontAwesomeIcon icon={faPlus} /> Add point
      </button>
    </div>
  );
}
