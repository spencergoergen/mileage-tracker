import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useStore, uid, today, localDate, distance, sortTrips, lastOdometer,
  toCSV, download, normalizeImport, DEFAULT_SETTINGS,
} from './store.js'

const CATEGORIES = ['Business', 'Commute', 'Personal']
const TABS = [
  { id: 'drive', label: 'Drive', icon: 'M12 3a9 9 0 0 0-9 9h3a6 6 0 0 1 12 0h3a9 9 0 0 0-9-9zm4.2 4.4-5 5.3a1.6 1.6 0 1 0 2.3 2.2l3.6-6.6z' },
  { id: 'log', label: 'Log', icon: 'M5 5h14v2H5zm0 6h14v2H5zm0 6h9v2H5z' },
  { id: 'reports', label: 'Reports', icon: 'M5 19V11h3v8zm5.5 0V5h3v14zM16 19v-6h3v6z' },
  { id: 'settings', label: 'Settings', icon: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 5-1.9-.3a6.9 6.9 0 0 1-.6 1.5l1.1 1.6-1.9 1.9-1.6-1.1c-.5.3-1 .5-1.5.6l-.3 1.9h-2.6l-.3-1.9a6.9 6.9 0 0 1-1.5-.6L7.7 18.2l-1.9-1.9 1.1-1.6a6.9 6.9 0 0 1-.6-1.5l-1.9-.3v-2.6l1.9-.3c.1-.5.3-1 .6-1.5L5.8 6.9l1.9-1.9 1.6 1.1c.5-.3 1-.5 1.5-.6l.3-1.9h2.6l.3 1.9c.5.1 1 .3 1.5.6l1.6-1.1 1.9 1.9-1.1 1.6c.3.5.5 1 .6 1.5l1.9.3z' },
]

const money = (n) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const num = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
const monthKey = (date) => date.slice(0, 7)
const monthLabel = (key) =>
  new Date(key + '-01T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
const dayLabel = (date) =>
  new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  )
}

export default function App() {
  const [state, setState] = useStore()
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'drive')
  const [editing, setEditing] = useState(null) // trip object, or {} for a new past trip
  const [toast, setToast] = useState('')

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'drive')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const go = (id) => {
    location.hash = id
    window.scrollTo(0, 0)
  }

  const saveTrip = (trip) => {
    setState((s) => {
      const exists = s.trips.some((t) => t.id === trip.id)
      return { ...s, trips: exists ? s.trips.map((t) => (t.id === trip.id ? trip : t)) : [...s.trips, trip] }
    })
    setEditing(null)
    setToast('Trip saved')
  }

  const deleteTrip = (id) => {
    setState((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== id) }))
    setEditing(null)
    setToast('Trip deleted')
  }

  const { trips, active, settings } = state
  const screens = {
    drive: (
      <Drive
        trips={trips}
        active={active}
        settings={settings}
        onStart={(a) => setState((s) => ({ ...s, active: a }))}
        onCancel={() => setState((s) => ({ ...s, active: null }))}
        onFinish={(trip) => {
          setState((s) => ({ ...s, active: null, trips: [...s.trips, trip] }))
          setToast(`Trip saved · ${num(distance(trip))} ${settings.unit}`)
        }}
        onAddPast={() => setEditing({})}
        onEdit={setEditing}
        goLog={() => go('log')}
      />
    ),
    log: <Log trips={trips} settings={settings} onEdit={setEditing} onAdd={() => setEditing({})} />,
    reports: <Reports trips={trips} settings={settings} />,
    settings: (
      <Settings
        state={state}
        onChange={(settings) => setState((s) => ({ ...s, settings }))}
        onReplace={(next) => {
          setState(next)
          setToast('Backup restored')
        }}
        notify={setToast}
      />
    ),
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{TABS.find((t) => t.id === tab)?.label || 'Drive'}</h1>
          <p className="sub">{settings.vehicle}{settings.plate ? ` · ${settings.plate}` : ''}</p>
        </div>
        {active && tab !== 'drive' && (
          <button className="pill live" onClick={() => go('drive')}>
            <span className="dot" /> Trip in progress
          </button>
        )}
      </header>

      <main>{screens[tab] || screens.drive}</main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={tab === t.id}>
            <Icon d={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {editing && (
        <TripSheet
          trip={editing}
          trips={trips}
          settings={settings}
          onSave={saveTrip}
          onDelete={deleteTrip}
          onClose={() => setEditing(null)}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

/* ---------- Drive ---------- */

function Drive({ trips, active, settings, onStart, onCancel, onFinish, onAddPast, onEdit, goLog }) {
  const last = lastOdometer(trips)
  const thisMonth = monthKey(today())
  const monthTrips = trips.filter((t) => monthKey(t.date) === thisMonth)
  const biz = monthTrips.filter((t) => t.category === 'Business').reduce((a, t) => a + distance(t), 0)
  const total = monthTrips.reduce((a, t) => a + distance(t), 0)
  const recent = sortTrips(trips).slice(0, 3)

  return (
    <>
      {active ? (
        <ActiveTrip active={active} settings={settings} onCancel={onCancel} onFinish={onFinish} />
      ) : (
        <StartTrip last={last} onStart={onStart} />
      )}

      <section className="stats">
        <Stat label={`Business ${settings.unit} · ${new Date().toLocaleDateString(undefined, { month: 'short' })}`} value={num(biz)} />
        <Stat label="Reimbursable" value={money(biz * settings.rate)} accent />
        <Stat label={`All ${settings.unit} this month`} value={num(total)} />
        <Stat label="Odometer" value={last === '' ? '—' : num(last)} />
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Recent trips</h2>
          <button className="link" onClick={onAddPast}>+ Add past trip</button>
        </div>
        {recent.length === 0 ? (
          <p className="empty">No trips yet. Start one above, or add a trip you already drove.</p>
        ) : (
          <>
            <ul className="trips">
              {recent.map((t) => <TripRow key={t.id} trip={t} settings={settings} onClick={() => onEdit(t)} />)}
            </ul>
            <button className="link full" onClick={goLog}>See all trips →</button>
          </>
        )}
      </section>
    </>
  )
}

function StartTrip({ last, onStart }) {
  const [startOdo, setStartOdo] = useState(last)
  const [category, setCategory] = useState('Business')
  const [purpose, setPurpose] = useState('')
  const [destination, setDestination] = useState('')

  useEffect(() => setStartOdo(last), [last])

  const submit = (e) => {
    e.preventDefault()
    onStart({
      startOdo: Number(startOdo),
      category,
      purpose: purpose.trim(),
      destination: destination.trim(),
      startedAt: new Date().toISOString(),
    })
  }

  return (
    <form className="card hero" onSubmit={submit}>
      <h2>Start a trip</h2>
      <label className="field">
        <span>Starting odometer</span>
        <input type="number" inputMode="decimal" step="0.1" min="0" required value={startOdo}
          onChange={(e) => setStartOdo(e.target.value)} placeholder="e.g. 48210" />
      </label>
      <Segmented value={category} onChange={setCategory} />
      <label className="field">
        <span>Purpose</span>
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Client visit, supply run…" />
      </label>
      <label className="field">
        <span>Destination <em>(optional)</em></span>
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Where are you headed?" />
      </label>
      <button className="btn primary big" type="submit">Start trip</button>
    </form>
  )
}

function ActiveTrip({ active, settings, onCancel, onFinish }) {
  const [endOdo, setEndOdo] = useState('')
  const [notes, setNotes] = useState('')
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const started = new Date(active.startedAt)
  const mins = Math.max(0, Math.round((Date.now() - started) / 60000))
  const elapsed = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`
  const dist = endOdo === '' ? null : Number(endOdo) - active.startOdo
  const invalid = dist !== null && dist < 0

  const submit = (e) => {
    e.preventDefault()
    if (invalid) return
    onFinish({
      id: uid(),
      date: localDate(started),
      startOdo: active.startOdo,
      endOdo: Number(endOdo),
      category: active.category,
      purpose: active.purpose,
      destination: active.destination,
      notes: notes.trim(),
      startedAt: active.startedAt,
      endedAt: new Date().toISOString(),
    })
  }

  return (
    <form className="card hero active" onSubmit={submit}>
      <div className="row-between">
        <span className="pill live"><span className="dot" /> In progress · {elapsed}</span>
        <span className={`tag ${active.category.toLowerCase()}`}>{active.category}</span>
      </div>
      <h2>{active.purpose || 'Trip'}{active.destination ? ` → ${active.destination}` : ''}</h2>
      <p className="muted">
        Started {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} at {num(active.startOdo)} {settings.unit}
      </p>
      <label className="field">
        <span>Ending odometer</span>
        <input type="number" inputMode="decimal" step="0.1" min={active.startOdo} required autoFocus
          value={endOdo} onChange={(e) => setEndOdo(e.target.value)} placeholder={String(active.startOdo)} />
      </label>
      {dist !== null && (
        <p className={invalid ? 'error' : 'distance'}>
          {invalid ? 'Ending reading is below the starting reading.' : `${num(dist)} ${settings.unit}`}
          {!invalid && active.category === 'Business' && <span> · {money(dist * settings.rate)}</span>}
        </p>
      )}
      <label className="field">
        <span>Notes <em>(optional)</em></span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tolls, parking, details…" />
      </label>
      <button className="btn primary big" type="submit" disabled={invalid}>End trip &amp; save</button>
      <button className="btn ghost" type="button" onClick={() => confirm('Discard this trip?') && onCancel()}>
        Discard trip
      </button>
    </form>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat${accent ? ' accent' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function Segmented({ value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Category">
      {CATEGORIES.map((c) => (
        <button type="button" key={c} role="radio" aria-checked={value === c}
          className={value === c ? 'on' : ''} onClick={() => onChange(c)}>
          {c}
        </button>
      ))}
    </div>
  )
}

function TripRow({ trip, settings, onClick }) {
  return (
    <li>
      <button className="trip" onClick={onClick}>
        <div className="trip-main">
          <span className="trip-title">{trip.purpose || trip.destination || 'Trip'}</span>
          <span className="trip-meta">
            {dayLabel(trip.date)} · {num(trip.startOdo)}–{num(trip.endOdo)}
          </span>
        </div>
        <div className="trip-side">
          <span className="trip-dist">{num(distance(trip))} {settings.unit}</span>
          <span className={`tag ${trip.category.toLowerCase()}`}>{trip.category}</span>
        </div>
      </button>
    </li>
  )
}

/* ---------- Log ---------- */

function Log({ trips, settings, onEdit, onAdd }) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortTrips(trips).filter((t) =>
      (filter === 'All' || t.category === filter) &&
      (!q || [t.purpose, t.destination, t.notes].some((s) => s?.toLowerCase().includes(q)))
    )
  }, [trips, filter, query])

  const groups = useMemo(() => {
    const m = new Map()
    for (const t of shown) {
      const k = monthKey(t.date)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(t)
    }
    return [...m]
  }, [shown])

  return (
    <>
      <div className="toolbar">
        <input className="search" type="search" placeholder="Search trips" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn primary" onClick={onAdd}>+ Add</button>
      </div>
      <div className="chips">
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      {groups.length === 0 ? (
        <section className="card"><p className="empty">{trips.length ? 'No trips match.' : 'No trips logged yet.'}</p></section>
      ) : (
        groups.map(([k, list]) => (
          <section className="card" key={k}>
            <div className="row-between">
              <h2>{monthLabel(k)}</h2>
              <span className="muted">{num(list.reduce((a, t) => a + distance(t), 0))} {settings.unit}</span>
            </div>
            <ul className="trips">
              {list.map((t) => <TripRow key={t.id} trip={t} settings={settings} onClick={() => onEdit(t)} />)}
            </ul>
          </section>
        ))
      )}
    </>
  )
}

/* ---------- Trip editor ---------- */

function TripSheet({ trip, trips, settings, onSave, onDelete, onClose }) {
  const isNew = !trip.id
  const [f, setF] = useState(() => ({
    date: trip.date || today(),
    startOdo: trip.startOdo ?? lastOdometer(trips),
    endOdo: trip.endOdo ?? '',
    category: trip.category || 'Business',
    purpose: trip.purpose || '',
    destination: trip.destination || '',
    notes: trip.notes || '',
  }))
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e })
  const dist = f.startOdo !== '' && f.endOdo !== '' ? Number(f.endOdo) - Number(f.startOdo) : null
  const invalid = dist !== null && dist < 0

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    if (invalid) return
    onSave({
      ...trip,
      id: trip.id || uid(),
      date: f.date,
      startOdo: Number(f.startOdo),
      endOdo: Number(f.endOdo),
      category: f.category,
      purpose: f.purpose.trim(),
      destination: f.destination.trim(),
      notes: f.notes.trim(),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grip" />
        <div className="row-between">
          <h2>{isNew ? 'Add trip' : 'Edit trip'}</h2>
          <button type="button" className="link" onClick={onClose}>Cancel</button>
        </div>
        <label className="field">
          <span>Date</span>
          <input type="date" required value={f.date} onChange={set('date')} />
        </label>
        <div className="two">
          <label className="field">
            <span>Start odometer</span>
            <input type="number" inputMode="decimal" step="0.1" min="0" required value={f.startOdo} onChange={set('startOdo')} />
          </label>
          <label className="field">
            <span>End odometer</span>
            <input type="number" inputMode="decimal" step="0.1" min="0" required value={f.endOdo} onChange={set('endOdo')} />
          </label>
        </div>
        {dist !== null && (
          <p className={invalid ? 'error' : 'distance'}>
            {invalid ? 'End reading must be at least the start reading.' : `${num(dist)} ${settings.unit}`}
            {!invalid && f.category === 'Business' && <span> · {money(dist * settings.rate)}</span>}
          </p>
        )}
        <Segmented value={f.category} onChange={set('category')} />
        <label className="field">
          <span>Purpose</span>
          <input value={f.purpose} onChange={set('purpose')} placeholder="Client visit, supply run…" />
        </label>
        <label className="field">
          <span>Destination</span>
          <input value={f.destination} onChange={set('destination')} />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows="2" value={f.notes} onChange={set('notes')} />
        </label>
        <button className="btn primary big" type="submit" disabled={invalid}>Save trip</button>
        {!isNew && (
          <button type="button" className="btn danger" onClick={() => confirm('Delete this trip?') && onDelete(trip.id)}>
            Delete trip
          </button>
        )}
      </form>
    </div>
  )
}

/* ---------- Reports ---------- */

function Reports({ trips, settings }) {
  const now = new Date()
  const presets = {
    month: [localDate(new Date(now.getFullYear(), now.getMonth(), 1)), today()],
    lastMonth: [
      localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    ],
    year: [`${now.getFullYear()}-01-01`, today()],
    lastYear: [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`],
  }
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(presets.month)
  const pick = (p) => {
    setPreset(p)
    setRange(presets[p])
  }

  const inRange = trips.filter((t) => t.date >= range[0] && t.date <= range[1])
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, inRange.filter((t) => t.category === c).reduce((a, t) => a + distance(t), 0)]))
  const total = Object.values(byCat).reduce((a, b) => a + b, 0)
  const bizPct = total ? (byCat.Business / total) * 100 : 0

  const exportCSV = () => download(`mileage_${range[0]}_to_${range[1]}.csv`, toCSV(inRange, settings), 'text/csv')

  return (
    <>
      <div className="chips">
        {[['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year'], ['lastYear', 'Last year']].map(([k, l]) => (
          <button key={k} className={preset === k ? 'chip on' : 'chip'} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      <section className="card">
        <div className="two">
          <label className="field">
            <span>From</span>
            <input type="date" value={range[0]} onChange={(e) => { setPreset(''); setRange([e.target.value, range[1]]) }} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={range[1]} onChange={(e) => { setPreset(''); setRange([range[0], e.target.value]) }} />
          </label>
        </div>
      </section>

      <section className="card report">
        <p className="muted">Business reimbursement</p>
        <p className="big-number">{money(byCat.Business * settings.rate)}</p>
        <p className="muted">{num(byCat.Business)} {settings.unit} × {money(settings.rate)}/{settings.unit} · {inRange.length} trip{inRange.length === 1 ? '' : 's'}</p>

        <div className="bar" role="img" aria-label={`Business ${Math.round(bizPct)}% of distance`}>
          {CATEGORIES.map((c) => total > 0 && byCat[c] > 0 && (
            <span key={c} className={c.toLowerCase()} style={{ width: `${(byCat[c] / total) * 100}%` }} />
          ))}
        </div>
        <ul className="legend">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <span className={`swatch ${c.toLowerCase()}`} />
              <span>{c}</span>
              <strong>{num(byCat[c])} {settings.unit}</strong>
            </li>
          ))}
          <li className="total">
            <span />
            <span>Total</span>
            <strong>{num(total)} {settings.unit}</strong>
          </li>
        </ul>
        <p className="muted small">Business use: {total ? `${bizPct.toFixed(1)}%` : '—'}</p>
      </section>

      <button className="btn primary big" onClick={exportCSV} disabled={!inRange.length}>
        Export {inRange.length} trip{inRange.length === 1 ? '' : 's'} as CSV
      </button>
      <p className="muted small center">Opens in Excel, Numbers or Google Sheets for expense reports.</p>
    </>
  )
}

/* ---------- Settings ---------- */

function Settings({ state, onChange, onReplace, notify }) {
  const s = state.settings
  const fileRef = useRef(null)
  // Keep the raw text while typing so "0.70" doesn't collapse to "0.7" mid-entry
  const [rateDraft, setRateDraft] = useState(String(s.rate))
  const set = (k) => (e) => onChange({ ...s, [k]: e.target.value })

  const backup = () => {
    download(`mileage-backup-${today()}.json`, JSON.stringify({ app: 'mileage-tracker', version: 1, ...state }, null, 2), 'application/json')
    notify('Backup downloaded')
  }

  const restore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const next = normalizeImport(JSON.parse(await file.text()))
      if (confirm(`Replace current data with ${next.trips.length} trips from this backup?`)) {
        onReplace(next)
        setRateDraft(String(next.settings.rate))
      }
    } catch (err) {
      alert(err.message || 'Could not read that file')
    }
  }

  const reset = () => {
    if (confirm('Delete all trips and settings? Download a backup first if you need one.')) {
      onReplace({ trips: [], active: null, settings: DEFAULT_SETTINGS })
      setRateDraft(String(DEFAULT_SETTINGS.rate))
    }
  }

  return (
    <>
      <section className="card">
        <h2>Vehicle</h2>
        <label className="field">
          <span>Name</span>
          <input value={s.vehicle} onChange={set('vehicle')} placeholder="2024 Ford Transit" />
        </label>
        <div className="two">
          <label className="field">
            <span>Plate / unit #</span>
            <input value={s.plate} onChange={set('plate')} />
          </label>
          <label className="field">
            <span>Driver</span>
            <input value={s.driver} onChange={set('driver')} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Reimbursement</h2>
        <div className="two">
          <label className="field">
            <span>Rate ($ per {s.unit})</span>
            <input type="number" inputMode="decimal" step="0.001" min="0" value={rateDraft}
              onChange={(e) => {
                setRateDraft(e.target.value)
                const n = Number(e.target.value)
                if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange({ ...s, rate: n })
              }}
              onBlur={() => setRateDraft(String(s.rate))} />
          </label>
          <label className="field">
            <span>Units</span>
            <select value={s.unit} onChange={set('unit')}>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
        </div>
        <p className="muted small">Defaults to the 2026 IRS business rate (72.5¢/mi). Change it to match your employer's policy.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Trips are stored only on this device, in this browser. Download a backup regularly, or to move to a new phone.</p>
        <button className="btn" onClick={backup}>Download backup</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        <button className="btn danger" onClick={reset}>Erase all data</button>
      </section>

      <p className="muted small center">Tip: use Share → Add to Home Screen to open this like an app.</p>
    </>
  )
}
