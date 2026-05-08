import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ConfigurationListSchema } from './configuration'

export const configurationQuery = queryOptions({
  queryKey: ['configuration'],
  queryFn: async () => {
    const data = await api<unknown>('/configuration/')
    return ConfigurationListSchema.parse(data)
  },
})

export const useConfiguration = () => {
  return useQuery(configurationQuery)
}
