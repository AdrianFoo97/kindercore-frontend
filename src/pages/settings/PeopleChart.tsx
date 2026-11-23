import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import type { DeptStyle } from './OrgChart.js';
import { teamSize, type OrgPerson, type PersonNode } from './orgStructure.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', line: '#cbd5e1', accent: '#5a67d8' };
/** Space between boxes, and the length of the connector lines. */
const GAP = 16;
const NODE_WIDTH = 176;

export interface PersonInfo { positionName: string | null; dept: DeptStyle }

/**
 * Who reports to whom, person by person (each staff record’s “Reports to”):
 * every box links to that person’s record, where the line is changed. On a
 * phone it’s an indented list instead. Same drawing as the position chart.
 */
export default function PeopleChart({ roots, infoOf, mobile }: {
  roots: PersonNode[]; infoOf: (p: OrgPerson) => PersonInfo; mobile: boolean;
}) {
  if (mobile) {
    return <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{roots.map(n => <MobileNode key={n.person.id} node={n} infoOf={infoOf} depth={0} />)}</ul>;
  }
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <style>{`
        .kc-people, .kc-people ul { display: flex; justify-content: center; margin: 0; padding: 0; list-style: none; }
        .kc-people ul { padding-top: ${GAP}px; position: relative; }
        .kc-people li { position: relative; padding: ${GAP}px ${GAP / 2}px 0; display: flex; flex-direction: column; align-items: center; }
        .kc-people li::before, .kc-people li::after { content: ''; position: absolute; top: 0; width: 50%; height: ${GAP}px; border-top: 1px solid ${C.line}; }
        .kc-people li::before { right: 50%; }
        .kc-people li::after { left: 50%; border-left: 1px solid ${C.line}; }
        .kc-people li:only-child::before, .kc-people li:only-child::after { border-top: none; }
        .kc-people li:only-child { padding-top: ${GAP}px; }
        .kc-people li:first-child::before, .kc-people li:last-child::after { border-top: none; }
        .kc-people li:last-child::before { border-right: 1px solid ${C.line}; border-radius: 0 6px 0 0; }
        .kc-people li:first-child::after { border-radius: 6px 0 0 0; }
        .kc-people > li { padding-top: 0; }
        .kc-people > li::before, .kc-people > li::after { display: none; }
        .kc-people ul::before { content: ''; position: absolute; top: 0; left: 50%; height: ${GAP}px; border-left: 1px solid ${C.line}; }
        .kc-person:hover { border-color: ${C.accent} !important; }
      `}</style>
      <ul className="kc-people" style={{ width: 'max-content', margin: '0 auto' }}>
        {roots.map(n => <ChartNode key={n.person.id} node={n} infoOf={infoOf} />)}
      </ul>
    </div>
  );
}

function ChartNode({ node, infoOf }: { node: PersonNode; infoOf: (p: OrgPerson) => PersonInfo }) {
  return (
    <li>
      <PersonBox node={node} info={infoOf(node.person)} />
      {node.children.length > 0 && <ul>{node.children.map(c => <ChartNode key={c.person.id} node={c} infoOf={infoOf} />)}</ul>}
    </li>
  );
}

/** One person: name, position (department colour + name), and how many are in their team. */
function PersonBox({ node, info }: { node: PersonNode; info: PersonInfo }) {
  const team = teamSize(node);
  return (
    <Link to={`/teachers/${node.person.id}`} className="kc-person" title={`Open ${node.person.name}’s record`}
      style={{ display: 'block', width: NODE_WIDTH, background: '#fff', border: `1px solid ${C.border}`, borderTop: `3px solid ${info.dept.colour}`, borderRadius: 8, padding: '8px 12px', textAlign: 'left', textDecoration: 'none', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{node.person.name}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{info.positionName ?? 'No position'} · {info.dept.name}</div>
      {team > 0 && (
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginTop: 4 }}>
          <FontAwesomeIcon icon={faUsers} style={{ fontSize: 11, marginRight: 4 }} />
          Team of {team}
        </div>
      )}
    </Link>
  );
}

function MobileNode({ node, infoOf, depth }: { node: PersonNode; infoOf: (p: OrgPerson) => PersonInfo; depth: number }) {
  return (
    <li style={{ marginLeft: depth ? GAP : 0, paddingLeft: depth ? GAP / 2 : 0, borderLeft: depth ? `1px solid ${C.line}` : 'none', marginTop: 8 }}>
      <PersonBox node={node} info={infoOf(node.person)} />
      {node.children.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{node.children.map(c => <MobileNode key={c.person.id} node={c} infoOf={infoOf} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}
