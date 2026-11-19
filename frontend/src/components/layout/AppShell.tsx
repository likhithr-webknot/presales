import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const close = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <Outlet />
      </div>
      <CommandPalette open={paletteOpen} onClose={close} />
    </div>
  )
}
