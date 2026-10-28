import { describe, it, expect } from 'vitest';
import { layout } from '../../pages/DatabaseErd.js';
import type { DbSchema, DbRelation } from '../../api/admin.js';

// The ERD on Admin → Database Design is laid out automatically from the
// live schema. These check the drawing is sound for any schema: every
// table drawn once, nothing overlapping, lines only between real boxes.

const table = (name: string) => ({ name, approxRows: 0, columns: [] });
const rel = (from: string, to: string, kind: DbRelation['kind'] = 'inferred'): DbRelation =>
  ({ fromTable: from, fromColumn: `${to.toLowerCase()}Id`, toTable: to, toColumn: 'id', kind });

const SCHEMA: DbSchema = {
  database: 'kindercore_test',
  readAt: '2026-10-28T00:00:00Z',
  tables: ['Teacher', 'Position', 'Department', 'User', 'PointsTransaction', 'RewardRedemption',
    'PointsRewardItem', 'Student', 'Package', 'Lead', 'SystemSetting', 'BugReport', 'AllowanceType'].map(table),
  relations: [
    rel('Teacher', 'Position'), rel('Position', 'Department'), rel('User', 'Teacher'),
    rel('PointsTransaction', 'Teacher'), rel('PointsTransaction', 'RewardRedemption'),
    rel('RewardRedemption', 'Teacher'), rel('RewardRedemption', 'PointsRewardItem'),
    rel('Student', 'Package', 'foreignKey'), rel('Student', 'Lead', 'foreignKey'),
    rel('BugReport', 'User'),
    rel('AllowanceType', 'AllowanceType'), // self-link (sub-type → parent)
  ],
};

const laid = layout(SCHEMA);

describe('Database Design — ERD layout', () => {
  it('draws every table exactly once', () => {
    expect(laid.nodes.map(n => n.name).sort()).toEqual(SCHEMA.tables.map(t => t.name).sort());
  });

  it('never overlaps two table boxes', () => {
    const H = 30;
    for (let i = 0; i < laid.nodes.length; i++) {
      for (let j = i + 1; j < laid.nodes.length; j++) {
        const a = laid.nodes[i], b = laid.nodes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + H && b.y < a.y + H;
        expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it('keeps every box inside the drawing area', () => {
    for (const n of laid.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(laid.width);
      expect(n.y + 30).toBeLessThanOrEqual(laid.height);
    }
  });

  it('draws one line per link between two different tables', () => {
    const names = new Set(laid.nodes.map(n => n.name));
    expect(laid.edges).toHaveLength(SCHEMA.relations.filter(r => r.fromTable !== r.toTable).length);
    for (const e of laid.edges) {
      expect(names.has(e.from) && names.has(e.to)).toBe(true);
      expect(e.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps solid vs dashed: enforced links stay foreign keys', () => {
    expect(laid.edges.filter(e => e.kind === 'foreignKey').map(e => `${e.from}>${e.to}`).sort())
      .toEqual(['Student>Lead', 'Student>Package']);
  });

  it('puts tables with no links in a strip below the diagram', () => {
    const loose = laid.nodes.find(n => n.name === 'SystemSetting')!;
    const linkedBottom = Math.max(...laid.nodes.filter(n => n.name !== 'SystemSetting').map(n => n.y));
    expect(laid.looseCaptionY).not.toBeNull();
    expect(loose.y).toBeGreaterThanOrEqual(linkedBottom);
  });

  it('treats a table that only links to itself as unlinked', () => {
    // AllowanceType's only link is to itself — the drawing skips self-links,
    // so it belongs in the unlinked strip, not floating alone in the graph.
    const a = laid.nodes.find(n => n.name === 'AllowanceType')!;
    expect(a.y).toBeGreaterThan(laid.looseCaptionY!);
  });
});
