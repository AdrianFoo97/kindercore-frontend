import React from 'react';
import { Link } from 'react-router-dom';

// Shared by AuthRoleEditPage.tsx (Modules) and AuthRoleViewsPage.tsx
// (Views) — the two steps of editing one AuthRole, split into separate
// pages so the Views picker only ever has to reason about "this role's
// saved modules," not a module list that's also being edited in the same
// breath.

const C = { primary: '#5a67d8', muted: '#64748b', border: '#e2e8f0' };

export default function RoleEditTabs({ roleId, active }: { roleId: string; active: 'modules' | 'views' }) {
  const tabs = [
    { key: 'modules', label: 'Modules', to: `/settings/auth-roles/${roleId}/edit` },
    { key: 'views', label: 'Views', to: `/settings/auth-roles/${roleId}/views` },
  ] as const;
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
      {tabs.map(t => (
        <Link
          key={t.key}
          to={t.to}
          style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            color: active === t.key ? C.primary : C.muted,
            borderBottom: active === t.key ? `2px solid ${C.primary}` : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
