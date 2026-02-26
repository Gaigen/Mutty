import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center space-y-4 max-w-md px-4">
            <h2 className="text-xl text-red-400">Что-то пошло не так</h2>
            <p className="text-gray-400 text-sm font-mono bg-gray-900 rounded px-3 py-2">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
              onClick={this.handleReset}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
