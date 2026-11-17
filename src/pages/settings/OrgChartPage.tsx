import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDepartments, fetchPositions } from '../../api/salary.js';
import { fetchTeachers } from '../../api/planner.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import OrgChart, { type DeptStyle } from './OrgChart.js';
import { linkedCount, orgTree } from './orgStructure.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', accent: '#5a67d8' };
/** A colour per department, in their order — the chart's boxes carry it (with the name, never colour alone). */
const DEPT_COLOURS = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed', '#047857', '#b91c1c'];
const NO_DEPT: DeptStyle = { name: 'No department', colour: '#94a3b8' };

/**
 * Settings → HRMS → HR Planning → Org chart: positions by who they report to
 * (set in Positions), with the people in each, coloured by department.
 */
export default function OrgChartPage() {
  const { isMobile } = useIsMobile();
  /** One department, or '' for all. */
  const [chartDept, setChartDept] = useState('');
  const positions = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const departments = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const staff = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });

  if (positions.isPending || departments.isPending || staff.isPending) return <><h1>Org chart</h1><LoadingSpinner /></>;
  const depts = [...(departments.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const deptOf = (id: string | null): DeptStyle => {
    const i = depts.findIndex(d => d.departmentId === id);
    return i < 0 ? NO_DEPT : { name: depts[i].name, colour: DEPT_COLOURS[i % DEPT_COLOURS.length] };
  };
  const current = (staff.data ?? []).filter(s => s.isActive);
  const allPositions = positions.data ?? [];
  // One department: just its positions — its head shows who it reports to outside it.
  const shownPositions = chartDept ? allPositions.filter(p => p.departmentId === chartDept) : allPositions;
  const roots = orgTree(shownPositions, current.map(s => ({ id: s.id, name: s.name, positionId: s.positionId ?? null })));
  const reportsOutside = (id: string | null | undefined) => {
    const parent = allPositions.find(p => p.positionId === id);
    return chartDept && parent && parent.departmentId !== chartDept ? `${parent.name} — ${deptOf(parent.departmentId).name}` : null;
  };
  const unlinked = linkedCount(positions.data ?? []) === 0;

  return (
    <div>
      <h1>Org chart</h1>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {/* Departments can be many, so it's a dropdown. */}
          <select aria-label="Department" value={chartDept} onChange={e => setChartDept(e.target.value)}
            style={{ minHeight: isMobile ? 44 : 36, padding: '4px 10px', fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <option value="">All departments</option>
            {depts.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
          </select>
          <span style={{ flex: 1 }} />
          {/* Legend: each department's colour and name. */}
          <ul aria-label="Departments" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {depts.map(d => (
              <li key={d.departmentId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.sub }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: deptOf(d.departmentId).colour }} />{d.name}
              </li>
            ))}
          </ul>
        </div>
        {unlinked && (
          <p style={{ margin: '0 0 12px', fontSize: 14, color: C.sub, background: '#eef2ff', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
            No reporting lines yet, so every position stands alone. Set who each position reports to in{' '}
            <Link to="/settings/positions" style={linkBtn}>Positions</Link> and the chart joins them up.
          </p>
        )}
        {roots.length === 0
          ? <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>No positions yet — add them in <Link to="/settings/positions" style={linkBtn}>Positions</Link>.</p>
          : <OrgChart roots={roots} deptOf={deptOf} mobile={isMobile} reportsOutside={reportsOutside} />}
      </section>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 };
const linkBtn: React.CSSProperties = { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: C.accent, cursor: 'pointer' };
const h2: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, color: C.text };
