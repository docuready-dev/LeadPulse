import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LeadPulse Caught Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Perform hard reload with cache-busting query to discard stale script bundles
    window.location.href = window.location.pathname + '?reload=' + Date.now();
  };

  private handleClearAndHome = () => {
    localStorage.removeItem('leadpulse-storage');
    window.location.href = '/?reload=' + Date.now();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-md p-6 shadow-xl text-center space-y-5">
            <div className="w-12 h-12 rounded-sm bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white">Application Exception</h2>
              <p className="text-xs text-slate-400">
                A component error occurred while rendering this view.
              </p>
              {this.state.error && (
                <div className="p-3 bg-black/60 rounded-sm text-left text-xs font-delight font-normal text-red-300 overflow-x-auto max-h-32 border border-slate-800">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full h-10 bg-white text-slate-950 rounded-md font-medium text-xs hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Workspace
              </button>
              <button
                onClick={this.handleClearAndHome}
                className="w-full h-10 bg-slate-800/80 border border-slate-700/80 text-slate-200 rounded-md font-medium text-xs hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" /> Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
