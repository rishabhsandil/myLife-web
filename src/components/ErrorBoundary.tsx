import React from 'react';
import './ErrorBoundary.css';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

/**
 * App-level error boundary. Prevents a render error from blanking the screen.
 *
 * In development the error message is shown. In production we show a generic
 * message and offer a reload — we never want to leak stack details to users.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Last-resort logging; keep details out of UI.
    // eslint-disable-next-line no-console
    console.error('Render error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h1>Something went wrong</h1>
            <p>The app hit an unexpected error. Try reloading.</p>
            {isDev && (
              <pre className="error-boundary-details">{this.state.error.message}</pre>
            )}
            <button type="button" className="error-boundary-button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
