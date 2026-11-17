import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faChevronDown, faChevronRight, faUser } from '@fortawesome/free-solid-svg-icons';
import type { OrgNode } from './orgStructure.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', line: '#cbd5e1', bg: '#f8fafc', accent: '#5a67d8' };
/** Space between boxes, and the length of the connector lines. */
const GAP = 16;
const NODE_WIDTH = 188;

export interface DeptStyle { name: string; colour: string }

/**
 * The organisational chart: each position a box (its department's colour, how
 * many hold it — tap to list them), the positions reporting to it below,
 * joined by lines. On a phone it's an indented list instead.
 */
export default function OrgChart({ roots, deptOf, mobile, reportsOutside }: {
  roots: OrgNode[]; deptOf: (departmentId: string | null) => DeptStyle; mobile: boolean;
  /** Showing one department: who a top position reports to outside it ("Principal — Management"), or null. */
  reportsOutside?: (positionId: string | null | undefined) => string | null;
}) {
  if (mobile) {
    return <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{roots.map(n => <MobileNode key={n.position.positionId} node={n} deptOf={deptOf} depth={0} above={reportsOutside?.(n.position.reportsToPositionId)} />)}</ul>;
  }
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <style>{`
        .kc-org, .kc-org ul { display: flex; justify-content: center; margin: 0; padding: 0; list-style: none; }
        .kc-org ul { padding-top: ${GAP}px; position: relative; }
        .kc-org li { position: relative; padding: ${GAP}px ${GAP / 2}px 0; display: flex; flex-direction: column; align-items: center; }
        /* The lines: across the top of each row of siblings, and down into each box. */
        .kc-org li::before, .kc-org li::after { content: ''; position: absolute; top: 0; width: 50%; height: ${GAP}px; border-top: 1px solid ${C.line}; }
        .kc-org li::before { right: 50%; }
        .kc-org li::after { left: 50%; border-left: 1px solid ${C.line}; }
        .kc-org li:only-child::before, .kc-org li:only-child::after { border-top: none; }
        .kc-org li:only-child { padding-top: ${GAP}px; }
        .kc-org li:first-child::before, .kc-org li:last-child::after { border-top: none; }
        .kc-org li:last-child::before { border-right: 1px solid ${C.line}; border-radius: 0 6px 0 0; }
        .kc-org li:first-child::after { border-radius: 6px 0 0 0; }
        .kc-org > li { padding-top: 0; }
        .kc-org > li::before, .kc-org > li::after { display: none; }
        .kc-org ul::before { content: ''; position: absolute; top: 0; left: 50%; height: ${GAP}px; border-left: 1px solid ${C.line}; }
      `}</style>
      {/* As wide as it needs: centred when it fits, scrolls (from its left edge) when it doesn't. */}
      <ul className="kc-org" style={{ width: 'max-content', margin: '0 auto' }}>
        {roots.map(n => <ChartNode key={n.position.positionId} node={n} deptOf={deptOf} above={reportsOutside?.(n.position.reportsToPositionId)} />)}
      </ul>
    </div>
  );
}

function ChartNode({ node, deptOf, above }: { node: OrgNode; deptOf: (id: string | null) => DeptStyle; above?: string | null }) {
  return (
    <li>
      {above && <ReportsOutside text={above} />}
      <PositionBox node={node} dept={deptOf(node.position.departmentId)} />
      {node.children.length > 0 && <ul>{node.children.map(c => <ChartNode key={c.position.positionId} node={c} deptOf={deptOf} />)}</ul>}
    </li>
  );
}

/** One position: name, department, and its staff (listed on request — there can be many). */
function PositionBox({ node, dept }: { node: OrgNode; dept: DeptStyle }) {
  const [open, setOpen] = useState(false);
  const n = node.staff.length;
  return (
    <div style={{ width: NODE_WIDTH, background: '#fff', border: `1px solid ${C.border}`, borderTop: `3px solid ${dept.colour}`, borderRadius: 8, textAlign: 'left' }}>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{node.position.name}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{dept.name}</div>
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={n === 0} aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderTop: `1px solid ${C.border}`,
          background: C.bg, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: n ? C.sub : C.muted, cursor: n ? 'pointer' : 'default', borderRadius: '0 0 8px 8px',
        }}>
        <FontAwesomeIcon icon={faUser} style={{ fontSize: 11 }} />
        {n === 0 ? 'Vacant' : `${n} ${n === 1 ? 'person' : 'people'}`}
        {n > 0 && <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} style={{ marginLeft: 'auto', fontSize: 10 }} />}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 12px 8px', display: 'block' }}>
          {node.staff.map(s => (
            <li key={s.id} style={{ padding: '2px 0', display: 'block' }}>
              <Link to={`/teachers/${s.id}`} style={{ fontSize: 13, color: C.accent, textDecoration: 'none' }}>{s.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Above a department's top box when one department is shown: who it reports to outside it. */
function ReportsOutside({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textAlign: 'center' }}><FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, marginRight: 4 }} />Reports to {text}</div>;
}

function MobileNode({ node, deptOf, depth, above }: { node: OrgNode; deptOf: (id: string | null) => DeptStyle; depth: number; above?: string | null }) {
  return (
    <li style={{ marginLeft: depth ? GAP : 0, paddingLeft: depth ? GAP / 2 : 0, borderLeft: depth ? `1px solid ${C.line}` : 'none', marginTop: 8 }}>
      {above && <ReportsOutside text={above} />}
      <PositionBox node={node} dept={deptOf(node.position.departmentId)} />
      {node.children.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{node.children.map(c => <MobileNode key={c.position.positionId} node={c} deptOf={deptOf} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}
