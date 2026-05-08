import { z } from 'zod'

export const ConfigurationItemSchema = z.object({
  name: z.string(),
  value: z.string(),
})

export const ConfigurationListSchema = z.array(ConfigurationItemSchema)

export type ConfigurationItem = z.infer<typeof ConfigurationItemSchema>

export const getConfigValue = (items: ConfigurationItem[], name: string): string | undefined => {
  return items.find((i) => i.name === name)?.value
}

export const getNumberOfTables = (items: ConfigurationItem[] | undefined): number => {
  if (!items) return 1
  const v = getConfigValue(items, 'numberOfTables')
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 1
}

export const getTableNames = (items: ConfigurationItem[] | undefined): string[] => {
  if (!items) return []
  const count = getNumberOfTables(items)
  const names: string[] = []
  for (let i = 1; i <= count; i++) {
    const v = getConfigValue(items, `nameTable${i}`)
    if (v) names.push(v)
  }
  return names
}
