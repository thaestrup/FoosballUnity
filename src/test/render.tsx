import { type ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'

type RenderWithProvidersOptions = RenderOptions & {
  /** Initial URL the in-memory router should land on. Defaults to "/". */
  initialUrl?: string
  /**
   * Pre-seeded TanStack Query data, keyed by query key. The key gets passed
   * straight to `setQueryData`, so e.g. ['players'] or ['games', 'week'].
   */
  preloadedQueries?: Record<string, unknown>
}

/**
 * Render a component inside a fresh QueryClient and an in-memory TanStack
 * Router. Avoids cache leakage between tests and gives us a real router so
 * <Link> works without errors.
 */
export const renderWithProviders = (
  ui: ReactNode,
  options: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } => {
  const { initialUrl = '/', preloadedQueries, ...renderOptions } = options

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })

  if (preloadedQueries) {
    for (const [keyJson, value] of Object.entries(preloadedQueries)) {
      queryClient.setQueryData(JSON.parse(keyJson), value)
    }
  }

  // Minimal in-memory router: a single root route that renders the test UI.
  const rootRoute = createRootRoute({ component: Outlet })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{ui}</>,
  })
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <>{ui}</>,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
    context: { queryClient },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    renderOptions,
  )

  return Object.assign(result, { queryClient })
}
