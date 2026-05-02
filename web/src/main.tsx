import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { auth } from "./lib/firebase";
import { useAuth } from "./hooks/useAuth";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

await auth.authStateReady();

function InnerApp() {
  const user = useAuth();

  useEffect(() => {
    router.invalidate();
    if (!user) queryClient.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return <RouterProvider router={router} context={{ user }} />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <InnerApp />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
