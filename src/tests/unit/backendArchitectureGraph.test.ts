import { describe, it, expect } from 'vitest';
import { buildGraph, orderColumns, chainOf, focusGraph, overviewRows, nodeId, LAYERS } from '../../pages/BackendArchitectureGraph.js';
import type { BackendArchitecture } from '../../api/admin.js';

// The Admin → Backend Architecture graph: boxes and lines built from the
// generated architecture, ordered to reduce crossings, and the "trace this
// chain" highlight.

const ep = (path: string, controller: string | null) =>
  ({ method: 'GET' as const, path, middleware: ['authMiddleware'], handler: 'h', controller });

const ARCH: BackendArchitecture = {
  routeGroups: [
    { id: 'leads.routes', mount: '/api/leads', endpoints: [ep('/api/leads', 'leads.controller'), ep('/api/leads/x', 'leads.controller')] },
    { id: 'salary.routes', mount: '/api/salary', endpoints: [ep('/api/salary', 'salary.controller')] },
    { id: 'upload.routes', mount: '/api/upload', endpoints: [ep('/api/upload', null)] },
  ],
  controllers: [
    { id: 'leads.controller', services: ['revenue.service'], controllers: [], tables: ['Lead'] },
    { id: 'salary.controller', services: ['payroll.service'], controllers: [], tables: ['Teacher'] },
  ],
  services: [
    { id: 'revenue.service', services: [], controllers: [], tables: ['Lead', 'Student'] },
    { id: 'payroll.service', services: [], controllers: [], tables: ['Teacher'] },
  ],
  tables: ['Lead', 'Student', 'Teacher', 'SystemSetting'],
};

const g = buildGraph(ARCH);
const has = (from: string, to: string) => g.edges.some(e => e.from === from && e.to === to);

describe('Backend Architecture — graph', () => {
  it('puts every route file, controller and service in its own column', () => {
    expect(g.nodes.filter(n => n.layer === 'route')).toHaveLength(3);
    expect(g.nodes.filter(n => n.layer === 'controller')).toHaveLength(2);
    expect(g.nodes.filter(n => n.layer === 'service')).toHaveLength(2);
  });

  it('only shows tables some code actually uses', () => {
    expect(g.nodes.filter(n => n.layer === 'table').map(n => n.label).sort()).toEqual(['Lead', 'Student', 'Teacher']);
  });

  it('draws one line per connection, even when several endpoints share it', () => {
    expect(g.edges.filter(e => e.from === nodeId('route', 'leads.routes'))).toHaveLength(1);
  });

  it('connects routes → controllers → services → tables', () => {
    expect(has(nodeId('route', 'leads.routes'), nodeId('controller', 'leads.controller'))).toBe(true);
    expect(has(nodeId('controller', 'leads.controller'), nodeId('service', 'revenue.service'))).toBe(true);
    expect(has(nodeId('service', 'revenue.service'), nodeId('table', 'Student'))).toBe(true);
  });

  it('adds no line for an inline handler with no controller', () => {
    expect(g.edges.some(e => e.from === nodeId('route', 'upload.routes'))).toBe(false);
  });

  it('keeps every box when ordering the columns', () => {
    const cols = orderColumns(g);
    const ordered = LAYERS.flatMap(l => cols[l]).sort();
    expect(ordered).toEqual(g.nodes.map(n => n.id).sort());
  });

  it('orders columns so connected boxes line up instead of crossing', () => {
    // leads → revenue → Lead/Student and salary → payroll → Teacher should
    // end up as two parallel bands, not interleaved.
    const cols = orderColumns(g);
    const idx = (l: (typeof LAYERS)[number], id: string) => cols[l].indexOf(id);
    const leadsFirst = idx('controller', nodeId('controller', 'leads.controller')) < idx('controller', nodeId('controller', 'salary.controller'));
    expect(idx('service', nodeId('service', 'revenue.service')) < idx('service', nodeId('service', 'payroll.service'))).toBe(leadsFirst);
  });

  it('traces a box\'s full chain both upstream and downstream', () => {
    const chain = chainOf(g, nodeId('controller', 'salary.controller'));
    expect([...chain].sort()).toEqual([
      nodeId('controller', 'salary.controller'),
      nodeId('route', 'salary.routes'),
      nodeId('service', 'payroll.service'),
      nodeId('table', 'Teacher'),
    ].sort());
  });

  it('focuses on one chain, leaving everything unrelated out', () => {
    const f = focusGraph(g, nodeId('route', 'salary.routes'));
    expect(f.nodes.map(n => n.id).sort()).toEqual([
      nodeId('controller', 'salary.controller'),
      nodeId('route', 'salary.routes'),
      nodeId('service', 'payroll.service'),
      nodeId('table', 'Teacher'),
    ].sort());
    expect(f.edges.every(e => f.nodes.some(n => n.id === e.from) && f.nodes.some(n => n.id === e.to))).toBe(true);
  });
});

describe('Backend Architecture — overview list', () => {
  const rows = overviewRows(ARCH);
  const row = (id: string) => rows.find(r => r.group.id === id)!;

  it('has one row per route file, sorted by address', () => {
    expect(rows.map(r => r.group.mount)).toEqual(['/api/leads', '/api/salary', '/api/upload']);
  });

  it('lists the tables reached through a controller\'s services as well as its own', () => {
    // leads.controller uses Lead itself; its revenue.service adds Student.
    expect(row('leads.routes')).toMatchObject({ controllers: ['leads.controller'], services: ['revenue.service'], tables: ['Lead', 'Student'] });
  });

  it('shows a route file handled only inline as having no controller', () => {
    expect(row('upload.routes')).toMatchObject({ controllers: [], services: [], tables: [] });
  });

  it('counts the endpoints that need no sign-in', () => {
    const open = overviewRows({
      ...ARCH,
      routeGroups: [{ id: 'leads.routes', mount: '/api/leads', endpoints: [
        { method: 'POST', path: '/api/leads', middleware: [], handler: 'createLead', controller: 'leads.controller' },
        ep('/api/leads', 'leads.controller'),
      ] }],
    });
    expect(open[0].publicEndpoints).toBe(1);
  });
});
