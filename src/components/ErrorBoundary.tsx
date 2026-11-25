import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unexpected application error' };
  }

  override componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0b1014] text-[#f4f7f5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#121a21] border border-white/10 rounded-xl p-8 space-y-4">
            <h1 className="text-2xl font-display font-bold tracking-tight">
              Connection Interrupted
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Green Valley encountered a runtime error. Reloading usually resolves temporary
              permission or WebGL context interruptions.
            </p>
            <div className="text-xs font-mono bg-black/40 border border-white/10 rounded-lg p-3 text-rose-300 break-words max-h-36 overflow-auto">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reload Green Valley
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
