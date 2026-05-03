import { useEffect, useState } from "react";
import { supabase, type Booking } from "../lib/supabase";

type FilterTab = "upcoming" | "past" | "all";

type NewBookingForm = {
  patient_name: string;
  age: string;
  phone: string;
  email: string;
  vaccine: string;
  date: string;
  address: string;
  notes: string;
  payment_status: "pending" | "paid";
};

const EMPTY_FORM: NewBookingForm = {
  patient_name: "",
  age: "",
  phone: "",
  email: "",
  vaccine: "",
  date: "",
  address: "",
  notes: "",
  payment_status: "pending",
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-100",
    done: "bg-emerald-100 text-emerald-700",
    missed: "bg-red-100 text-red-700",
  };
  const icons: Record<string, string> = {
    pending: "schedule",
    done: "check",
    missed: "close",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${map[status] ?? map.pending}`}
    >
      <span className="material-symbols-outlined text-sm">
        {icons[status] ?? "schedule"}
      </span>
      {label}
    </span>
  );
}

function paymentBadge(status: string) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
        ✅ Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
      ⏳ Pending
    </span>
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function parseAddress(raw: string): { text: string; url: string | null } {
  const mapsIndex = raw.indexOf(" Maps: ");
  if (mapsIndex !== -1) {
    return {
      text: raw.slice(0, mapsIndex).trim(),
      url: raw.slice(mapsIndex + 7).trim(),
    };
  }
  const urlMatch = raw.match(/(https?:\/\/\S+)/);
  if (urlMatch) {
    return { text: raw.replace(urlMatch[0], "").trim(), url: urlMatch[0] };
  }
  return { text: raw, url: null };
}

function whatsappUrl(phone: string) {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}`;
}

function initials(name: string) {
  return (
    name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?"
  );
}

export default function Appointments() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vaccines, setVaccines] = useState<{ name: string; price: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");

  // Add appointment modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<NewBookingForm>(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  async function fetchBookings() {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("date", { ascending: false });
    setBookings(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchBookings();
    supabase
      .from("vaccines")
      .select("name, price")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setVaccines(data ?? []);
      });
  }, []);

  async function updateStatus(
    id: string,
    status: "done" | "missed" | "pending",
  ) {
    setActionLoading(id + status);
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b)),
    );
    if (selectedBooking?.id === id)
      setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
    setActionLoading(null);
  }

  async function updatePaymentStatus(
    id: string,
    payment_status: "pending" | "paid",
  ) {
    setActionLoading(id + payment_status);
    await supabase.from("bookings").update({ payment_status }).eq("id", id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, payment_status } : b)),
    );
    if (selectedBooking?.id === id)
      setSelectedBooking((prev) => (prev ? { ...prev, payment_status } : null));
    setActionLoading(null);
  }

  async function reschedule() {
    if (!selectedBooking || !newDate) return;
    setActionLoading("reschedule");
    await supabase
      .from("bookings")
      .update({ date: newDate, status: "pending" })
      .eq("id", selectedBooking.id);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === selectedBooking.id
          ? { ...b, date: newDate, status: "pending" }
          : b,
      ),
    );
    setSelectedBooking((prev) =>
      prev ? { ...prev, date: newDate, status: "pending" } : null,
    );
    setRescheduleOpen(false);
    setNewDate("");
    setActionLoading(null);
  }

  async function generateBookingId(): Promise<string> {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .like("id", `KV-${year}-%`)
      .order("id", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].id.split("-")[2], 10);
      return `KV-${year}-${String(lastNum + 1).padStart(4, "0")}`;
    }
    return `KV-${year}-0001`;
  }

  async function addAppointment() {
    if (!form.patient_name.trim() || !form.vaccine || !form.date) {
      setAddError("Patient name, vaccine and date are required.");
      return;
    }
    setAddLoading(true);
    setAddError("");
    const id = await generateBookingId();
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        id,
        patient_name: form.patient_name.trim(),
        age: form.age.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        vaccine: form.vaccine,
        date: form.date,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        status: "pending",
        location: "Home Visit",
        payment_status: form.payment_status,
      })
      .select()
      .single();
    if (error) {
      console.log(error);
      setAddError("Failed to save. Please try again.");
    } else {
      setBookings((prev) => [data as Booking, ...prev]);
      setAddOpen(false);
      setForm(EMPTY_FORM);
    }
    setAddLoading(false);
  }

  // ── Filtering ────────────────────────────────────────────────────────────────
  const today = todayISO();
  let filtered = bookings;
  if (filter === "upcoming") filtered = filtered.filter((b) => b.date >= today);
  else if (filter === "past") filtered = filtered.filter((b) => b.date < today);
  if (selectedDate) filtered = filtered.filter((b) => b.date === selectedDate);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.patient_name?.toLowerCase().includes(q) ||
        b.id?.toLowerCase().includes(q) ||
        b.vaccine?.toLowerCase().includes(q),
    );
  }

  const priceMap: Record<string, number> = {}
  vaccines.forEach(v => { priceMap[v.name] = parseFloat(String(v.price)) })

  const counts = {
    upcoming: bookings.filter((b) => b.date >= today).length,
    past: bookings.filter((b) => b.date < today).length,
    all: bookings.length,
  };

  const drawerOpen = selectedBooking !== null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-h1 text-h1 text-on-background">Appointments</h1>
          <p className="text-body-md text-on-surface-variant">
            Manage and track all vaccination bookings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAddOpen(true);
              setAddError("");
              setForm(EMPTY_FORM);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Add Appointment
          </button>
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 shadow-sm">
            {(["upcoming", "past", "all"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setFilter(tab);
                  if (tab === "upcoming") setSelectedDate(today);
                  else setSelectedDate("");
                }}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${filter === tab ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:bg-white/50"}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-1 text-xs opacity-60">({counts[tab]})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center border border-slate-100">
        <div className="relative flex-1 min-w-[200px] group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="w-full border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
            placeholder="Search by name, ID, or vaccine…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            calendar_month
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
          />
        </div>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate("")}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>{" "}
            Clear date
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <svg
              className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            <p className="text-slate-400">Loading appointments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              search_off
            </span>
            <p className="font-medium">No appointments found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Vaccine</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className={`cursor-pointer transition-colors text-sm hover:bg-emerald-50/60 ${selectedBooking?.id === b.id ? "bg-emerald-50" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                          {initials(b.patient_name)}
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900 leading-tight">
                            {b.patient_name}
                          </p>
                          {b.age && (
                            <p className="text-xs text-slate-400">
                              Age {b.age}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-sm max-w-[160px] truncate">
                      {b.vaccine}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-sm whitespace-nowrap">
                      {new Date(b.date + "T00:00:00").toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {(() => {
                        const price = priceMap[b.vaccine]
                        return !isNaN(price) && price != null ? (
                          <span className={`text-sm font-bold ${b.payment_status === 'paid' ? 'text-emerald-600' : 'text-slate-700'}`}>
                            ₹{price.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      {statusBadge(b.status ?? "pending")}
                    </td>
                    <td className="px-5 py-3">
                      {paymentBadge(b.payment_status ?? "pending")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Appointment Modal ─────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                  <span className="material-symbols-outlined">
                    calendar_add_on
                  </span>
                </div>
                <h3 className="font-bold text-emerald-900 text-lg">
                  New Appointment
                </h3>
              </div>
              <button
                onClick={() => setAddOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    error
                  </span>
                  {addError}
                </div>
              )}

              {/* Row: Name + Age */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormLabel required>Patient Name</FormLabel>
                  <input
                    className="form-input"
                    placeholder="Full name"
                    value={form.patient_name}
                    onChange={(e) =>
                      setForm({ ...form, patient_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FormLabel>Age</FormLabel>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 5 months"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
              </div>

              {/* Row: Vaccine + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel required>Vaccine</FormLabel>
                  {vaccines.length > 0 ? (
                    <>
                      <select
                        className="form-input"
                        value={form.vaccine}
                        onChange={(e) =>
                          setForm({ ...form, vaccine: e.target.value })
                        }
                      >
                        <option value="">Select vaccine</option>
                        {vaccines.map((v) => {
                          const price = parseFloat(String(v.price));
                          return (
                            <option key={v.name} value={v.name}>
                              {v.name}
                              {!isNaN(price)
                                ? ` — ₹${price.toLocaleString("en-IN")}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                      {form.vaccine &&
                        (() => {
                          const selected = vaccines.find(
                            (v) => v.name === form.vaccine,
                          );
                          const price = selected
                            ? parseFloat(String(selected.price))
                            : NaN;
                          return !isNaN(price) ? (
                            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                              <span className="material-symbols-outlined text-emerald-600 text-sm">
                                payments
                              </span>
                              <span className="text-sm font-bold text-emerald-700">
                                ₹{price.toLocaleString("en-IN")}
                              </span>
                              <span className="text-xs text-emerald-600">
                                vaccine price
                              </span>
                            </div>
                          ) : null;
                        })()}
                    </>
                  ) : (
                    <input
                      className="form-input"
                      placeholder="Vaccine name"
                      value={form.vaccine}
                      onChange={(e) =>
                        setForm({ ...form, vaccine: e.target.value })
                      }
                    />
                  )}
                </div>
                <div>
                  <FormLabel required>Date</FormLabel>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              </div>

              {/* Row: Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>Phone</FormLabel>
                  <input
                    className="form-input"
                    placeholder="+91 XXXXX XXXXX"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FormLabel>Email</FormLabel>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <FormLabel>Address</FormLabel>
                <input
                  className="form-input"
                  placeholder="Home address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>

              {/* Notes */}
              <div>
                <FormLabel>Notes</FormLabel>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* Payment Status */}
              <div>
                <FormLabel>Payment Status</FormLabel>
                <div className="flex gap-3">
                  {(["pending", "paid"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm({ ...form, payment_status: val })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                        form.payment_status === val
                          ? val === "paid"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {val === "paid" ? "✅ Paid" : "⏳ Pending"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setAddOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addAppointment}
                disabled={addLoading}
                className="flex-1 py-3 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">
                      check
                    </span>
                    Save Appointment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side Drawer Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => {
            setSelectedBooking(null);
            setRescheduleOpen(false);
          }}
        />
      )}

      {/* Side Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {selectedBooking && (
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                  {initials(selectedBooking.patient_name)}
                </div>
                <div>
                  <h2 className="font-bold text-emerald-900 text-lg leading-tight">
                    {selectedBooking.patient_name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedBooking.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setRescheduleOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex gap-2 flex-wrap">
                {statusBadge(selectedBooking.status ?? "pending")}
                {paymentBadge(selectedBooking.payment_status ?? "pending")}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <InfoRow
                  icon="vaccines"
                  label="Vaccine"
                  value={selectedBooking.vaccine}
                />
                <InfoRow
                  icon="calendar_today"
                  label="Date"
                  value={new Date(
                    selectedBooking.date + "T00:00:00",
                  ).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                />
                {selectedBooking.age && (
                  <InfoRow
                    icon="person"
                    label="Age"
                    value={`${selectedBooking.age} years`}
                  />
                )}
                {selectedBooking.relation && (
                  <InfoRow
                    icon="group"
                    label="Relation"
                    value={selectedBooking.relation}
                  />
                )}
                {selectedBooking.booked_by && (
                  <InfoRow
                    icon="manage_accounts"
                    label="Booked By"
                    value={selectedBooking.booked_by}
                  />
                )}
                {selectedBooking.notes && (
                  <InfoRow
                    icon="notes"
                    label="Notes"
                    value={selectedBooking.notes}
                  />
                )}
              </div>

              {(selectedBooking.phone || selectedBooking.email) && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Contact
                  </p>
                  {selectedBooking.phone && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-sm">
                        call
                      </span>
                      <span className="text-sm text-slate-700 flex-1">
                        {selectedBooking.phone}
                      </span>
                      <div className="flex gap-1">
                        <a
                          href={`tel:${selectedBooking.phone}`}
                          className="p-2 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                          title="Call"
                        >
                          <span className="material-symbols-outlined text-sm">
                            call
                          </span>
                        </a>
                        <a
                          href={whatsappUrl(selectedBooking.phone)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                          title="WhatsApp"
                        >
                          <span className="material-symbols-outlined text-sm">
                            chat
                          </span>
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedBooking.email && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-sm">
                        mail
                      </span>
                      <a
                        href={`mailto:${selectedBooking.email}`}
                        className="text-sm text-primary hover:underline flex-1 truncate"
                      >
                        {selectedBooking.email}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedBooking.address &&
                (() => {
                  const { text, url } = parseAddress(selectedBooking.address);
                  return (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Address
                      </p>
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5 flex-shrink-0">
                          location_on
                        </span>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-sm text-slate-700">{text}</p>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                            >
                              <span className="material-symbols-outlined text-sm">
                                map
                              </span>
                              Open in Maps
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Payment
                </p>
                <select
                  value={selectedBooking.payment_status ?? "pending"}
                  disabled={!!actionLoading}
                  onChange={(e) =>
                    updatePaymentStatus(
                      selectedBooking.id,
                      e.target.value as "pending" | "paid",
                    )
                  }
                  className={`text-sm font-semibold px-4 py-2.5 rounded-xl border outline-none cursor-pointer transition-colors w-full ${selectedBooking.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                >
                  <option value="pending">⏳ Pending</option>
                  <option value="paid">✅ Paid</option>
                </select>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Reschedule
                </p>
                {rescheduleOpen ? (
                  <div className="space-y-3">
                    <input
                      type="date"
                      value={newDate}
                      min={today}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRescheduleOpen(false);
                          setNewDate("");
                        }}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={reschedule}
                        disabled={!newDate || actionLoading === "reschedule"}
                        className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === "reschedule" ? "Saving…" : "Confirm"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRescheduleOpen(true);
                      setNewDate(selectedBooking.date);
                    }}
                    className="w-full py-2.5 border border-amber-200 text-amber-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">
                      event_repeat
                    </span>
                    Reschedule Appointment
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              {(selectedBooking.status === "pending" ||
                selectedBooking.status === "missed") && (
                <button
                  onClick={() => updateStatus(selectedBooking.id, "done")}
                  disabled={actionLoading === selectedBooking.id + "done"}
                  className="flex-1 py-3 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">
                    check_circle
                  </span>
                  Mark Done
                </button>
              )}
              {selectedBooking.status === "pending" && (
                <button
                  onClick={() => updateStatus(selectedBooking.id, "missed")}
                  disabled={actionLoading === selectedBooking.id + "missed"}
                  className="flex-1 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">
                    cancel
                  </span>
                  Mark Missed
                </button>
              )}
              {selectedBooking.status === "done" && (
                <button
                  onClick={() => updateStatus(selectedBooking.id, "pending")}
                  disabled={!!actionLoading}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">
                    undo
                  </span>
                  Undo Done
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function FormLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-slate-400 text-base mt-0.5 flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm text-slate-700 font-medium leading-snug">
          {value}
        </p>
      </div>
    </div>
  );
}
