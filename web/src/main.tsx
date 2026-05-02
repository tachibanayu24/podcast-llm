import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  }, [user?.uid]);

  return <RouterProvider router={router} context={{ user }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <InnerApp />
    </QueryClientProvider>
  </StrictMode>,
);
