import { useMemo, useState } from 'react';
import type { BackendArchitecture } from '../api/admin.js';

// Layered graph for Admin → Backend Architecture: four fixed columns —
// Routes → Controllers → Services → Tables — one box per module. ~230
// connections would be unreadable all at once, so lines stay faint until a
// box is hovered or selected; then its whole chain (everything upstream
// that calls it, everything downstream it reaches) lights up.

export type Layer = 'route' | 'controller' | 'service' | 'table';
export const LAYERS: Layer[] = ['route', 'controller', 'service', 'table'];
export const LAYER_TITLE: Record<Layer, string> = {
  route: 'Routes', controller: 'Controllers', service: 'Services', table: 'Tables',
};
const LAYER_COLOR: Record<Layer, string> = {
  route: '#2563eb', controller: '#7c3aed', service: '#059669', table: '#b45309',
};

export interface GNode { id: string; layer: Layer; label: string; sub?: string }
export interface GEdge { from: string; to: string }
export interface Graph { nodes: GNode[]; edges: GEdge[] }

export const nodeId = (layer: Layer, name: string) => `${layer}:${name}`;
const short = (id: string) => id.replace(/\.(routes|controller|service)$/, '');

/** Nodes + edges from the generated architecture. Unused tables are omitted. */
export function buildGraph(a: BackendArchitecture): Graph {
  const nodes: GNode[] = [];
  const edges = new Map<string, GEdge>();
  const addEdge = (from: string, to: string) => { if (from !== to) edges.set(`${from}>${to}`, { from, to }); };

  for (const g of a.routeGroups) {
    nodes.push({ id: nodeId('route', g.id), layer: 'route', label: short(g.id), sub: `${g.mount} · ${g.endpoints.length}` });
    for (const c of new Set(g.endpoints.map(e => e.controller).filter((c): c is string => !!c))) {
      addEdge(nodeId('route', g.id), nodeId('controller', c));
    }
  }
  const usedTables = new Set<string>();
  for (const m of [...a.controllers.map(c => ({ ...c, layer: 'controller' as const })), ...a.services.map(s => ({ ...s, layer: 'service' as const }))]) {
    nodes.push({ id: nodeId(m.layer, m.id), layer: m.layer, label: short(m.id) });
    for (const s of m.services) addEdge(nodeId(m.layer, m.id), nodeId('service', s));
    for (const t of m.tables) { addEdge(nodeId(m.layer, m.id), nodeId('table', t)); usedTables.add(t); }
  }
  for (const t of a.tables) if (usedTables.has(t)) nodes.push({ id: nodeId('table', t), layer: 'table', label: t });

  const ids = new Set(nodes.map(n => n.id));
  return { nodes, edges: [...edges.values()].filter(e => ids.has(e.from) && ids.has(e.to)) };
}

/**
 * Order within each column to reduce crossings: a few barycenter sweeps
 * (each box moves toward the average position of the boxes it connects
 * to), left→right then right→left. Returns column → ordered node ids.
 */
export function orderColumns(g: Graph): Record<Layer, string[]> {
  const cols = Object.fromEntries(LAYERS.map(l => [l, g.nodes.filter(n => n.layer === l).map(n => n.id).sort()])) as Record<Layer, string[]>;
  const neighbours = new Map<string, string[]>();
  for (const e of g.edges) {
    neighbours.set(e.from, [...(neighbours.get(e.from) ?? []), e.to]);
    neighbours.set(e.to, [...(neighbours.get(e.to) ?? []), e.from]);
  }
  const pos = () => {
    const p = new Map<string, number>();
    for (const l of LAYERS) cols[l].forEach((id, i) => p.set(id, i / Math.max(1, cols[l].length - 1)));
    return p;
  };
  const sweep = (order: Layer[]) => {
    for (const l of order) {
      const p = pos();
      const bary = (id: string) => {
        const ns = (neighbours.get(id) ?? []).filter(n => !n.startsWith(`${l}:`));
        return ns.length ? ns.reduce((s, n) => s + p.get(n)!, 0) / ns.length : p.get(id)!;
      };
      const score = new Map(cols[l].map(id => [id, bary(id)]));
      cols[l] = [...cols[l]].sort((a, b) => score.get(a)! - score.get(b)! || a.localeCompare(b));
    }
  };
  for (let i = 0; i < 4; i++) { sweep(['controller', 'service', 'table']); sweep(['service', 'controller', 'route']); }
  return cols;
}

/** Everything connected upstream and downstream of `id` (inclusive). */
export function chainOf(g: Graph, id: string): Set<string> {
  const out = new Set([id]);
  const walk = (dir: 'down' | 'up') => {
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of g.edges) {
        const next = dir === 'down' ? (e.from === cur ? e.to : null) : (e.to === cur ? e.from : null);
        if (next && !out.has(next)) { out.add(next); stack.push(next); }
      }
    }
  };
  walk('down'); walk('up');
  return out;
}

const COL_W = 210;
const BOX_W = 168;
const ROW_H = 30;
const BOX_H = 24;
const TOP = 34;

export default function BackendArchitectureGraph({ arch, selected, onSelect, dimmed }: {
  arch: BackendArchitecture;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Node ids not matching the page's search — drawn faded. */
  dimmed: Set<string>;
}) {
  const graph = useMemo(() => buildGraph(arch), [arch]);
  const cols = useMemo(() => orderColumns(graph), [graph]);
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? selected;
  const chain = useMemo(() => (focus ? chainOf(graph, focus) : null), [graph, focus]);

  const place = new Map<string, { x: number; y: number }>();
  const tallest = Math.max(...LAYERS.map(l => cols[l].length));
  LAYERS.forEach((l, ci) => {
    const offset = ((tallest - cols[l].length) * ROW_H) / 2; // centre shorter columns
    cols[l].forEach((id, i) => place.set(id, { x: 16 + ci * COL_W, y: TOP + offset + i * ROW_H }));
  });
  const width = 16 + (LAYERS.length - 1) * COL_W + BOX_W + 16;
  const height = TOP + tallest * ROW_H + 10;
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backend layered architecture graph"
      onClick={() => onSelect(null)} style={{ display: 'block' }}>
      {LAYERS.map((l, ci) => (
        <text key={l} x={16 + ci * COL_W} y={18} fontSize={11} fontWeight={700} letterSpacing="0.06em"
          fill={LAYER_COLOR[l]} fontFamily="system-ui, sans-serif">
          {LAYER_TITLE[l].toUpperCase()} · {cols[l].length}
        </text>
      ))}

      {graph.edges.map(e => {
        const a = place.get(e.from)!, b = place.get(e.to)!;
        const on = !!chain && chain.has(e.from) && chain.has(e.to);
        const x1 = a.x + BOX_W, y1 = a.y + BOX_H / 2, x2 = b.x, y2 = b.y + BOX_H / 2;
        const mx = (x1 + x2) / 2;
        return (
          <path key={`${e.from}>${e.to}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
            stroke={on ? LAYER_COLOR[byId.get(e.from)!.layer] : '#e2e8f0'}
            strokeWidth={on ? 1.6 : 0.8} opacity={chain && !on ? 0.35 : on ? 0.9 : 0.7} />
        );
      })}

      {graph.nodes.map(n => {
        const p = place.get(n.id)!;
        const inChain = !chain || chain.has(n.id);
        const faded = !inChain || dimmed.has(n.id);
        const isSel = n.id === selected;
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }} opacity={faded ? 0.28 : 1}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
            onClick={ev => { ev.stopPropagation(); onSelect(isSel ? null : n.id); }}>
            <title>{n.sub ? `${n.label} — ${n.sub} endpoints` : n.label}</title>
            <rect width={BOX_W} height={BOX_H} rx={6} fill={isSel ? '#eef0fa' : '#fff'}
              stroke={isSel ? '#5a67d8' : '#dfe3ea'} strokeWidth={isSel ? 1.6 : 1} />
            <rect width={4} height={BOX_H} rx={2} fill={LAYER_COLOR[n.layer]} />
            <text x={11} y={BOX_H / 2} dominantBaseline="central" fontSize={11.5} fontWeight={600} fill="#1e293b"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              {n.label.length > 19 ? `${n.label.slice(0, 18)}…` : n.label}
            </text>
            {n.layer === 'route' && n.sub && (
              <text x={BOX_W - 8} y={BOX_H / 2} dominantBaseline="central" textAnchor="end" fontSize={10.5} fill="#94a3b8"
                fontFamily="system-ui, sans-serif">{n.sub.split(' · ')[1]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
