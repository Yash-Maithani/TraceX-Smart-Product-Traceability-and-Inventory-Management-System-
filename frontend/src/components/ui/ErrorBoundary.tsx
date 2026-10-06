import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../lib/logger';
import { ErrorState } from './States';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.'
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Uncaught UI ErrorBoundary exception', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main id="main-content" tabIndex={-1}>
          <ErrorState
            title="Application Error"
            description={this.state.message}
            onRetry={() => {
              this.setState({ hasError: false, message: '' });
              window.location.reload();
            }}
          />
        </main>
      );
    }
    return this.props.children;
  }
}
