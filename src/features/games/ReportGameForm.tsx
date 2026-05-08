import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import type { NavigateOptions } from '@tanstack/react-router'
import { usePlayers } from '@/features/players/usePlayers'
import { useReportGame } from './useGames'
import styles from './ReportGameForm.module.css'

const Schema = z
  .object({
    red1: z.string().min(1, 'Required'),
    red2: z.string().min(1, 'Required'),
    blue1: z.string().min(1, 'Required'),
    blue2: z.string().min(1, 'Required'),
    winner: z.enum(['red', 'blue', 'draw']),
    points: z.coerce.number().int().min(0).max(99),
    table: z.coerce.number().int().min(1).max(99),
  })
  .refine(
    ({ red1, red2, blue1, blue2 }) => new Set([red1, red2, blue1, blue2]).size === 4,
    { message: 'All four players must be different', path: ['blue2'] },
  )

type FormValues = z.infer<typeof Schema>

type Prefill = {
  red1: string
  red2: string
  blue1: string
  blue2: string
} | null

type Props = {
  prefill?: Prefill
  onCancel?: () => void
  onReported?: (id: number | undefined) => void
  /**
   * Where to navigate after a successful report when prefill came from the URL.
   * Defaults to the games list with cleared search params.
   */
  clearPrefillTo?: NavigateOptions
}

export const ReportGameForm = ({
  prefill = null,
  onCancel,
  onReported,
  clearPrefillTo = { to: '/games', search: {}, replace: true },
}: Props) => {
  const { data: players } = usePlayers()
  const reportGame = useReportGame()
  const navigate = useNavigate()

  const ready = useMemo(() => (players ?? []).filter((p) => p.playerReady), [players])
  const sortedPlayers = useMemo(
    () => [...(players ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  )

  const defaults: FormValues = useMemo(
    () => ({
      red1: prefill?.red1 ?? ready[0]?.name ?? '',
      red2: prefill?.red2 ?? ready[1]?.name ?? '',
      blue1: prefill?.blue1 ?? ready[2]?.name ?? '',
      blue2: prefill?.blue2 ?? ready[3]?.name ?? '',
      winner: 'red',
      points: 1,
      table: 1,
    }),
    [ready, prefill],
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    values: defaults,
    // Without this, every players-query refetch produces a fresh `defaults`
    // and RHF resets the entire form, wiping the user's typed-but-unsubmitted
    // input (Points, Table, etc).
    resetOptions: { keepDirtyValues: true },
  })

  const clearPrefillFromUrl = () => {
    if (prefill) {
      void navigate(clearPrefillTo)
    }
  }

  const onSubmit = (values: FormValues) => {
    reportGame.mutate(values, {
      onSuccess: (res) => {
        const id = res.newGameIDs?.[0]
        reset(defaults)
        clearPrefillFromUrl()
        onReported?.(id ? Number(id) : undefined)
      },
    })
  }

  const handleCancel = () => {
    reset(defaults)
    clearPrefillFromUrl()
    onCancel?.()
  }

  const playerOptions = sortedPlayers.map((p) => (
    <option key={p.name} value={p.name}>
      {p.name}
    </option>
  ))

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset className={styles.team}>
        <legend className={styles.teamLegend} data-color="red">
          Red team
        </legend>
        <PlayerSelect name="red1" control={control} disabled={isSubmitting}>
          {playerOptions}
        </PlayerSelect>
        <PlayerSelect name="red2" control={control} disabled={isSubmitting}>
          {playerOptions}
        </PlayerSelect>
      </fieldset>

      <fieldset className={styles.team}>
        <legend className={styles.teamLegend} data-color="blue">
          Blue team
        </legend>
        <PlayerSelect name="blue1" control={control} disabled={isSubmitting}>
          {playerOptions}
        </PlayerSelect>
        <PlayerSelect name="blue2" control={control} disabled={isSubmitting}>
          {playerOptions}
        </PlayerSelect>
      </fieldset>

      <fieldset className={styles.outcome}>
        <legend>Winner</legend>
        <label className={styles.radio}>
          <input type="radio" value="red" {...register('winner')} disabled={isSubmitting} />
          Red
        </label>
        <label className={styles.radio}>
          <input type="radio" value="blue" {...register('winner')} disabled={isSubmitting} />
          Blue
        </label>
        <label className={styles.radio}>
          <input type="radio" value="draw" {...register('winner')} disabled={isSubmitting} />
          Tie
        </label>
      </fieldset>

      <div className={styles.numbers}>
        <label className={styles.numberField}>
          <span>Points</span>
          <input
            type="number"
            min={0}
            max={99}
            className={styles.numberInput}
            {...register('points')}
            disabled={isSubmitting}
          />
        </label>
        <label className={styles.numberField}>
          <span>Table</span>
          <input
            type="number"
            min={1}
            max={99}
            className={styles.numberInput}
            {...register('table')}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Reporting…' : 'Report game'}
        </button>
        {onCancel && (
          <button
            type="button"
            className={styles.cancel}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
      </div>

      {Object.entries(errors).map(([field, err]) => (
        <span key={field} className={styles.error} role="alert">
          {field}: {err?.message ?? 'Invalid'}
        </span>
      ))}
      {reportGame.isError && (
        <span className={styles.error} role="alert">
          {reportGame.error.message}
        </span>
      )}
    </form>
  )
}

const PlayerSelect = ({
  name,
  control,
  disabled,
  children,
}: {
  name: 'red1' | 'red2' | 'blue1' | 'blue2'
  control: Control<FormValues>
  disabled: boolean
  children: ReactNode
}) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <select
          {...field}
          value={field.value ?? ''}
          className={styles.select}
          disabled={disabled}
        >
          <option value="">Pick a player…</option>
          {children}
        </select>
      )}
    />
  )
}
