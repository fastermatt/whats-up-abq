'use client'

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-xs text-white/40 hover:text-red-400 transition-colors"
      onClick={async () => {
        await fetch('/api/admin/login', { method: 'DELETE' })
        window.location.href = '/admin/login'
      }}
    >
      Logout
    </button>
  )
}
