import { AlertCircle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ErrorBoundary caught", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <Card className="max-w-md p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            <h1 className="text-lg font-bold">問題が発生しました</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            画面の表示中にエラーが発生しました。再読み込みするか、ホームに戻ってお試しください。
          </p>
          <details className="text-xs text-muted-foreground/80">
            <summary className="cursor-pointer">詳細</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          </details>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              再読み込み
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.reset}
            >
              続ける
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
