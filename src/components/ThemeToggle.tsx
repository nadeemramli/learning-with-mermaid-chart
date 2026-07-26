import { useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggle = () => {
    setDark((current) => {
      const next = !current
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <button
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-md border text-sm"
      style={{ borderColor: 'var(--node-border)', color: 'var(--group-title)' }}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? '☀' : '☾'}
    </button>
  )
}
