import { useMemo, useState } from 'react';
import type { BackendArchitecture } from '../api/admin.js';

// Layered graph for Admin → Backend Architecture: Routes → Controllers →
// Services → Tables. The whole backend at once (125 boxes, ~170 lines)
// was unreadable — a selected chain spanned the full canvas — so the
// diagram only ever draws ONE chain: the selected box, everything that
// calls it and everything it reaches, top-aligned. The page's overview
// list is how you pick a starting point.

export type Layer = 'route' | 'controller' | 'service' | 'table';
export const LAYERS: Layer[] = ['route', 'controller', 'service', 'table'];
export const LAYER_TITLE: Record<Layer, string> = {
  route: 'Routes', controller: 'Controllers', service: 'Services', table: 'Tables',
};
export const LAYER_COLOR: Record<Layer, string> = {
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

export interface OverviewRow {
  group: BackendArchitecture['routeGroups'][number];
  controllers: string[];
  /** Services reached directly or through other services. */
  services: string[];
  /** Tables reached through the controllers or their services. */
  tables: string[];
  publicEndpoints: number;
}

/** One row per route file with its whole downstream chain flattened, sorted by path. */
export function overviewRows(a: BackendArchitecture): OverviewRow[] {
  const ctrl = new Map(a.controllers.map(c => [c.id, c]));
  const svc = new Map(a.services.map(s => [s.id, s]));
  return a.routeGroups.map(g => {
    const controllers = [...new Set(g.endpoints.map(e => e.controller).filter((c): c is string => !!c))].sort();
    const services = new Set<string>();
    const tables = new Set<string>();
    const visitService = (id: string) => {
      if (services.has(id)) return;
      services.add(id);
      const s = svc.get(id);
      s?.tables.forEach(t => tables.add(t));
      s?.services.forEach(visitService);
    };
    for (const c of controllers) {
      ctrl.get(c)?.tables.forEach(t => tables.add(t));
      ctrl.get(c)?.services.forEach(visitService);
    }
    return {
      group: g,
      controllers,
      services: [...services].sort(),
      tables: [...tables].sort(),
      publicEndpoints: g.endpoints.filter(e => !e.middleware.includes('authMiddleware')).length,
    };
  }).sort((x, y) => x.group.mount.localeCompare(y.group.mount) || x.group.id.localeCompare(y.group.id));
}

/** Just the boxes and lines in `id`'s chain — the focused view. */
export function focusGraph(g: Graph, id: string): Graph {
  const keep = chainOf(g, id);
  return {
    nodes: g.nodes.filter(n => keep.has(n.id)),
    edges: g.edges.filter(e => keep.has(e.from) && keep.has(e.to)),
  };
}

const COL_GAP = 64;
const ROW_H = 34;
const BOX_H = 26;
const TOP = 8;
const CHAR_W = 7.1; // ~width of one 11.5px monospace character

/** Each column as wide as its longest label (within limits), so names aren't cut. */
function columnWidths(g: Graph): Record<Layer, number> {
  return Object.fromEntries(LAYERS.map(l => {
    const longest = Math.max(0, ...g.nodes.filter(n => n.layer === l).map(n => n.label.length + (n.layer === 'route' ? 4 : 0)));
    return [l, Math.min(280, Math.max(130, Math.round(longest * CHAR_W + 30)))];
  })) as Record<Layer, number>;
}

/**
 * Focused diagram of one box's chain: everything that calls it (to the
 * left) and everything it reaches (to the right), top-aligned so a short
 * chain stays short. Hovering a box highlights its direct connections.
 */
export default function BackendArchitectureGraph({ arch, selected, onSelect }: {
  arch: BackendArchitecture;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const full = useMemo(() => buildGraph(arch), [arch]);
  const graph = useMemo(() => focusGraph(full, selected), [full, selected]);
  const cols = useMemo(() => orderColumns(graph), [graph]);
  const widths = useMemo(() => columnWidths(graph), [graph]);
  const [hover, setHover] = useState<string | null>(null);

  const present = LAYERS.filter(l => cols[l].length > 0);
  const colX = new Map<Layer, number>();
  let x = 12;
  for (const l of present) { colX.set(l, x); x += widths[l] + COL_GAP; }
  const width = x - COL_GAP + 12;

  const place = new Map<string, { x: number; y: number; w: number }>();
  for (const l of present) cols[l].forEach((id, i) => place.set(id, { x: colX.get(l)!, y: TOP + i * ROW_H, w: widths[l] }));
  const height = TOP + Math.max(...present.map(l => cols[l].length)) * ROW_H + 4;
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const near = (id: string) => hover !== null && (id === hover || graph.edges.some(e => (e.from === hover && e.to === id) || (e.to === hover && e.from === id)));

  return (
    <div>
      {/* Column titles as HTML so they never scroll out of view. */}
      <div style={{ position: 'relative', height: 22, width }}>
        {present.map(l => (
          <span key={l} style={{
            position: 'absolute', left: colX.get(l), fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: LAYER_COLOR[l], fontFamily: 'system-ui, sans-serif',
          }}>{LAYER_TITLE[l].toUpperCase()} · {cols[l].length}</span>
        ))}
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label="Focused architecture chain" style={{ display: 'block' }}>
        {graph.edges.map(e => {
          const a = place.get(e.from)!, b = place.get(e.to)!;
          const on = hover !== null && (e.from === hover || e.to === hover);
          const x1 = a.x + a.w, y1 = a.y + BOX_H / 2, x2 = b.x, y2 = b.y + BOX_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path key={`${e.from}>${e.to}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
              stroke={LAYER_COLOR[byId.get(e.from)!.layer]} strokeWidth={on ? 2 : 1.2}
              opacity={hover === null ? 0.55 : on ? 0.95 : 0.12} />
          );
        })}
        {graph.nodes.map(n => {
          const p = place.get(n.id)!;
          const isSel = n.id === selected;
          const faded = hover !== null && !near(n.id);
          const label = n.label.length > 36 ? `${n.label.slice(0, 35)}…` : n.label;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }} opacity={faded ? 0.35 : 1}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(n.id)}>
              <title>{n.sub ? `${n.label} — ${n.sub} endpoints` : n.label}</title>
              <rect width={p.w} height={BOX_H} rx={6} fill={isSel ? '#eef0fa' : '#fff'}
                stroke={isSel ? '#5a67d8' : '#dfe3ea'} strokeWidth={isSel ? 1.8 : 1} />
              <rect width={4} height={BOX_H} rx={2} fill={LAYER_COLOR[n.layer]} />
              <text x={11} y={BOX_H / 2} dominantBaseline="central" fontSize={11.5} fontWeight={isSel ? 700 : 600} fill="#1e293b"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{label}</text>
              {n.layer === 'route' && n.sub && (
                <text x={p.w - 8} y={BOX_H / 2} dominantBaseline="central" textAnchor="end" fontSize={10.5} fill="#94a3b8"
                  fontFamily="system-ui, sans-serif">{n.sub.split(' · ')[1]}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
