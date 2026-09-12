import { Component, type ErrorInfo, type ReactNode } from "react";

type FallbackRender = (args: {
  error: Error;
  retry: () => void;
}) => ReactNode;

interface IsolateErrorBoundaryProps {
  children: ReactNode;
  /** Console prefix, e.g. "Cash out". */
  label?: string;
  fallback?: ReactNode | FallbackRender;
}

interface IsolateErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/import errors in a subtree without unmounting ancestors.
 * Used so cash-out / MoonPay cannot trip PrivyMountErrorBoundary.
 */
export class IsolateErrorBoundary extends Component<
  IsolateErrorBoundaryProps,
  IsolateErrorBoundaryState
> {
  state: IsolateErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): IsolateErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[IsolateErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`,
      error,
      info.componentStack
    );
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback, label } = this.props;
    if (typeof fallback === "function") {
      return fallback({ error, retry: this.retry });
    }
    if (fallback) return fallback;

    return (
      <div className="space-y-3 text-center" role="alert">
        <p className="text-sm text-destructive">
          {label ? `${label} failed.` : "Something went wrong."}{" "}
          {error.message}
        </p>
        <button
          type="button"
          className="text-sm font-semibold text-ocean-teal hover:underline"
          onClick={this.retry}
        >
          Try again
        </button>
      </div>
    );
  }
}
