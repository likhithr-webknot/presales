export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0f1e',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#111827',
        borderRadius: '12px',
        border: '1px solid #1f2937',
        maxWidth: '400px',
        width: '100%',
      }}>
        <div style={{ marginBottom: '8px', fontSize: '13px', color: '#06b6d4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Webknot Technologies
        </div>
        <h1 style={{ color: '#f9fafb', fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
          Presales Orchestrator
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 36px' }}>
          AI-powered collateral production for your sales team
        </p>
        <a
          href="/auth/google"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#1d4ed8',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '15px',
            transition: 'background 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#fff"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#fff"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#fff"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff"/>
          </svg>
          Sign in with Google
        </a>
        {window.location.search.includes('error=auth_failed') && (
          <p style={{ color: '#f87171', fontSize: '13px', marginTop: '16px' }}>
            Authentication failed. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}
