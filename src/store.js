import { useEffect, useState } from 'react'

const KEY = 'mileage-tracker:v1'

// IRS standard business mileage rate for 2026 (USD per mile). Editable in Settings.
export const DEFAULT_SETTINGS = {
  vehicle: 'Work vehicle',
  plate: '',
  driver: '',
  rate: 0.725,
  unit: 'mi',
}

const EMPTY = { trips: [], active: null, settings: DEFAULT_SETTINGS }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const data = JSON.parse(raw)
    return {
      trips: Array.isArray(data.trips) ? data.trips : [],
      active: data.active || null,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    }
  } catch {
    return EMPTY
  }
}

export function useStore() {
  const [state, setState] = useState(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // storage full or blocked; the app keeps working in memory
    }
  }, [state])
  return [state, setState]
}

export function normalizeImport(data) {
  if (!data || !Array.isArray(data.trips)) throw new Error('Not a Mileage Tracker backup file')
  return {
    trips: data.trips.filter((t) => t && t.id && Number.isFinite(t.startOdo) && Number.isFinite(t.endOdo)),
    active: data.active || null,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function today() {
  const d = new Date()
  return localDate(d)
}

export function localDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const distance = (t) => Math.max(0, t.endOdo - t.startOdo)

export function sortTrips(trips) {
  return [...trips].sort((a, b) => b.date.localeCompare(a.date) || b.endOdo - a.endOdo)
}

// Highest odometer reading we know about, used to prefill the next trip.
export function lastOdometer(trips) {
  return trips.reduce((max, t) => Math.max(max, t.endOdo), 0) || ''
}

export function toCSV(trips, settings) {
  const head = ['Date', 'Category', 'Purpose', 'Destination', 'Start odometer', 'End odometer', `Distance (${settings.unit})`, 'Reimbursement', 'Notes']
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = sortTrips(trips).reverse().map((t) => [
    t.date,
    t.category,
    t.purpose,
    t.destination,
    t.startOdo,
    t.endOdo,
    distance(t),
    t.category === 'Business' ? (distance(t) * settings.rate).toFixed(2) : '',
    t.notes,
  ])
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
