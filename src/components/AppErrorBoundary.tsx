import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Optional label for which subtree crashed (shown in the fallback). */
  label?: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Prevents a render/HMR crash from leaving only the dark ocean background.
 * Vite Fast Refresh can drop NetworkProvider; without a boundary React unmounts #root.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[AppErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`,
      error,
      info.componentStack
    );
  }

  componentDidMount() {
    const hot = (import.meta as { hot?: { on: (e: string, cb: () => void) => void } }).hot;
    hot?.on("vite:beforeUpdate", () => {
      if (this.state.error) this.setState({ error: null });
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="relative z-50 mx-auto max-w-lg p-6 text-center">
        <div className="rounded-xl border border-red-500/40 bg-slate-950/90 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">
            {this.props.label
              ? `${this.props.label} failed to load`
              : "Something went wrong"}
          </h2>
          <p className="mt-2 text-sm text-red-300 break-words">
            {error.message || String(error)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Hard reload (Cmd+Shift+R) if this followed a hot reload.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-ocean-teal px-4 py-2 text-sm font-medium text-white hover:bg-ocean-teal/90"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
