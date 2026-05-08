import { z } from 'zod'

export const PlayerSchema = z.object({
  name: z.string(),
  playerReady: z.boolean(),
  oprettet: z.string(),
  registeredRFIDTag: z.string(),
})

export const PlayerListSchema = z.array(PlayerSchema)

// /statisticsPlayersLastPlayed returns { "Player Name": <epoch-millis>, ... }
export const LastPlayedSchema = z.record(z.string(), z.number())

export type Player = z.infer<typeof PlayerSchema>
export type LastPlayed = z.infer<typeof LastPlayedSchema>
