import type { ReactNode } from 'react';

/**
 * A page that was once a tab elsewhere (so has no title of its own), shown as
 * its own settings page: the usual settings title above it, in one wrapper —
 * .settings-frame (main.tsx) spaces a page by its single wrapper element.
 */
export default function TitledSettingsPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
