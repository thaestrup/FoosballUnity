import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/useTheme'
import { SelectedFacepile } from '@/features/players/SelectedFacepile'
import { HeaderTimer } from '@/features/timer/HeaderTimer'
import { playersQuery } from '@/features/players/usePlayers'
import { ErrorNotice } from '@/components/ErrorNotice'
import { BackendUrlBadge } from '@/components/BackendUrlBadge'
import { useTimerSocket } from '@/features/timer/timerSocket'
import styles from './__root.module.css'

// Renders nothing — its job is to open exactly one WebSocket subscription
// to the timer endpoint and write incoming frames to the React Query
// cache. Lives in the root so it survives navigation between routes.
const TimerSubscription = () => {
  useTimerSocket()
  return null
}

const RootComponent = () => {
  const [theme, , toggle] = useTheme()

  return (
    <div className={styles.shell}>
      <TimerSubscription />
      <header className={styles.header}>
        <h1 className={styles.title}>FoosballUnity</h1>
        <nav className={styles.nav}>
          <Link to="/" className={styles.link} activeProps={{ className: styles.active }}>
            Home
          </Link>
          <Link
            to="/players"
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Players
          </Link>
          <Link
            to="/games"
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Games
          </Link>
          <Link
            to="/rankings"
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Rankings
          </Link>
          <Link
            to="/tournament"
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Tournament
          </Link>
        </nav>
        <HeaderTimer />
        <SelectedFacepile />
        <BackendUrlBadge />
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(playersQuery),
  component: RootComponent,
  pendingComponent: () => <p className={styles.pending}>Loading…</p>,
  errorComponent: ({ error, reset }) => (
    <div className={styles.errorWrap}>
      <ErrorNotice
        title="Couldn't load the app"
        error={error as Error}
        onRetry={reset}
      />
    </div>
  ),
})
