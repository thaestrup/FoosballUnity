import { describe, expect, it } from 'vitest'
import {
  FlatTournamentSchema,
  RoundedTournamentSchema,
  TournamentGameSchema,
  TournamentRoundSchema,
} from './tournament'

const fullGame = {
  player_red_1: 'Lars',
  player_red_2: 'Joan',
  player_blue_1: 'Frank',
  player_blue_2: 'Daniel',
}

const wildcardGame = {
  player_red_1: 'Lars',
  player_red_2: null,
  player_blue_1: 'Frank',
  player_blue_2: null,
}

describe('TournamentGameSchema', () => {
  it('parses a fully populated game', () => {
    expect(TournamentGameSchema.parse(fullGame)).toEqual(fullGame)
  })

  it('allows null in any player slot (wildcard)', () => {
    expect(TournamentGameSchema.parse(wildcardGame)).toEqual(wildcardGame)
  })

  it('allows null in every slot', () => {
    const empty = {
      player_red_1: null,
      player_red_2: null,
      player_blue_1: null,
      player_blue_2: null,
    }
    expect(TournamentGameSchema.parse(empty)).toEqual(empty)
  })

  it('rejects when a player slot is omitted entirely', () => {
    const { player_red_1: _drop, ...partial } = fullGame
    expect(() => TournamentGameSchema.parse(partial)).toThrow()
  })

  it('rejects when a player slot is a number', () => {
    expect(() =>
      TournamentGameSchema.parse({ ...fullGame, player_red_1: 42 }),
    ).toThrow()
  })

  it('normalizes the literal string "null" to JS null in any slot', () => {
    // Mirrors a real backend response: Groovy concat writes "null" rather
    // than JSON null when a wildcard slot has no player.
    const raw = {
      player_red_1: 'Lars',
      player_red_2: 'null',
      player_blue_1: 'Frank',
      player_blue_2: 'null',
    }
    expect(TournamentGameSchema.parse(raw)).toEqual({
      player_red_1: 'Lars',
      player_red_2: null,
      player_blue_1: 'Frank',
      player_blue_2: null,
    })
  })

  it('normalizes the empty string to JS null in any slot', () => {
    const raw = {
      player_red_1: 'Lars',
      player_red_2: '',
      player_blue_1: '',
      player_blue_2: 'Daniel',
    }
    const parsed = TournamentGameSchema.parse(raw)
    expect(parsed.player_red_2).toBeNull()
    expect(parsed.player_blue_1).toBeNull()
  })
})

describe('TournamentRoundSchema', () => {
  it('parses a round wrapping an array of games', () => {
    const round = { tournamentGames: [fullGame, wildcardGame] }
    const parsed = TournamentRoundSchema.parse(round)
    expect(parsed.tournamentGames).toHaveLength(2)
  })

  it('rejects when tournamentGames is missing', () => {
    expect(() => TournamentRoundSchema.parse({})).toThrow()
  })
})

describe('FlatTournamentSchema (randomTournament response shape)', () => {
  it('parses a flat array of games', () => {
    const data = [fullGame, wildcardGame]
    const parsed = FlatTournamentSchema.parse(data)
    expect(parsed).toHaveLength(2)
    expect(parsed[1].player_red_2).toBeNull()
  })

  it('parses an empty list', () => {
    expect(FlatTournamentSchema.parse([])).toEqual([])
  })

  it('rejects an object payload', () => {
    expect(() => FlatTournamentSchema.parse({ tournamentGames: [] })).toThrow()
  })
})

describe('RoundedTournamentSchema (lastFirst / awesome response shape)', () => {
  it('parses an array of rounds, each containing tournamentGames', () => {
    const data = [
      { tournamentGames: [fullGame] },
      { tournamentGames: [wildcardGame] },
    ]
    const parsed = RoundedTournamentSchema.parse(data)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].tournamentGames[0].player_red_1).toBe('Lars')
  })

  it('parses an empty list', () => {
    expect(RoundedTournamentSchema.parse([])).toEqual([])
  })

  it('rejects a flat array of games', () => {
    expect(() => RoundedTournamentSchema.parse([fullGame])).toThrow()
  })
})
