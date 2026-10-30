import { useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlassPlus, faMagnifyingGlassMinus, faExpand, faCompress, faArrowsLeftRightToLine,
} from '@fortawesome/free-solid-svg-icons';
import type { DbSchema } from '../api/admin.js';
import { DOMAIN_ORDER, Domain, TABLE_NOTES } from './dbTableNotes.js';

// Entity-relationship diagram for the Database Design page — table names
// only, one line per link. Built from the same live schema as the table
// list, so it redraws itself whenever the database changes. dagre only
// computes box positions (fewest crossings); drawing is plain SVG.
// Tables with no links at all sit in a strip underneath rather than
// scattering across the layout.

const DOMAIN_COLOR: Record<Domain, string> = {
  'Leads & marketing': '#2563eb',
  'Students': '#0891b2',
  'Staff & HR': '#7c3aed',
  'Recruitment': '#c026d3',
  'Pay & allowances': '#b45309',
  'Career & appraisals': '#db2777',
  'Points & rewards': '#ca8a04',
  'How-to guides (SOPs)': '#059669',
  'Finance': '#16a34a',
  'Planner & timetable': '#0d9488',
  'Accounts & access': '#475569',
  'System': '#64748b',
  'Other': '#94a3b8',
};

const domainOf = (t: string): Domain => TABLE_NOTES[t]?.domain ?? 'Other';

const FONT = 12;
const CHAR_W = 7.3; // ~width of one 12px monospace character
const NODE_H = 30;
const PAD_X = 14;
const nodeWidth = (name: string) => Math.round(name.length * CHAR_W + PAD_X * 2 + 6);

export interface Laid {
  nodes: { name: string; x: number; y: number; w: number }[];
  edges: { key: string; from: string; to: string; kind: 'foreignKey' | 'inferred'; points: { x: number; y: number }[] }[];
  width: number;
  height: number;
  /** y of the "not linked" strip's caption, when there is one. */
  looseCaptionY: number | null;
}

export function layout(schema: DbSchema): Laid {
  // Self-links (e.g. AllowanceType → parent type) are skipped in the
  // drawing; they're still listed on the table's detail view.
  const rels = schema.relations.filter(r => r.fromTable !== r.toTable);
  const linked = new Set(rels.flatMap(r => [r.fromTable, r.toTable]));

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 70, edgesep: 8, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const t of schema.tables) {
    if (linked.has(t.name)) g.setNode(t.name, { width: nodeWidth(t.name), height: NODE_H });
  }
  rels.forEach((r, i) => g.setEdge(r.fromTable, r.toTable, {}, `e${i}`));
  dagre.layout(g);

  const nodes = g.nodes().map(n => {
    const v = g.node(n);
    return { name: n, x: v.x - v.width / 2, y: v.y - v.height / 2, w: v.width };
  });
  const edges = g.edges().map(e => {
    const i = Number(e.name!.slice(1));
    return { key: e.name!, from: e.v, to: e.w, kind: rels[i].kind, points: g.edge(e).points };
  });

  let width = (g.graph().width ?? 0);
  let height = (g.graph().height ?? 0);

  // Unlinked tables: wrapped rows below the graph.
  const loose = schema.tables.filter(t => !linked.has(t.name)).map(t => t.name);
  let looseCaptionY: number | null = null;
  if (loose.length) {
    const rowW = Math.max(width, 900);
    let x = 16;
    let y = height + 44;
    looseCaptionY = y - 10;
    for (const name of loose) {
      const w = nodeWidth(name);
      if (x + w > rowW - 16) { x = 16; y += NODE_H + 12; }
      nodes.push({ name, x, y, w });
      x += w + 12;
    }
    height = y + NODE_H + 16;
    width = Math.max(width, rowW);
  }
  return { nodes, edges, width, height, looseCaptionY };
}

/** Smooth path through dagre's bend points. */
function pathOf(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export default function DatabaseErd({ schema, visibleNames, onOpenTable }: {
  schema: DbSchema;
  /** Tables matching the page's search/area filter — others are dimmed. */
  visibleNames: Set<string>;
  onOpenTable: (name: string) => void;
}) {
  const laid = useMemo(() => layout(schema), [schema]);
  const [zoom, setZoom] = useState(0.85);
  const [hover, setHover] = useState<string | null>(null);
  // Full screen = the diagram covers the whole window (above the navbar);
  // Esc or the same button exits. Entering it fits the diagram to the window.
  const [full, setFull] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  /** Zoom so the whole diagram fits the visible canvas. */
  const fit = () => {
    const el = canvasRef.current;
    if (!el) return;
    const z = Math.min(el.clientWidth / laid.width, el.clientHeight / laid.height);
    setZoom(Math.max(0.3, Math.min(2, +(z * 0.98).toFixed(2))));
  };

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no page scroll behind the overlay
    requestAnimationFrame(fit); // after the canvas has its full-screen size
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  const filtering = visibleNames.size !== schema.tables.length;
  const domainsPresent = DOMAIN_ORDER.filter(d => laid.nodes.some(n => domainOf(n.name) === d));
  const touches = (e: Laid['edges'][number], n: string) => e.from === n || e.to === n;

  return (
    <div style={full ? { ...st.wrap, ...st.wrapFull } : st.wrap}>
      <div style={st.bar}>
        <div style={st.legend}>
          {domainsPresent.map(d => (
            <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: DOMAIN_COLOR[d] }} />{d}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button style={st.zoomBtn} onClick={() => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)))} title="Zoom out" aria-label="Zoom out"><FontAwesomeIcon icon={faMagnifyingGlassMinus} /></button>
          <button style={st.zoomBtn} onClick={fit} title="Fit to screen" aria-label="Fit to screen"><FontAwesomeIcon icon={faArrowsLeftRightToLine} /></button>
          <button style={st.zoomBtn} onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} title="Zoom in" aria-label="Zoom in"><FontAwesomeIcon icon={faMagnifyingGlassPlus} /></button>
          <button style={{ ...st.zoomBtn, ...(full ? st.zoomBtnOn : {}) }} onClick={() => setFull(f => !f)}
            title={full ? 'Exit full screen (Esc)' : 'Full screen'} aria-label={full ? 'Exit full screen' : 'Full screen'}>
            <FontAwesomeIcon icon={full ? faCompress : faExpand} />
          </button>
        </div>
      </div>

      <div ref={canvasRef} style={full ? { ...st.canvas, ...st.canvasFull } : st.canvas}>
        <svg width={laid.width * zoom} height={laid.height * zoom} viewBox={`0 0 ${laid.width} ${laid.height}`} role="img" aria-label="Database entity-relationship diagram">
          <defs>
            <marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker id="erd-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a67d8" />
            </marker>
          </defs>

          {laid.looseCaptionY !== null && (
            <text x={16} y={laid.looseCaptionY} fontSize={11} fill="#94a3b8" fontFamily="system-ui, sans-serif" fontWeight={700} letterSpacing="0.06em">
              NOT LINKED TO OTHER TABLES
            </text>
          )}

          {laid.edges.map(e => {
            const hot = hover !== null && touches(e, hover);
            const dim = (hover !== null && !hot) || (filtering && !(visibleNames.has(e.from) || visibleNames.has(e.to)));
            return (
              <path key={e.key} d={pathOf(e.points)} fill="none"
                stroke={hot ? '#5a67d8' : '#cbd5e1'} strokeWidth={hot ? 1.8 : 1.1}
                strokeDasharray={e.kind === 'inferred' ? '5 4' : undefined}
                markerEnd={`url(#${hot ? 'erd-arrow-hot' : 'erd-arrow'})`}
                opacity={dim ? 0.25 : 1} />
            );
          })}

          {laid.nodes.map(n => {
            const color = DOMAIN_COLOR[domainOf(n.name)];
            const isHot = hover === n.name || (hover !== null && laid.edges.some(e => touches(e, hover) && touches(e, n.name)));
            const dim = (hover !== null && !isHot) || (filtering && !visibleNames.has(n.name));
            return (
              <g key={n.name} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : 1}
                onMouseEnter={() => setHover(n.name)} onMouseLeave={() => setHover(null)}
                onClick={() => onOpenTable(n.name)}>
                <title>{`${n.name} — ${TABLE_NOTES[n.name]?.about ?? 'No description yet.'} (click for details)`}</title>
                <rect width={n.w} height={NODE_H} rx={7} fill={hover === n.name ? '#eef0fa' : '#fff'} stroke={hover === n.name ? '#5a67d8' : '#dfe3ea'} strokeWidth={hover === n.name ? 1.5 : 1} />
                <rect width={5} height={NODE_H} rx={2} fill={color} />
                <text x={PAD_X} y={NODE_H / 2} dominantBaseline="central" fontSize={FONT}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight={600} fill="#1e293b">
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={st.foot}>
        Hover a table to highlight its links · click it to see its columns ·
        <span style={{ marginLeft: 6 }}>solid line = enforced by the database, dashed = inferred from the column name, arrow points to the table referenced</span>
      </div>
    </div>
  );
}

const st = {
  wrap: { background: '#fff', border: '1px solid #e8ebf0', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  // Full screen: cover the window (above the navbar) as a column so the
  // canvas takes all the height between the toolbar and the footer.
  wrapFull: {
    position: 'fixed', inset: 0, zIndex: 2000, borderRadius: 0, border: 'none',
    display: 'flex', flexDirection: 'column',
  } as React.CSSProperties,
  canvasFull: { flex: 1, minHeight: 0, maxHeight: 'none' } as React.CSSProperties,
  zoomBtnOn: { background: '#eef0fa', color: '#3c339a', borderColor: '#c7cdf0' } as React.CSSProperties,
  bar: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    padding: '10px 14px', borderBottom: '1px solid #f1f3f6',
  } as React.CSSProperties,
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 11.5, color: '#64748b' } as React.CSSProperties,
  zoomBtn: {
    width: 30, height: 30, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff',
    color: '#64748b', cursor: 'pointer', fontSize: 12,
  } as React.CSSProperties,
  canvas: { overflow: 'auto', maxHeight: 'calc(100vh - 230px)', background: '#fbfcfd' } as React.CSSProperties,
  foot: { padding: '8px 14px', borderTop: '1px solid #f1f3f6', fontSize: 11.5, color: '#94a3b8' } as React.CSSProperties,
};
