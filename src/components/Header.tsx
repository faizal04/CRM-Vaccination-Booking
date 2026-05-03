import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex justify-between items-center px-8 font-manrope text-sm font-medium">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">search</span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all"
            placeholder="Search patients, vaccines, or bookings…"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button className="hover:bg-slate-50 rounded-full p-2 transition-colors relative text-slate-500">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <a
            href="https://www.kahlidvaccinator.in"
            target="_blank"
            rel="noreferrer"
            className="hover:bg-slate-50 rounded-full p-2 transition-colors text-slate-500"
            title="Open main site"
          >
            <span className="material-symbols-outlined">open_in_new</span>
          </a>
        </div>
        <div className="h-8 w-[1px] bg-slate-200" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-900 leading-none">{profile?.full_name ?? 'Admin'}</p>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Admin</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm hover:bg-emerald-200 transition-colors"
            title="Sign out"
          >
            {(profile?.full_name ?? 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </button>
        </div>
      </div>
    </header>
  )
}
