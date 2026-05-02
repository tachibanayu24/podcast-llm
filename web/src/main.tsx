import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { consumeRedirectResult } from "./lib/auth";
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

let prevUid: string | null | undefined = undefined;
onAuthStateChanged(auth, (user) => {
  const uid = user?.uid ?? null;
  if (prevUid !== undefined && prevUid !== uid) {
    router.invalidate();
    if (!uid) queryClient.clear();
  }
  prevUid = uid;
});

void consumeRedirectResult();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
