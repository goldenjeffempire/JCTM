import { Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("JCTM ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md w-full text-center"
          >
            <div className="glass-panel rounded-3xl p-10 border border-destructive/20">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-primary mb-3">
                Something Went Wrong
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                We encountered an unexpected error. Our team has been notified. Please try refreshing the page.
              </p>
              <p className="text-accent italic text-sm mb-8">
                "And we know that all things work together for good to those who love God." — Romans 8:28
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => this.setState({ hasError: false })}
                  className="rounded-full bg-accent text-white hover:bg-accent/90"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { window.location.href = "/"; }}
                  className="rounded-full border-primary text-primary"
                >
                  Return Home
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
