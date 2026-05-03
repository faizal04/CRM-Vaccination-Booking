import { useEffect, useState, useMemo } from 'react'
import { supabase, type Booking } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOff = {
  id: string
  date: string
  reason: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function statusDots(statuses: string[]) {
  return (
    <div className="flex justify-center gap-0.5 mt-0.5">
      {statuses.includes('done')    && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      {statuses.includes('pending') && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      {statuses.includes('missed')  && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Schedule() {
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [daysOff,   setDaysOff]   = useState<DayOff[]>([])
  const [loading,   setLoading]   = useState(true)

  const today    = new Date()
  const todayISO = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear,     setViewYear]     = useState(today.getFullYear())
  const [viewMonth,    setViewMonth]    = useState(today.getMonth())
  const [selectedDay,  setSelectedDay]  = useState<string | null>(null)

  // Day-off modal state
  const [dayOffModal,  setDayOffModal]  = useState(false)
  const [dayOffReason, setDayOffReason] = useState('')
  const [dayOffSaving, setDayOffSaving] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [bRes, dRes] = await Promise.all([
        supabase.from('bookings').select('*').order('date', { ascending: true }),
        supabase.from('days_off').select('*').order('date', { ascending: true }),
      ])
      setBookings(bRes.data ?? [])
      setDaysOff(dRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived maps ──────────────────────────────────────────────────────────
  const byDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    bookings.forEach(b => {
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    })
    return map
  }, [bookings])

  const daysOffSet = useMemo(
    () => new Set(daysOff.map(d => d.date)),
    [daysOff]
  )

  const dayOffByDate = useMemo(() => {
    const map: Record<string, DayOff> = {}
    daysOff.forEach(d => { map[d.date] = d })
    return map
  }, [daysOff])

  // ── Upcoming (next 5 pending) ──────────────────────────────────────────────
  const upcoming = bookings
    .filter(b => b.date >= todayISO && b.status === 'pending')
    .slice(0, 5)

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const days     = daysInMonth(viewYear, viewMonth)
  const firstDay = firstDayOfMonth(viewYear, viewMonth)
  const cells    = Array.from({ length: firstDay + days }, (_, i) => {
    if (i < firstDay) return null
    return isoDate(viewYear, viewMonth, i - firstDay + 1)
  })

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // ── Mark / unmark day off ─────────────────────────────────────────────────
  async function markDayOff() {
    if (!selectedDay) return
    setDayOffSaving(true)
    const { data, error } = await supabase
      .from('days_off')
      .insert({ date: selectedDay, reason: dayOffReason.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setDaysOff(prev => [...prev, data])
    }
    setDayOffSaving(false)
    setDayOffModal(false)
    setDayOffReason('')
  }

  async function removeDayOff() {
    if (!selectedDay) return
    const entry = dayOffByDate[selectedDay]
    if (!entry) return
    setDayOffSaving(true)
    await supabase.from('days_off').delete().eq('id', entry.id)
    setDaysOff(prev => prev.filter(d => d.date !== selectedDay))
    setDayOffSaving(false)
  }

  const selectedBookings = selectedDay ? (byDate[selectedDay] ?? []) : []
  const selectedIsOff    = selectedDay ? daysOffSet.has(selectedDay) : false

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-h1 text-h1 text-on-background">Schedule</h1>
        <p className="text-body-md text-on-surface-variant">
          Monthly calendar of appointments. Click any day to manage it or mark it as a day off.
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-slate-400">Loading schedule…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Calendar ── */}
          <div className="lg:col-span-2 bg-white rounded-xl custom-shadow p-6">

            {/* Month nav */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <h2 className="font-bold text-emerald-900 text-lg">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={i} />

                const dayBookings = byDate[dateStr] ?? []
                const isOff       = daysOffSet.has(dateStr)
                const isToday     = dateStr === todayISO
                const isSelected  = dateStr === selectedDay
                const dayNum      = parseInt(dateStr.split('-')[2])

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={[
                      'relative rounded-xl py-2 px-1 flex flex-col items-center transition-all min-h-[56px]',
                      isSelected
                        ? 'bg-emerald-900 text-white shadow-md'
                        : isOff
                          ? 'bg-red-50 border border-red-200 text-red-400'
                          : isToday
                            ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700',
                    ].join(' ')}
                  >
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isOff ? 'text-red-400 line-through' : ''}`}>
                      {dayNum}
                    </span>

                    {/* Day-off icon */}
                    {isOff && !isSelected && (
                      <span className="material-symbols-outlined text-red-300 text-sm mt-0.5" style={{ fontSize: 14 }}>
                        do_not_disturb_on
                      </span>
                    )}
                    {isOff && isSelected && (
                      <span className="material-symbols-outlined text-white/70 text-sm mt-0.5" style={{ fontSize: 14 }}>
                        do_not_disturb_on
                      </span>
                    )}

                    {/* Booking dots (only if not a day off) */}
                    {!isOff && dayBookings.length > 0 && (
                      <>
                        {isSelected
                          ? <div className="flex gap-0.5 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-white/70" /></div>
                          : statusDots(dayBookings.map(b => b.status ?? 'pending'))}
                        <span className={`text-[9px] font-bold mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {dayBookings.length}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
              {[
                { color: 'bg-emerald-500', label: 'Done' },
                { color: 'bg-amber-500',   label: 'Pending' },
                { color: 'bg-red-400',     label: 'Missed' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-red-300" style={{ fontSize: 14 }}>do_not_disturb_on</span>
                Day off
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="bg-white rounded-xl custom-shadow p-6 flex flex-col">
            {selectedDay ? (
              <>
                {/* Selected day header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-emerald-900 text-base">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                {/* Day-off banner */}
                {selectedIsOff && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-red-400 flex-shrink-0">do_not_disturb_on</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-red-700 text-sm">Day Off</p>
                      {dayOffByDate[selectedDay]?.reason && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{dayOffByDate[selectedDay].reason}</p>
                      )}
                      <p className="text-xs text-red-400 mt-0.5">Bookings are blocked on this date.</p>
                    </div>
                  </div>
                )}

                {/* Toggle day-off button */}
                {selectedIsOff ? (
                  <button
                    onClick={removeDayOff}
                    disabled={dayOffSaving}
                    className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">event_available</span>
                    {dayOffSaving ? 'Removing…' : 'Restore — Mark as Working Day'}
                  </button>
                ) : (
                  <button
                    onClick={() => setDayOffModal(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">do_not_disturb_on</span>
                    Mark as Day Off
                  </button>
                )}

                {/* Appointments for selected day */}
                <div className="flex-1 overflow-y-auto space-y-3">
                  {selectedBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-8">
                      <span className="material-symbols-outlined text-3xl mb-2">event_available</span>
                      <p className="text-sm font-medium">No appointments this day</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {selectedBookings.length} appointment{selectedBookings.length !== 1 ? 's' : ''}
                      </p>
                      {selectedBookings.map(b => {
                        const statusStyle: Record<string, string> = {
                          pending: 'border-amber-200 bg-amber-50/40',
                          done:    'border-emerald-200 bg-emerald-50/40',
                          missed:  'border-red-200 bg-red-50/30',
                        }
                        const badgeStyle: Record<string, string> = {
                          pending: 'text-amber-700 bg-amber-100',
                          done:    'text-emerald-700 bg-emerald-100',
                          missed:  'text-red-700 bg-red-100',
                        }
                        const st = b.status ?? 'pending'
                        return (
                          <div key={b.id} className={`border rounded-xl p-4 ${statusStyle[st]}`}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-bold text-emerald-950 text-sm">{b.patient_name}</p>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${badgeStyle[st]}`}>{st}</span>
                            </div>
                            <p className="text-xs text-slate-600 mb-1">{b.vaccine}</p>
                            {b.address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                                target="_blank" rel="noreferrer"
                                className="text-xs text-primary flex items-center gap-1 hover:underline truncate"
                              >
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                {b.address}
                              </a>
                            )}
                            {b.phone && (
                              <a href={`tel:${b.phone}`} className="text-xs text-emerald-700 flex items-center gap-1 mt-1 hover:underline">
                                <span className="material-symbols-outlined text-sm">call</span>
                                {b.phone}
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Default: next 5 upcoming */
              <>
                <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">upcoming</span>
                  Next 5 Upcoming
                </h3>

                {/* Days off this month */}
                {daysOff.filter(d => d.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`)).length > 0 && (
                  <div className="mb-4 bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">do_not_disturb_on</span>
                      Days off this month
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {daysOff
                        .filter(d => d.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`))
                        .map(d => (
                          <span
                            key={d.date}
                            onClick={() => setSelectedDay(d.date)}
                            className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full cursor-pointer hover:bg-red-200 transition-colors"
                          >
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}

                {upcoming.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
                    <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
                    <p className="text-sm font-medium">No pending appointments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedDay(b.date)}
                        className="border border-slate-100 rounded-xl p-4 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-bold text-emerald-950 text-sm">{b.patient_name}</p>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{b.vaccine}</p>
                        {b.phone && (
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">call</span>{b.phone}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mark Day Off modal ── */}
      {dayOffModal && selectedDay && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-red-700 text-lg flex items-center gap-2">
                <span className="material-symbols-outlined">do_not_disturb_on</span>
                Mark as Day Off
              </h3>
              <button onClick={() => { setDayOffModal(false); setDayOffReason('') }} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              No bookings will be accepted on{' '}
              <strong className="text-red-700">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </strong>.
            </p>

            {selectedBookings.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-500 flex-shrink-0 text-sm">warning</span>
                <p className="text-xs text-amber-700">
                  There {selectedBookings.length === 1 ? 'is' : 'are'} already <strong>{selectedBookings.length} booking{selectedBookings.length !== 1 ? 's' : ''}</strong> on this day. Marking it as a day off won't remove them — reschedule them from the Appointments page.
                </p>
              </div>
            )}

            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Reason <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={dayOffReason}
              onChange={e => setDayOffReason(e.target.value)}
              placeholder="e.g. Public holiday, Personal leave…"
              className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-400 transition-all"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDayOffModal(false); setDayOffReason('') }}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={markDayOff}
                disabled={dayOffSaving}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {dayOffSaving ? 'Saving…' : 'Confirm Day Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
