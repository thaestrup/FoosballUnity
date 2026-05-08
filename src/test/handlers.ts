import { http, HttpResponse } from 'msw'
import {
  makeConfiguration,
  makeGame,
  makePlayer,
  makeRankingItem,
  makeTimer,
} from './factories'

const BASE = 'http://localhost:5050'

// Default handlers cover every endpoint the frontend currently calls.
// Individual tests can override by adding handlers via `server.use(...)`.
export const handlers = [
  // GET /players/
  http.get(`${BASE}/players/`, () =>
    HttpResponse.json([
      makePlayer({ name: 'Lars', playerReady: true }),
      makePlayer({ name: 'Joan', playerReady: true }),
      makePlayer({ name: 'Frank', playerReady: false }),
      makePlayer({ name: 'Daniel', playerReady: false }),
    ]),
  ),

  // POST /players/ — backend returns plain text
  http.post(`${BASE}/players/`, () =>
    HttpResponse.text('insertPlayer: NewPlayer, result: 1'),
  ),

  // PUT /players/:name — backend returns plain text
  http.put(`${BASE}/players/:name`, () =>
    HttpResponse.text('overwritePlayer: X, result: 1'),
  ),

  // DELETE /players/:name
  http.delete(`${BASE}/players/:name`, () =>
    HttpResponse.text('deletePlayer: X, result: 1'),
  ),

  // GET /games/{period|name}
  http.get(`${BASE}/games/:idOrPeriod`, () => HttpResponse.json([makeGame()])),

  // POST /games/
  http.post(`${BASE}/games/`, () => HttpResponse.json({ newGameIDs: ['1'] })),

  // DELETE /games/
  http.delete(`${BASE}/games/`, () =>
    HttpResponse.text('cleanGameTable: 1'),
  ),

  // GET /configuration/
  http.get(`${BASE}/configuration/`, () => HttpResponse.json(makeConfiguration())),

  // GET /timer
  http.get(`${BASE}/timer`, () => HttpResponse.json([makeTimer()])),

  // POST /timer
  http.post(`${BASE}/timer`, () => HttpResponse.text('result: 1')),

  // GET /pointsPrPlayer/{period}
  http.get(`${BASE}/pointsPrPlayer/:period`, () =>
    HttpResponse.json([
      makeRankingItem({ name: 'Lars', points: 1530, position: 1 }),
      makeRankingItem({ name: 'Joan', points: 1510, position: 2 }),
      makeRankingItem({ name: 'Frank', points: 1490, position: 3 }),
    ]),
  ),

  // GET /statisticsPlayersLastPlayed/
  http.get(`${BASE}/statisticsPlayersLastPlayed/`, () => HttpResponse.json({})),

  // POST /tournament/{algorithm}/
  http.post(`${BASE}/tournament/randomTournament/`, () =>
    HttpResponse.json([
      {
        id: -1,
        player_red_1: 'Lars',
        player_red_2: 'Joan',
        player_blue_1: 'Frank',
        player_blue_2: 'Daniel',
        lastUpdated: '2026-05-01 12:00:00',
        match_winner: '',
        points_at_stake: -1,
        winning_table: -1,
      },
    ]),
  ),
  http.post(`${BASE}/tournament/lastFirstTournament/`, () =>
    HttpResponse.json([
      {
        tournamentGames: [
          {
            id: -1,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            lastUpdated: '2026-05-01 12:00:00',
            match_winner: '',
            points_at_stake: -1,
            winning_table: -1,
          },
        ],
      },
    ]),
  ),
  http.post(`${BASE}/tournament/awesomeAlgorithmTournament/`, () =>
    HttpResponse.json([
      {
        tournamentGames: [
          {
            id: -1,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            lastUpdated: '2026-05-01 12:00:00',
            match_winner: '',
            points_at_stake: -1,
            winning_table: -1,
          },
        ],
      },
    ]),
  ),
]
