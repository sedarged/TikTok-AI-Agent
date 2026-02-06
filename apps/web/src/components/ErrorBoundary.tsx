import React from 'react';
import { getErrorMessage } from '../utils/errors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: getErrorMessage(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error boundary caught an error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="card max-w-lg text-center space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {this.state.error || 'An unexpected error occurred.'}
            </p>
            <button type="button" onClick={this.handleReload} className="btn btn-primary">
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
