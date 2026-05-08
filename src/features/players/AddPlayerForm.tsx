import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAddPlayer, usePlayers } from './usePlayers'
import styles from './AddPlayerForm.module.css'

const FormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(20, 'Name must be 20 characters or fewer')
    .regex(/^[\p{L}0-9 -]+$/u, 'Letters, digits, spaces and hyphens only'),
})
type FormValues = z.infer<typeof FormSchema>

type Props = {
  onAdded?: (name: string) => void
  onCancel?: () => void
}

export const AddPlayerForm = ({ onAdded, onCancel }: Props) => {
  const { data: players } = usePlayers()
  const addPlayer = useAddPlayer()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '' },
  })

  const onSubmit = (values: FormValues) => {
    const name = values.name.trim()
    if (players?.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError('name', { message: `${name} is already on the list` })
      return
    }
    addPlayer.mutate(
      { name },
      {
        onSuccess: () => {
          reset()
          onAdded?.(name)
        },
        onError: (err) => {
          setError('name', { message: err.message })
        },
      },
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <input
        type="text"
        placeholder="Player name"
        className={styles.input}
        autoFocus
        aria-invalid={errors.name ? 'true' : 'false'}
        aria-describedby={errors.name ? 'add-player-error' : undefined}
        disabled={isSubmitting}
        {...register('name')}
      />
      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? 'Adding…' : 'Add'}
      </button>
      {onCancel && (
        <button
          type="button"
          className={styles.cancel}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      )}
      {errors.name && (
        <span id="add-player-error" className={styles.error} role="alert">
          {errors.name.message}
        </span>
      )}
    </form>
  )
}
