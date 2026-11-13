import { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#c53030' }}>
          <h2>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{(this.state.error as Error).stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Sessions used to be kept in localStorage, where any script on the page could
// read them; they're now an httpOnly cookie. Remove any old copy left behind
// (that browser simply signs in once more).
try { localStorage.removeItem('token'); } catch { /* storage blocked — nothing to clean */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Global styles
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  /* Fonts inherit from the page: admin pages set system-ui, the teacher app
     sets Nunito on its root. (A '*' rule here used to force Segoe UI onto
     every element, overriding both.) Form controls don't inherit by default. */
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  button, input, select, textarea { font-family: inherit; }

  /* Keyboard focus — always visible (design guide: Full Keyboard Access).
     Only for keyboard focus (:focus-visible), so mouse/touch clicks don't
     show a ring; !important beats the many inline outline:none. */
  a:focus-visible, button:focus-visible, [role="button"]:focus-visible, [role="tab"]:focus-visible,
  [role="checkbox"]:focus-visible, [role="radio"]:focus-visible, [role="switch"]:focus-visible,
  [tabindex]:not([tabindex="-1"]):focus-visible, summary:focus-visible {
    outline: 2px solid #6366f1 !important;
    outline-offset: 2px !important;
  }

  /* Reduce Motion — swap movement for (near-)instant changes. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Touch targets — on touch screens every button, link and tab gets a touch
     area of at least Apple's 44 × 44, without changing how it looks (an
     invisible ::after centred on it). :where() keeps this at zero priority,
     so any page style (or an inline position) still wins. .tap opts other
     elements in. */
  @media (pointer: coarse) {
    :where(button, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], .tap) { position: relative; }
    :where(button, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], .tap)::after {
      content: ''; position: absolute; left: 50%; top: 50%;
      width: max(100%, 44px); height: max(100%, 44px); transform: translate(-50%, -50%);
    }
  }

  input, textarea, select {
    border: 1px solid #e2e8f0 !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
  }
  input:hover, textarea:hover, select:hover {
    border-color: #cbd5e1 !important;
  }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1) !important;
  }
  input:focus::placeholder, textarea:focus::placeholder {
    color: transparent !important;
  }

  /* Phone-width helpers (matches useIsMobile's 768px). Most layout lives in
     inline style objects, so these use !important to override them — tag the
     element with the class instead of threading useIsMobile through. */
  @media (max-width: 767px) {
    .m-stack  { grid-template-columns: minmax(0, 1fr) !important; }
    .m-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .m-wrap   { flex-wrap: wrap !important; }
    .m-pad    { padding-left: 16px !important; padding-right: 16px !important; padding-top: 16px !important; }
    .m-full   { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
    .m-scroll-x { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
    .m-minw   { min-width: 640px !important; }
    .m-hide   { display: none !important; }
  }
  /* Back buttons are a phone thing — on the desktop web view people use the
     browser's back, the breadcrumb or the nav. Page-level back buttons carry
     .back-btn and only show at phone width. (Wizard-step "Back" buttons and
     in-page "back to list" views don't use this class — they stay.) */
  @media (min-width: 768px) {
    .back-btn { display: none !important; }
  }

  /* Row actions that desktop reveals on hover (⋯ menus, edit/delete icons,
     drag handles). Phones and tablets have no hover, so they'd stay hidden
     or faint — show them fully on touch screens and phone widths. Any new
     hover-revealed action should use .row-actions (or be added here). */
  @media (hover: none), (max-width: 767px) {
    .row-actions, .sp-dots-btn, .sop-row-action, .pg-handle { opacity: 1 !important; }
  }
`;
document.head.appendChild(globalStyle);

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </RootErrorBoundary>
);
