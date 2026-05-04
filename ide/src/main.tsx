import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './providers/QueryProvider';
import App from './components/App';
import './index.css';

// ── Global Error Boundary ────────────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Nexus] Uncaught error:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0A0A0B] text-white gap-4 p-8">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold text-red-400">Nexus encountered an error</h1>
          <p className="text-gray-400 text-sm max-w-lg text-center">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors"
            onClick={() => { this.setState({ hasError: false, error: null }); }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Mount ────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('[Nexus] Root element #root not found in DOM');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
);
