import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HotelProvider } from "./state/HotelProvider";
import "./styles/app.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="fatal">
          <h1>StayFlow hit a problem</h1>
          <p>{this.state.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <HotelProvider>
        <App />
      </HotelProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
