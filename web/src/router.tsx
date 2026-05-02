import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import type { User } from "firebase/auth";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { PodcastDetailPage } from "./pages/PodcastDetailPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignInPage } from "./pages/SignInPage";
import { WatchlistPage } from "./pages/WatchlistPage";

interface RouterContext {
  user: User | null;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin",
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: "/" });
  },
  component: SignInPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/signin" });
  },
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: HomePage,
});

const searchRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/search",
  component: SearchPage,
});

const watchlistRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/watchlist",
  component: WatchlistPage,
});

const podcastDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/podcast/$id",
  component: PodcastDetailPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  protectedRoute.addChildren([
    indexRoute,
    searchRoute,
    watchlistRoute,
    podcastDetailRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { user: null },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
