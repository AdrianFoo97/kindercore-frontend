import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import FormModal from '../../components/common/FormModal.js';
import type { RunPalette } from './runTheme.js';

const TAP = 44;

/**
 * An "i" beside a title: opens a pop-up (a bottom sheet on a phone) with what it
 * means — a description, a rubric, how it's marked — so the list itself stays short.
 */
export default function InfoSheetButton({ title, label, children, palette: p }: { title: string; label: string; children: ReactNode; palette: RunPalette }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} title={label}
        style={{ width: TAP, height: TAP, flexShrink: 0, margin: '-12px -8px -12px -4px', border: 'none', background: 'none', borderRadius: 8, color: p.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesomeIcon icon={faCircleInfo} />
      </button>
      {open && (
        // A short sheet title (a long name would be cut off there); the whole name heads the text.
        <FormModal title="What it means" onClose={() => setOpen(false)} width={480}>
          <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: p.text, lineHeight: 1.4 }}>{title}</p>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: p.sub }}>{children}</div>
        </FormModal>
      )}
    </>
  );
}
