import { MODULE_LABELS, type ModuleKey } from '../../constants/authModules.js';

// Edit access → the live result of the choices on the page: their roles, the
// modules they'll open (with what each covers) and any extra functions.

const C = { text: '#1a1f36', sub: '#3c4257', muted: '#697386', border: '#e3e8ee', divider: '#ebeef1' };

export default function AccessSummary({ roleNames, modules, includes, functions, isAdmin }: {
  roleNames: string[];
  modules: ModuleKey[];
  /** What each module opens on its own (from the roles catalog). */
  includes: Partial<Record<ModuleKey, string[]>>;
  /** Labels of the extra functions their roles grant. */
  functions: string[];
  isAdmin: boolean;
}) {
  return (
    <div>
      <div style={s.title}>Access summary</div>
      {isAdmin ? (
        <p style={s.muted}>Admins can open every module and setting.</p>
      ) : (
        <>
          <div style={s.label}>Roles</div>
          {roleNames.length === 0
            ? <p style={s.muted}>No roles — they can only open their own pages.</p>
            : <p style={{ ...s.muted, color: C.sub }}>{roleNames.join(', ')}</p>}

          <div style={s.label}>Can open</div>
          {modules.length === 0 ? <p style={s.muted}>Only their own pages.</p> : (
            <ul style={s.list}>
              {modules.map(m => (
                <li key={m} style={s.item}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{MODULE_LABELS[m]}</div>
                  {includes[m]?.length ? <div style={s.small}>{includes[m]!.join(' · ')}</div> : null}
                </li>
              ))}
            </ul>
          )}

          <div style={s.label}>Extra functions</div>
          {functions.length === 0 ? <p style={s.muted}>None.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
              {functions.map(f => <li key={f}>{f}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, margin: '16px 0 4px' },
  muted: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  item: { padding: '8px 0', borderTop: `1px solid ${C.divider}` },
  small: { fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 2 },
};
