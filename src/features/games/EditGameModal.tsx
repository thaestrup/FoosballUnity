import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatDbTimestamp } from '@/lib/time'
import { useUpdateGame } from './useGames'
import { winnerSide, type Game } from './game'
import { useRankings } from '@/features/rankings/useRankings'
import { stakeFor, teamTotal } from '@/features/rankings/stakes'
import styles from './EditGameModal.module.css'

// winning_table isn't editable here — it's a metadata field describing
// which physical table the match was played on. The original value is
// sent unchanged on save.
const Schema = z.object({
  winner: z.enum(['red', 'blue', 'draw']),
  points_at_stake: z.coerce.number().int().min(0).max(99),
})

type FormValues = z.infer<typeof Schema>

type Props = {
  game: Game
  onClose: () => void
  onSaved?: (updated: Game) => void
}

// winnerSide returns 'red' | 'blue' | 'tie' | 'unknown'. Map both 'tie'
// and the rare 'unknown' to 'draw' as the safe form default — the user
// can change it on save.
const sideToFormWinner = (m: string): FormValues['winner'] => {
  const s = winnerSide(m)
  if (s === 'red' || s === 'blue') return s
  return 'draw'
}

const displayName = (n: string | null): string => n ?? 'Wildcard'

const teamLabel = (one: string | null, two: string | null): string => {
  const names = [one, two].filter((n): n is string => n != null)
  if (names.length === 0) return 'No players'
  return names.join(' & ')
}

export const EditGameModal = ({ game, onClose, onSaved }: Props) => {
  const updateGame = useUpdateGame()
  // Use the alltime rankings to compute the ELO stakes for the current
  // matchup. Rankings is already in the cache for most users via the
  // sidebar / rankings page, so this rarely triggers a fresh fetch.
  const { data: rankings } = useRankings('alltime')
  const redTotal = teamTotal(rankings, game.player_red_1, game.player_red_2)
  const blueTotal = teamTotal(rankings, game.player_blue_1, game.player_blue_2)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      winner: sideToFormWinner(game.match_winner),
      points_at_stake: game.points_at_stake,
    },
  })

  // When the user picks a different winner, recompute the suggested stake
  // from the current rankings so the points field stays in sync with the
  // outcome. The field is still editable — admins can override.
  const onWinnerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = e.target.value as FormValues['winner']
    setValue('points_at_stake', stakeFor(w, redTotal, blueTotal), {
      shouldDirty: true,
    })
  }

  const onSubmit = (values: FormValues) => {
    updateGame.mutate(
      {
        id: game.id,
        player_red_1: game.player_red_1,
        player_red_2: game.player_red_2,
        player_blue_1: game.player_blue_1,
        player_blue_2: game.player_blue_2,
        match_winner: values.winner,
        points_at_stake: values.points_at_stake,
        winning_table: game.winning_table,
      },
      {
        onSuccess: (updated) => {
          onSaved?.(updated)
          onClose()
        },
      },
    )
  }

  const busy = isSubmitting || updateGame.isPending

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <p className={styles.meta}>
        Game <strong>#{game.id}</strong> · played{' '}
        {formatDbTimestamp(game.lastUpdated)}
      </p>

      <div className={styles.teams}>
        <div className={styles.team} data-side="red">
          <span className={styles.teamLabel}>Red</span>
          <span className={styles.teamNames}>
            {teamLabel(game.player_red_1, game.player_red_2)}
          </span>
        </div>
        <div className={styles.team} data-side="blue">
          <span className={styles.teamLabel}>Blue</span>
          <span className={styles.teamNames}>
            {teamLabel(game.player_blue_1, game.player_blue_2)}
          </span>
        </div>
      </div>
      <p className={styles.note}>
        Player slots aren&apos;t editable in this view. Delete the game and
        re-report it if the lineup is wrong.
      </p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Winner</legend>
        {/* Red / Tie / Blue ordering — Tie sits between the two teams so
            the layout mirrors the physical match. */}
        <label className={styles.radioRow}>
          <input
            type="radio"
            value="red"
            {...register('winner', { onChange: onWinnerChange })}
          />
          <span>Red {game.player_red_1 ? `(${displayName(game.player_red_1)})` : ''}</span>
        </label>
        <label className={styles.radioRow}>
          <input
            type="radio"
            value="draw"
            {...register('winner', { onChange: onWinnerChange })}
          />
          <span>Tie / Draw</span>
        </label>
        <label className={styles.radioRow}>
          <input
            type="radio"
            value="blue"
            {...register('winner', { onChange: onWinnerChange })}
          />
          <span>Blue {game.player_blue_1 ? `(${displayName(game.player_blue_1)})` : ''}</span>
        </label>
        {errors.winner && (
          <p className={styles.error}>{errors.winner.message}</p>
        )}
      </fieldset>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Points at stake</span>
        <input
          type="number"
          className={styles.input}
          min={0}
          max={99}
          {...register('points_at_stake')}
        />
        {errors.points_at_stake && (
          <span className={styles.error}>
            {errors.points_at_stake.message}
          </span>
        )}
      </label>

      {updateGame.isError && (
        <p className={styles.error} role="alert">
          Couldn&apos;t save: {updateGame.error.message}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
