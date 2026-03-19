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
  *, *::before, *::after { font-family: system-ui, -apple-system, sans-serif; }

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
`;
document.head.appendChild(globalStyle);

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </RootErrorBoundary>
);
