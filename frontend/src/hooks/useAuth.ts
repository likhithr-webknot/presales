import { useQuery } from '@tanstack/react-query'
import { authApi, AuthUser } from '../services/api'

export type { AuthUser }

export function useAuth() {
  const { data: user, isLoading: loading } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: () => authApi.me().catch(() => null),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return { user: user ?? null, loading }
}
