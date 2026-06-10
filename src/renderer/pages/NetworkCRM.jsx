import React, { useEffect, useState } from 'react'
import Modal from '../components/Modal'

const REL_TYPES = ['mentor', 'peer', 'recruiter', 'investor', 'friend', 'other']

const DEFAULT_FORM = { name: '', role: '', company: '', relationship_type: 'peer', last_contact_date: '', next_action: '', next_action_date: '', notes: '' }

const inputCls = 'w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint'

export default function NetworkCRM() {
  const [contacts, setContacts]   = useState([])
  const [search, setSearch]       = useState('')
  const [adding, setAdding]       = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(DEFAULT_FORM)
  const [saving, setSaving]       = useState(false)

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const rows = await window.electronAPI.db.query(
        'SELECT * FROM contacts ORDER BY next_action_date ASC, name ASC', []
      )
      setContacts(rows)
    } catch {}
  }

  function openAdd() { setForm(DEFAULT_FORM); setEditing(null); setAdding(true) }
  function openEdit(c) {
    setForm({
      name: c.name, role: c.role || '', company: c.company || '',
      relationship_type: c.relationship_type || 'peer',
      last_contact_date: c.last_contact_date || '',
      next_action: c.next_action || '',
      next_action_date: c.next_action_date || '',
      notes: c.notes || '',
    })
    setEditing(c.id)
    setAdding(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const vals = [form.name.trim(), form.role, form.company, form.relationship_type,
                    form.last_contact_date || null, form.next_action, form.next_action_date || null, form.notes]
      if (editing) {
        await window.electronAPI.db.run(
          'UPDATE contacts SET name=?,role=?,company=?,relationship_type=?,last_contact_date=?,next_action=?,next_action_date=?,notes=? WHERE id=?',
          [...vals, editing]
        )
      } else {
        await window.electronAPI.db.run(
          'INSERT INTO contacts (name,role,company,relationship_type,last_contact_date,next_action,next_action_date,notes) VALUES (?,?,?,?,?,?,?,?)',
          vals
        )
      }
      setAdding(false)
      await load()
    } catch {} finally { setSaving(false) }
  }

  async function del(id) {
    await window.electronAPI.db.run('DELETE FROM contacts WHERE id = ?', [id])
    await load()
  }

  const visible = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase())
  )

  const overdue = contacts.filter(c => c.next_action_date && c.next_action_date < new Date().toISOString().split('T')[0])

  return (
    <div className="page-enter max-w-[800px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Network CRM</h1>
          <p className="text-[12px] text-text-muted mt-0.5">{contacts.length} contacts · {overdue.length} follow-ups overdue</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-[10px] hover:bg-teal-med transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-hint" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="w-full pl-9 pr-3 py-2 text-[12px] bg-white border border-teal-border rounded-[10px] outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
        />
      </div>

      {/* Contact list */}
      <div className="flex flex-col gap-2">
        {visible.map(c => <ContactRow key={c.id} contact={c} onEdit={openEdit} onDelete={del} />)}
        {visible.length === 0 && (
          <div className="text-center py-16 text-text-hint text-[13px]">
            {search ? 'No contacts match your search.' : 'No contacts yet. Start building your network!'}
          </div>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title={editing ? 'Edit Contact' : 'Add Contact'} width={480}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-text-muted mb-1">Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Role</label>
            <input value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} placeholder="e.g. VP Finance" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Company</label>
            <input value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} placeholder="e.g. Goldman Sachs" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Relationship</label>
            <select value={form.relationship_type} onChange={e => setForm(f => ({...f, relationship_type: e.target.value}))} className={inputCls}>
              {REL_TYPES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Last contact</label>
            <input type="date" value={form.last_contact_date} onChange={e => setForm(f => ({...f, last_contact_date: e.target.value}))} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-text-muted mb-1">Next action</label>
            <input value={form.next_action} onChange={e => setForm(f => ({...f, next_action: e.target.value}))} placeholder="e.g. Follow up on internship application" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Due date</label>
            <input type="date" value={form.next_action_date} onChange={e => setForm(f => ({...f, next_action_date: e.target.value}))} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any context…" className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setAdding(false)} className="px-4 py-2 text-[12px] font-bold text-text-sec hover:text-teal-dark transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="px-5 py-2 bg-primary text-white text-[12px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function ContactRow({ contact: c, onEdit, onDelete }) {
  const today   = new Date().toISOString().split('T')[0]
  const overdue = c.next_action_date && c.next_action_date < today

  return (
    <div className="bg-white border border-teal-border rounded-card px-5 py-4 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm transition-all group">
      <div className="w-9 h-9 rounded-full bg-teal-light flex items-center justify-center flex-shrink-0">
        <span className="text-[13px] font-extrabold text-teal-dark">
          {c.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-teal-dark">{c.name}</span>
          <span className="text-[10px] text-text-hint bg-teal-pale px-2 py-0.5 rounded-full capitalize">{c.relationship_type}</span>
        </div>
        {(c.role || c.company) && (
          <p className="text-[11px] text-text-muted">{[c.role, c.company].filter(Boolean).join(' · ')}</p>
        )}
        {c.next_action && (
          <p className={`text-[11px] mt-0.5 font-medium ${overdue ? 'text-red-500' : 'text-text-sec'}`}>
            {overdue ? '⚠ ' : '→ '}{c.next_action}
            {c.next_action_date && <span className="text-text-hint ml-1">({c.next_action_date})</span>}
          </p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(c)} className="p-1.5 text-text-hint hover:text-teal-dark transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button onClick={() => onDelete(c.id)} className="p-1.5 text-text-hint hover:text-red-500 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
