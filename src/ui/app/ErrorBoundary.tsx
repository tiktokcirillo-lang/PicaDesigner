import { Component, type ErrorInfo, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace render failure", error.name, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>Não foi possível abrir o workspace.</h1>
        <p>
          Recarregue a página. Seus dados persistidos no servidor não foram
          alterados.
        </p>
        <button
          className="button button--primary"
          onClick={() => location.reload()}
        >
          Recarregar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
