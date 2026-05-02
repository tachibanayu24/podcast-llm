import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell";
import { waitForAuth } from "./lib/auth";
import { HomePage } from "./pages/HomePage";
import { SignInPage } from "./pages/SignInPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin",
  beforeLoad: async () => {
    const user = await waitForAuth();
    if (user) throw redirect({ to: "/" });
  },
  component: SignInPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  beforeLoad: async () => {
    const user = await waitForAuth();
    if (!user) throw redirect({ to: "/signin" });
  },
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: HomePage,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  protectedRoute.addChildren([indexRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
