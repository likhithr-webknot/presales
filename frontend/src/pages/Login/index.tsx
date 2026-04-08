export default function LoginPage() {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#030712', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        padding: '48px 40px', borderRadius: 16, width: 360, textAlign: 'center',
        backgroundColor: '#0a0f1e', border: '1px solid #1e293b',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏛️</div>
        <h1 style={{ color: '#f9fafb', fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>
          Presales Orchestrator
        </h1>
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 32px' }}>
          Webknot AI Delivery Platform
        </p>
        <a
          href={`${apiBase}/auth/google`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '12px 24px', borderRadius: 8, textDecoration: 'none',
            backgroundColor: '#1e40af', color: '#f1f5f9', fontWeight: 600, fontSize: 14,
            border: '1px solid #1d4ed8', transition: 'background 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>
      </div>
    </div>
  )
}
