import React, { useEffect, useState } from 'react'

const ENERGY_LABELS = { 1: '😩 Drained', 2: '😕 Low', 3: '😐 Neutral', 4: '😊 Good', 5: '🔥 Peak' }

function getWeekStart(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7)
  return d.toISOString().split('T')[0]
}

const EMPTY = { what_worked: '', what_didnt: '', dropping_this_week: '', focus_next_week: '', energy_rating: 3 }

export default function WeeklyReview({ awardXp }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [form, setForm]       = useState(EMPTY)
  const [hasEntry, setHasEntry] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const weekStart = getWeekStart(weekOffset)

  useEffect(() => { if (window.electronAPI) load() }, [weekStart])

  async function load() {
    try {
      const row = await window.electronAPI.db.get(
        'SELECT * FROM weekly_reviews WHERE week_start = ?', [weekStart]
      )
      if (row) {
        setHasEntry(true)
        setForm({
          what_worked:        row.what_worked || '',
          what_didnt:         row.what_didnt  || '',
          dropping_this_week: row.dropping_this_week || '',
          focus_next_week:    row.focus_next_week    || '',
          energy_rating:      row.energy_rating || 3,
        })
      } else {
        setHasEntry(false)
        setForm(EMPTY)
      }
    } catch {}
  }

  async function save() {
    setSaving(true)
    try {
      const isNew = !hasEntry
      await window.electronAPI.db.run(
        `INSERT INTO weekly_reviews (week_start,what_worked,what_didnt,dropping_this_week,focus_next_week,energy_rating)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(week_start) DO UPDATE SET
           what_worked=excluded.what_worked,
           what_didnt=excluded.what_didnt,
           dropping_this_week=excluded.dropping_this_week,
           focus_next_week=excluded.focus_next_week,
           energy_rating=excluded.energy_rating`,
        [weekStart, form.what_worked, form.what_didnt, form.dropping_this_week, form.focus_next_week, form.energy_rating]
      )
      if (isNew) {
        setHasEntry(true)
        await awardXp?.(25)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  const tf = (key, placeholder, rows = 3) => (
    <textarea
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint resize-none leading-relaxed"
    />
  )

  return (
    <div className="page-enter max-w-[680px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Weekly Review</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Reflect, reset, refocus</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-[12px] font-bold text-teal-dark w-[120px] text-center">
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `Week of ${weekStart}`}
          </span>
          <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0} className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border disabled:opacity-30 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Energy rating */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-3">Overall energy this week</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setForm(f => ({ ...f, energy_rating: n }))}
                className={`flex-1 py-2 rounded-[10px] text-[11px] font-bold transition-all ${
                  form.energy_rating === n
                    ? 'bg-primary text-white shadow-sm scale-105'
                    : 'bg-teal-pale text-text-muted hover:bg-teal-light'
                }`}
              >
                {ENERGY_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* Review questions */}
        <ReviewSection label="✅ What worked well?" hint="Wins, breakthroughs, things to repeat">
          {tf('what_worked', 'e.g. Deep work blocks in the morning, consistent gym sessions…')}
        </ReviewSection>

        <ReviewSection label="⚡ What didn't work?" hint="Obstacles, time sinks, patterns to break">
          {tf('what_didnt', 'e.g. Too much time on social media, missed 2 study sessions…')}
        </ReviewSection>

        <ReviewSection label="🗑 Dropping this week" hint="One habit, obligation, or distraction to cut">
          {tf('dropping_this_week', 'e.g. Late-night scrolling before bed…', 2)}
        </ReviewSection>

        <ReviewSection label="🎯 Focus for next week" hint="The one thing that moves the needle most">
          {tf('focus_next_week', 'e.g. Submit 5 internship applications, finish HSK chapter 7…', 2)}
        </ReviewSection>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-primary text-white text-[13px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors"
        >
          {saved ? '✓ Review Saved!' : saving ? 'Saving…' : 'Save Review'}
        </button>
      </div>
    </div>
  )
}

function ReviewSection({ label, hint, children }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <p className="text-[13px] font-bold text-teal-dark mb-0.5">{label}</p>
      {hint && <p className="text-[11px] text-text-hint mb-3">{hint}</p>}
      {children}
    </div>
  )
}
