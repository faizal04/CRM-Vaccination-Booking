import { useEffect, useState } from 'react'
import { supabase, type Booking } from '../lib/supabase'

type FilterTab = 'upcoming' | 'past' | 'all'

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-100',
    done: 'bg-emerald-100 text-emerald-700',
    missed: 'bg-red-100 text-red-700',
  }
  const icons: Record<string, string> = { pending: 'schedule', done: 'check', missed: 'close' }
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${map[status] ?? map.pending}`}>
      <span className="material-symbols-outlined text-sm">{icons[status] ?? 'schedule'}</span>
      {label}
    </span>
  )
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function whatsappUrl(phone: string) {
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/${clean}`
}

export default function Appointments() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('upcoming')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null)
  const [newDate, setNewDate] = useState('')

  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select('*').order('date', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchBookings() }, [])

  async function updateStatus(id: string, status: 'done' | 'missed' | 'pending') {
    setActionLoading(id + status)
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    setActionLoading(null)
  }

  async function reschedule() {
    if (!rescheduleBooking || !newDate) return
    setActionLoading('reschedule')
    await supabase.from('bookings').update({ date: newDate, status: 'pending' }).eq('id', rescheduleBooking.id)
    setBookings(prev => prev.map(b => b.id === rescheduleBooking.id ? { ...b, date: newDate, status: 'pending' } : b))
    setRescheduleBooking(null)
    setNewDate('')
    setActionLoading(null)
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const today = todayISO()
  let filtered = bookings

  if (filter === 'upcoming') filtered = filtered.filter(b => b.date >= today)
  else if (filter === 'past') filtered = filtered.filter(b => b.date < today)

  if (selectedDate) filtered = filtered.filter(b => b.date === selectedDate)

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(b =>
      b.patient_name?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q) ||
      b.vaccine?.toLowerCase().includes(q)
    )
  }

  const counts = {
    upcoming: bookings.filter(b => b.date >= today).length,
    past: bookings.filter(b => b.date < today).length,
    all: bookings.length,
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-h1 text-h1 text-on-background">Appointments</h1>
          <p className="text-body-md text-on-surface-variant">Manage and track all vaccination bookings.</p>
        </div>
        <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 shadow-sm">
          {(['upcoming', 'past', 'all'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setFilter(tab); if (tab === 'upcoming') setSelectedDate(today); else setSelectedDate('') }}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${filter === tab ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:bg-white/50'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1 text-xs opacity-60">({counts[tab]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center border border-slate-100">
        <div className="relative flex-1 min-w-[200px] group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
          <input
            className="w-full border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
            placeholder="Search by name, ID, or vaccine…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">calendar_month</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
          />
        </div>
        {selectedDate && (
          <button onClick={() => setSelectedDate('')} className="text-slate-400 hover:text-slate-600 text-xs font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">close</span> Clear date
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-slate-400">Loading appointments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
            <p className="font-medium">No appointments found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Vaccine</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors text-sm">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{b.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                          {b.patient_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">{b.patient_name}</p>
                          {b.age && <p className="text-xs text-slate-400">Age {b.age}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-[140px]">{b.vaccine}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 max-w-[180px]">
                      {b.address ? (
                        <a href={mapsUrl(b.address)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-xs truncate">
                          <span className="material-symbols-outlined text-sm flex-shrink-0">map</span>
                          <span className="truncate">{b.address}</span>
                        </a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {b.phone ? (
                        <div className="flex items-center gap-1">
                          <a href={`tel:${b.phone}`} className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors" title="Call">
                            <span className="material-symbols-outlined text-sm">call</span>
                          </a>
                          <a href={whatsappUrl(b.phone)} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition-colors" title="WhatsApp">
                            <span className="material-symbols-outlined text-sm">chat</span>
                          </a>
                          <span className="text-xs text-slate-500">{b.phone}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">{statusBadge(b.status ?? 'pending')}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {(b.status === 'pending' || b.status === 'missed') && (
                          <button
                            onClick={() => updateStatus(b.id, 'done')}
                            disabled={actionLoading === b.id + 'done'}
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors disabled:opacity-40"
                            title="Mark Done"
                          >
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                          </button>
                        )}
                        {b.status !== 'missed' && b.status !== 'pending' ? null : null}
                        {b.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(b.id, 'missed')}
                            disabled={actionLoading === b.id + 'missed'}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-40"
                            title="Mark Missed"
                          >
                            <span className="material-symbols-outlined text-lg">cancel</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setRescheduleBooking(b); setNewDate(b.date) }}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                          title="Reschedule"
                        >
                          <span className="material-symbols-outlined text-lg">event_repeat</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reschedule modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-emerald-900 text-lg">Reschedule Appointment</h3>
              <button onClick={() => setRescheduleBooking(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Rescheduling <strong className="text-emerald-900">{rescheduleBooking.patient_name}</strong> — {rescheduleBooking.vaccine}
            </p>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">New Date</label>
            <input
              type="date"
              value={newDate}
              min={today}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRescheduleBooking(null)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={reschedule}
                disabled={!newDate || actionLoading === 'reschedule'}
                className="flex-1 py-3 bg-emerald-900 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'reschedule' ? 'Saving…' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
