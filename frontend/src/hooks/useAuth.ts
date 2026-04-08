import { useState, useEffect } from 'react'
import axios from 'axios'

export interface AuthUser {
  id: string
  email: string
  name: string
  roles: string[]
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios
      .get<AuthUser>('/auth/me', { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
