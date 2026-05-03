import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { to: '/appointments', label: 'Appointments', icon: 'calendar_today', exact: false },
  { to: '/patients', label: 'Patients', icon: 'group', exact: false },
  { to: '/schedule', label: 'Schedule', icon: 'event_note', exact: false },
  { to: '/vaccines', label: 'Vaccines', icon: 'medication', exact: false },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-40 bg-emerald-900 dark:bg-slate-950 border-r border-emerald-800/50 shadow-2xl shadow-emerald-950/20 flex flex-col py-6 font-manrope antialiased tracking-tight">
      {/* Logo */}
      <div className="px-6 mb-10">
        <div className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-fixed">vaccines</span>
          <span>Khalid Admin</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 mt-1 font-bold">Vaccination CMS</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              isActive
                ? 'border-l-4 border-amber-500 bg-emerald-800/40 text-white font-semibold py-3 px-6 flex items-center transition-all'
                : 'text-emerald-100/70 hover:text-white py-3 px-6 flex items-center transition-colors hover:bg-emerald-800/30'
            }
          >
            <span className="material-symbols-outlined mr-3">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile + sign out */}
      <div className="px-6 mt-auto space-y-3">
        <div className="flex items-center gap-3 py-2">
          <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(profile?.full_name ?? 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-semibold text-sm truncate">{profile?.full_name ?? 'Admin'}</p>
            <p className="text-emerald-400/70 text-[10px] uppercase tracking-wider font-bold">Admin</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 py-2 px-3 text-emerald-300/70 hover:text-white hover:bg-emerald-800/40 rounded-lg transition-all text-sm"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
