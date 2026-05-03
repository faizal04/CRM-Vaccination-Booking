import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Vaccine = {
  id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type FormState = {
  name: string
  description: string
  price: string
  is_active: boolean
}

const EMPTY_FORM: FormState = { name: '', description: '', price: '', is_active: true }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Vaccines() {
  const [vaccines,    setVaccines]    = useState<Vaccine[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<Vaccine | null>(null)
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchVaccines() {
    const { data } = await supabase
      .from('vaccines')
      .select('*')
      .order('name', { ascending: true })
    setVaccines(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchVaccines() }, [])

  // ── Open modal ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(v: Vaccine) {
    setEditTarget(v)
    setForm({
      name:        v.name,
      description: v.description ?? '',
      price:       String(v.price),
      is_active:   v.is_active,
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  // ── Save (add or edit) ────────────────────────────────────────────────────
  async function handleSave() {
    setError('')
    const name  = form.name.trim()
    const price = parseFloat(form.price)

    if (!name)           { setError('Vaccine name is required.'); return }
    if (isNaN(price) || price < 0) { setError('Enter a valid price (0 or more).'); return }

    setSaving(true)

    const payload = {
      name,
      description: form.description.trim() || null,
      price,
      is_active: form.is_active,
    }

    if (editTarget) {
      const { error: err } = await supabase
        .from('vaccines')
        .update(payload)
        .eq('id', editTarget.id)
      if (err) { setError(err.message); setSaving(false); return }
      setVaccines(prev => prev.map(v => v.id === editTarget.id ? { ...v, ...payload } : v))
    } else {
      const { data, error: err } = await supabase
        .from('vaccines')
        .insert(payload)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      if (data) setVaccines(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }

    setSaving(false)
    closeModal()
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function toggleActive(v: Vaccine) {
    const next = !v.is_active
    await supabase.from('vaccines').update({ is_active: next }).eq('id', v.id)
    setVaccines(prev => prev.map(x => x.id === v.id ? { ...x, is_active: next } : x))
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('vaccines').delete().eq('id', deleteId)
    setVaccines(prev => prev.filter(v => v.id !== deleteId))
    setDeleteId(null)
    setDeleting(false)
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? vaccines.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.description?.toLowerCase().includes(search.toLowerCase())
      )
    : vaccines

  const activeCount   = vaccines.filter(v => v.is_active).length
  const inactiveCount = vaccines.filter(v => !v.is_active).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-h1 text-h1 text-on-background">Vaccines</h1>
          <p className="text-body-md text-on-surface-variant">
            Manage the vaccine catalogue — names, descriptions, and prices shown to patients during booking.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-900 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Vaccine
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 mb-6">
        <div className="bg-white rounded-xl px-5 py-3 custom-shadow flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><span className="material-symbols-outlined text-emerald-700">vaccines</span></div>
          <div>
            <p className="text-2xl font-bold text-emerald-950">{vaccines.length}</p>
            <p className="text-xs text-slate-500 font-medium">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-xl px-5 py-3 custom-shadow flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><span className="material-symbols-outlined text-emerald-600">check_circle</span></div>
          <div>
            <p className="text-2xl font-bold text-emerald-950">{activeCount}</p>
            <p className="text-xs text-slate-500 font-medium">Active</p>
          </div>
        </div>
        {inactiveCount > 0 && (
          <div className="bg-white rounded-xl px-5 py-3 custom-shadow flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg"><span className="material-symbols-outlined text-slate-500">block</span></div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{inactiveCount}</p>
              <p className="text-xs text-slate-500 font-medium">Inactive</p>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-center border border-slate-100 mb-4">
        <div className="relative flex-1 group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
          <input
            className="w-full border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
            placeholder="Search vaccines…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} vaccine{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-slate-400">Loading vaccines…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">vaccines</span>
            <p className="font-medium">No vaccines found</p>
            {!search && (
              <button onClick={openAdd} className="mt-3 text-emerald-600 font-semibold text-sm hover:underline">
                Add your first vaccine →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Vaccine Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} className={`text-sm transition-colors ${v.is_active ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-60 hover:opacity-80'}`}>

                  {/* Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-emerald-700 text-lg">vaccines</span>
                      </div>
                      <span className="font-semibold text-emerald-950">{v.name}</span>
                    </div>
                  </td>

                  {/* Description */}
                  <td className="px-6 py-4 text-slate-500 max-w-xs">
                    {v.description
                      ? <span className="line-clamp-2">{v.description}</span>
                      : <span className="text-slate-300 italic text-xs">No description</span>
                    }
                  </td>

                  {/* Price */}
                  <td className="px-6 py-4">
                    {v.price > 0
                      ? <span className="font-bold text-emerald-900 font-mono">{formatINR(v.price)}</span>
                      : <span className="text-slate-400 text-xs italic">Not set</span>
                    }
                  </td>

                  {/* Status toggle */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(v)}
                        style={{ padding: 2 }}
                        className={`flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                          v.is_active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 bg-white rounded-full shadow-sm block" />
                      </button>
                      <span className={`text-xs font-semibold ${v.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteId(v.id)}
                        className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
                <span className="material-symbols-outlined">{editTarget ? 'edit' : 'add_circle'}</span>
                {editTarget ? 'Edit Vaccine' : 'Add New Vaccine'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Vaccine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. BCG, MMR, Influenza (Flu)…"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to patients during booking…"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl py-3 pl-8 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Active</p>
                  <p className="text-xs text-slate-400">Inactive vaccines won't appear in the booking form</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{ padding: 2 }}
                  className={`flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form.is_active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-sm block" />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-sm mt-0.5">error</span>
                  {error}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-emerald-900 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Vaccine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-500 text-2xl">delete</span>
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">Delete vaccine?</h3>
            <p className="text-slate-500 text-sm mb-6">
              <strong>{vaccines.find(v => v.id === deleteId)?.name}</strong> will be permanently removed.
              Existing bookings won't be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
