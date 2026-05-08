import type { Player } from '@/features/players/player'
import type { Game } from '@/features/games/game'
import type { RankingItem } from '@/features/rankings/ranking'
import type { TimerAction } from '@/features/timer/timer'
import type { ConfigurationItem } from '@/features/configuration/configuration'
import type { TournamentRound } from '@/features/tournament/tournament'

let id = 1
const nextId = () => id++

export const makePlayer = (overrides: Partial<Player> = {}): Player => {
  return {
    name: `Player${nextId()}`,
    playerReady: false,
    oprettet: '2026-01-01 12:00:00.0',
    registeredRFIDTag: '',
    ...overrides,
  }
}

export const makeGame = (overrides: Partial<Game> = {}): Game => {
  const i = nextId()
  return {
    id: i,
    player_red_1: 'Lars',
    player_red_2: 'Joan',
    player_blue_1: 'Frank',
    player_blue_2: 'Daniel',
    lastUpdated: '2026-05-01 12:00:00.0',
    match_winner: 'red',
    points_at_stake: 25,
    winning_table: 1,
    ...overrides,
  }
}

export const makeRankingItem = (overrides: Partial<RankingItem> = {}): RankingItem => {
  return {
    name: `Player${nextId()}`,
    points: 1500,
    position: 1,
    numberOfGames: 0,
    ...overrides,
  }
}

export const makeTimer = (overrides: Partial<TimerAction> = {}): TimerAction => {
  return {
    id: 1,
    lastRequestedTimerStart: '2026-05-01 12:00:00.0',
    ...overrides,
  }
}

export const makeConfiguration = (): ConfigurationItem[] => {
  return [
    { name: 'numberOfTables', value: '3' },
    { name: 'nameTable1', value: 'Fort Nordjylland' },
    { name: 'nameTable2', value: 'John og Nikolaj Stadion' },
    { name: 'nameTable3', value: 'Henrik Park' },
  ]
}

export const makeTournamentRound = (games: Game[] = []): TournamentRound => {
  return {
    games: games.map((g) => ({
      player_red_1: g.player_red_1,
      player_red_2: g.player_red_2,
      player_blue_1: g.player_blue_1,
      player_blue_2: g.player_blue_2,
    })),
  }
}

// Reset the module-local id counter — call from afterEach() if a test
// asserts on specific generated names/ids. Most tests don't need this.
export const resetFactoryIds = (): void => {
  id = 1
}
