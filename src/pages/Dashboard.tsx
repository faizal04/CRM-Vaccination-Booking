import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase, type Booking } from '../lib/supabase'
import { VACCINE_COLORS } from '../lib/vaccines'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

function monthLabel(date: Date) {
  return date.toLocaleString('default', { month: 'short' }).toUpperCase()
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  done: 'bg-emerald-100 text-emerald-700',
  missed: 'bg-red-100 text-red-700',
}
const STATUS_ICONS: Record<string, string> = {
  pending: 'schedule',
  done: 'check',
  missed: 'close',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [totalPatients, setTotalPatients] = useState(0)
  const [priceMap, setPriceMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [bookingsRes, patientsRes, vaccinesRes] = await Promise.all([
        supabase.from('bookings').select('*').order('date', { ascending: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('vaccines').select('name, price'),
      ])
      setBookings(bookingsRes.data ?? [])
      setTotalPatients(patientsRes.count ?? 0)
      // Build price map from Supabase vaccines table
      const map: Record<string, number> = {}
      ;(vaccinesRes.data ?? []).forEach((v: { name: string; price: number }) => {
        map[v.name] = Number(v.price)
      })
      setPriceMap(map)
      setLoading(false)
    }
    load()
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const thisMonthBookings = bookings.filter(b => b.date?.startsWith(thisMonthStr))
  const lastMonthBookings = bookings.filter(b => b.date?.startsWith(lastMonthStr))

  const thisMonthRevenue = thisMonthBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (priceMap[b.vaccine] ?? 0), 0)
  const lastMonthRevenue = lastMonthBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (priceMap[b.vaccine] ?? 0), 0)

  const pendingPayments = bookings.filter(b => b.status === 'done' && b.payment_status !== 'paid')
  const pendingPaymentsAmount = pendingPayments.reduce((sum, b) => sum + (priceMap[b.vaccine] ?? 0), 0)

  const bookingsTrend = lastMonthBookings.length
    ? Math.round(((thisMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length) * 100)
    : 0

  // ── Monthly bar chart data (last 6 months) ─────────────────────────────────
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      month: monthLabel(d),
      count: bookings.filter(b => b.date?.startsWith(key)).length,
    }
  })

  // ── Vaccine pie chart data ─────────────────────────────────────────────────
  const vaccineMap: Record<string, number> = {}
  bookings.forEach(b => {
    vaccineMap[b.vaccine] = (vaccineMap[b.vaccine] ?? 0) + 1
  })
  const pieData = Object.entries(vaccineMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  // ── Today's appointments ───────────────────────────────────────────────────
  const todayBookings = bookings.filter(b => b.date === todayISO()).slice(0, 8)

  // ── Priority list (pending, sorted by date asc) ────────────────────────────
  const priority = bookings
    .filter(b => b.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-slate-500 font-medium">Loading dashboard…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="font-h1 text-h1 text-emerald-900">Health Overview</h1>
          <p className="font-body-lg text-body-lg text-slate-500">Real-time vaccination analytics and schedule monitoring.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Bookings this month */}
        <div className="bg-white p-6 rounded-xl custom-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
              <span className="material-symbols-outlined">book_online</span>
            </div>
            {bookingsTrend !== 0 && (
              <div className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded ${bookingsTrend > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                <span className="material-symbols-outlined text-xs">{bookingsTrend > 0 ? 'trending_up' : 'trending_down'}</span>
                {Math.abs(bookingsTrend)}%
              </div>
            )}
          </div>
          <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Bookings This Month</p>
          <h3 className="text-3xl font-bold text-emerald-950">{thisMonthBookings.length.toLocaleString()}</h3>
        </div>

        {/* Revenue */}
        <div className="bg-white p-6 rounded-xl custom-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-700">
              <span className="material-symbols-outlined">payments</span>
            </div>
          </div>
          <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Revenue</p>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-emerald-950">{formatINR(thisMonthRevenue)}</h3>
              <span className="text-[10px] text-slate-500 font-bold uppercase">This Month</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-bold text-slate-400">{formatINR(lastMonthRevenue)}</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Last Month</span>
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-6 rounded-xl custom-shadow border-l-4 border-red-400">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            {pendingPayments.length > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded bg-red-50 text-red-600">
                {pendingPayments.length} booking{pendingPayments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Pending Payments</p>
          <div className="space-y-0.5">
            <h3 className="text-3xl font-bold text-red-600">{formatINR(pendingPaymentsAmount)}</h3>
            <p className="text-xs text-slate-400">Vaccine done · Payment not collected</p>
          </div>
        </div>

        {/* Total patients */}
        <div className="bg-white p-6 rounded-xl custom-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-800">
              <span className="material-symbols-outlined">person_add</span>
            </div>
          </div>
          <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Registered Patients</p>
          <h3 className="text-3xl font-bold text-emerald-950">{totalPatients.toLocaleString()}</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl custom-shadow">
          <h3 className="font-h3 text-h3 text-emerald-900 mb-6">Monthly Bookings (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
              <XAxis dataKey="month" tick={{ fill: '#6f7a74', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6f7a74', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                cursor={{ fill: '#f1f5f4' }}
              />
              <Bar dataKey="count" name="Bookings" fill="#005440" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white p-6 rounded-xl custom-shadow">
          <h3 className="font-h3 text-h3 text-emerald-900 mb-4">Vaccine Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={VACCINE_COLORS[i % VACCINE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: '#3f4944' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-xl custom-shadow overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-h3 text-h3 text-emerald-900">
            Today's Appointments
            {todayBookings.length > 0 && (
              <span className="ml-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{todayBookings.length}</span>
            )}
          </h3>
          <Link to="/appointments" className="text-emerald-700 font-bold text-sm hover:underline">View all →</Link>
        </div>
        {todayBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">event_available</span>
            <p className="font-medium">No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full zebra-table">
              <thead>
                <tr className="text-left text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Vaccine</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {todayBookings.map(b => (
                  <tr key={b.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                          {getInitials(b.patient_name)}
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-950">{b.patient_name}</p>
                          {b.age && <p className="text-xs text-slate-400">Age {b.age}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{b.vaccine}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{b.address || '—'}</td>
                    <td className="px-6 py-4 text-slate-500">{b.phone || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[b.status ?? 'pending']}`}>
                        <span className="material-symbols-outlined text-sm">{STATUS_ICONS[b.status ?? 'pending']}</span>
                        {(b.status ?? 'pending').charAt(0).toUpperCase() + (b.status ?? 'pending').slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Priority list */}
      {priority.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-amber-500">priority_high</span>
            <h3 className="font-h3 text-h3 text-emerald-900">Priority: Pending Visits</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {priority.map(b => (
              <div key={b.id} className="bg-amber-50/50 border border-amber-200 p-5 rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 bg-amber-500 text-white text-[9px] font-bold uppercase rounded">{b.id}</span>
                  <span className="text-[10px] font-bold text-amber-700">{new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <h4 className="font-bold text-emerald-950 mb-1">{b.patient_name}</h4>
                <p className="text-xs text-slate-600 mb-2">{b.vaccine}</p>
                {b.address && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {b.address}
                  </p>
                )}
                {b.phone && (
                  <a
                    href={`tel:${b.phone}`}
                    className="mt-3 inline-flex items-center gap-1 text-emerald-700 font-bold text-xs hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    {b.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
