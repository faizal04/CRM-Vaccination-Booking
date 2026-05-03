import { useEffect, useState } from 'react'
import { supabase, type Profile, type Booking } from '../lib/supabase'

type PatientRow = Profile & { bookingCount: number; lastBooking: string | null }

function whatsappUrl(phone: string) {
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/${clean}`
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    done: 'bg-emerald-100 text-emerald-700',
    missed: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] ?? map.pending}`}>{status}</span>
}

export default function Patients() {
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PatientRow | null>(null)

  useEffect(() => {
    async function load() {
      const [profilesRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('date', { ascending: false }),
      ])
      const profiles: Profile[] = profilesRes.data ?? []
      const bookings: Booking[] = bookingsRes.data ?? []
      setAllBookings(bookings)

      const rows: PatientRow[] = profiles.map(p => {
        const pb = bookings.filter(b => b.user_id === p.id)
        return {
          ...p,
          bookingCount: pb.length,
          lastBooking: pb[0]?.date ?? null,
        }
      })
      setPatients(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = search.trim()
    ? patients.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search) ||
        p.id.toLowerCase().includes(search.toLowerCase())
      )
    : patients

  const drawerBookings = selected ? allBookings.filter(b => b.user_id === selected.id) : []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-h1 text-h1 text-on-background">Patients</h1>
        <p className="text-body-md text-on-surface-variant">All registered users and their booking history.</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-center border border-slate-100 mb-6">
        <div className="relative flex-1 group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
          <input
            className="w-full border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
            placeholder="Search by name, phone, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-slate-400">Loading patients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
            <p className="font-medium">No patients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Total Bookings</th>
                  <th className="px-6 py-4">Last Booking</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors text-sm"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                          {(p.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-950">{p.full_name ?? '—'}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {p.phone ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <a href={`tel:${p.phone}`} className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors" title="Call">
                            <span className="material-symbols-outlined text-sm">call</span>
                          </a>
                          <a href={whatsappUrl(p.phone)} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition-colors" title="WhatsApp">
                            <span className="material-symbols-outlined text-sm">chat</span>
                          </a>
                          <span className="text-xs text-slate-600 ml-1">{p.phone}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-emerald-900">{p.bookingCount}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {p.lastBooking
                        ? new Date(p.lastBooking + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(p) }}
                        className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs flex items-center gap-1 ml-auto"
                      >
                        History <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking history drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="px-6 py-5 bg-emerald-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-sm">
                  {(selected.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold">{selected.full_name ?? 'Unknown'}</p>
                  <p className="text-emerald-300 text-xs">{selected.phone ?? 'No phone'}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="hover:bg-emerald-800 rounded-lg p-2 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Stats row */}
            <div className="px-6 py-4 border-b border-slate-100 flex gap-4 flex-shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-900">{drawerBookings.length}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{drawerBookings.filter(b => b.status === 'done').length}</p>
                <p className="text-xs text-slate-500">Done</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{drawerBookings.filter(b => b.status === 'pending').length}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{drawerBookings.filter(b => b.status === 'missed').length}</p>
                <p className="text-xs text-slate-500">Missed</p>
              </div>
            </div>

            {/* Booking list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Booking History</h4>
              {drawerBookings.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <span className="material-symbols-outlined text-3xl mb-1 block">event_busy</span>
                  <p className="text-sm">No bookings yet</p>
                </div>
              ) : drawerBookings.map(b => (
                <div key={b.id} className="border border-slate-100 rounded-xl p-4 hover:border-emerald-200 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-emerald-950 text-sm">{b.vaccine}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    {statusBadge(b.status ?? 'pending')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><span className="font-medium">Patient:</span> {b.patient_name} {b.age ? `(${b.age}y)` : ''}</p>
                    {b.address && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={e => e.stopPropagation()}>
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {b.address}
                      </a>
                    )}
                    <p className="font-mono text-[10px] text-slate-400">{b.id}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            {selected.phone && (
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <a href={`tel:${selected.phone}`} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-semibold text-sm hover:bg-emerald-100 transition-colors">
                  <span className="material-symbols-outlined text-sm">call</span>
                  Call
                </a>
                <a href={whatsappUrl(selected.phone)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 text-green-700 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors">
                  <span className="material-symbols-outlined text-sm">chat</span>
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
