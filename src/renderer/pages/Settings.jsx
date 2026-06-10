import React, { useEffect, useState } from 'react'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', keyLabel: 'API Key', keyPlaceholder: 'sk-ant-…' },
  { value: 'openai',    label: 'OpenAI (GPT)',        keyLabel: 'API Key', keyPlaceholder: 'sk-…'     },
  { value: 'gemini',    label: 'Google Gemini',       keyLabel: 'API Key', keyPlaceholder: 'AI…'      },
  { value: 'ollama',    label: 'Ollama (Local)',      keyLabel: null,      keyPlaceholder: null        },
]

const ANTHROPIC_MODELS = ['claude-sonnet-4-20250514', 'claude-opus-4-5', 'claude-haiku-4-5']
const OPENAI_MODELS    = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
const GEMINI_MODELS    = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']

function modelsFor(provider) {
  if (provider === 'anthropic') return ANTHROPIC_MODELS
  if (provider === 'openai')    return OPENAI_MODELS
  if (provider === 'gemini')    return GEMINI_MODELS
  return []
}

const inputCls = 'w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint'

export default function Settings({ onProfileUpdate }) {
  const [profile, setProfile] = useState({ name: '', initials: '' })
  const [ai, setAi]           = useState({ provider: 'anthropic', model: 'claude-sonnet-4-20250514', key: '', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'llama3' })
  const [prefs, setPrefs]     = useState({ launch_on_startup: 'true', start_minimized: 'false' })
  const [saved, setSaved]     = useState('')
  const [showKey, setShowKey] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const [name, initials, provider, model, ollamaEndpoint, ollamaModel, startup, minimized] = await Promise.all([
        window.electronAPI.settings.get('user_name'),
        window.electronAPI.settings.get('user_initials'),
        window.electronAPI.settings.get('ai_provider'),
        window.electronAPI.settings.get('ai_model'),
        window.electronAPI.settings.get('ollama_endpoint'),
        window.electronAPI.settings.get('ollama_model'),
        window.electronAPI.settings.get('launch_on_startup'),
        window.electronAPI.settings.get('start_minimized'),
      ])
      setProfile({ name: name || '', initials: initials || '' })
      const prov = provider || 'anthropic'
      setAi({ provider: prov, model: model || 'claude-sonnet-4-20250514', key: '', ollamaEndpoint: ollamaEndpoint || 'http://localhost:11434', ollamaModel: ollamaModel || 'llama3' })
      setPrefs({ launch_on_startup: startup || 'true', start_minimized: minimized || 'false' })
    } catch {}
  }

  async function saveProfile() {
    try {
      await Promise.all([
        window.electronAPI.settings.set('user_name', profile.name),
        window.electronAPI.settings.set('user_initials', profile.initials),
      ])
      onProfileUpdate?.(profile.name, profile.initials)
      flash('profile')
    } catch {}
  }

  async function saveAi() {
    try {
      await Promise.all([
        window.electronAPI.settings.set('ai_provider', ai.provider),
        window.electronAPI.settings.set('ai_model', ai.model),
        window.electronAPI.settings.set('ollama_endpoint', ai.ollamaEndpoint),
        window.electronAPI.settings.set('ollama_model', ai.ollamaModel),
      ])
      if (ai.key.trim()) {
        await window.electronAPI.settings.setApiKey(ai.provider, ai.key.trim())
        setAi(a => ({ ...a, key: '' }))
      }
      flash('ai')
    } catch {}
  }

  async function savePrefs() {
    try {
      await Promise.all([
        window.electronAPI.settings.set('launch_on_startup', prefs.launch_on_startup),
        window.electronAPI.settings.set('start_minimized', prefs.start_minimized),
      ])
      if (window.electronAPI.system?.setLoginItem) {
        window.electronAPI.system.setLoginItem(prefs.launch_on_startup === 'true')
      }
      flash('prefs')
    } catch {}
  }

  async function exportData() {
    setExporting(true)
    try {
      await window.electronAPI.system.exportData()
    } catch {} finally { setExporting(false) }
  }

  function flash(key) {
    setSaved(key)
    setTimeout(() => setSaved(''), 2000)
  }

  const models = modelsFor(ai.provider)
  const prov   = PROVIDERS.find(p => p.value === ai.provider)

  return (
    <div className="page-enter max-w-[600px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-extrabold text-teal-dark">Settings</h1>
        <p className="text-[12px] text-text-muted mt-0.5">Configure your Life OS</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Profile */}
        <Section title="Profile">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Display name">
              <input value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value}))} placeholder="Your name" className={inputCls} />
            </Field>
            <Field label="Initials">
              <input value={profile.initials} onChange={e => setProfile(p => ({...p, initials: e.target.value.toUpperCase().slice(0,3)}))} placeholder="PK" maxLength={3} className={inputCls} />
            </Field>
          </div>
          <SaveBtn onClick={saveProfile} saved={saved === 'profile'} />
        </Section>

        {/* AI */}
        <Section title="AI Assistant">
          <div className="flex flex-col gap-3 mb-4">
            <Field label="Provider">
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => {
                      const firstModel = modelsFor(p.value)[0] || ai.model
                      setAi(a => ({ ...a, provider: p.value, model: firstModel, key: '' }))
                    }}
                    className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all border ${
                      ai.provider === p.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-teal-pale text-text-sec border-teal-border hover:border-primary/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            {models.length > 0 && (
              <Field label="Model">
                <select value={ai.model} onChange={e => setAi(a => ({...a, model: e.target.value}))} className={inputCls}>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            )}

            {ai.provider === 'ollama' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ollama endpoint">
                  <input value={ai.ollamaEndpoint} onChange={e => setAi(a => ({...a, ollamaEndpoint: e.target.value}))} className={inputCls} />
                </Field>
                <Field label="Model name">
                  <input value={ai.ollamaModel} onChange={e => setAi(a => ({...a, ollamaModel: e.target.value}))} placeholder="llama3" className={inputCls} />
                </Field>
              </div>
            ) : (
              <Field label={prov?.keyLabel || 'API Key'}>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={ai.key}
                    onChange={e => setAi(a => ({...a, key: e.target.value}))}
                    placeholder={`Enter new key to update (${prov?.keyPlaceholder || '…'})`}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-hint hover:text-text-sec transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showKey
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      }
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-text-hint mt-1">Key is stored encrypted on this device only.</p>
              </Field>
            )}
          </div>
          <SaveBtn onClick={saveAi} saved={saved === 'ai'} />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <div className="flex flex-col gap-3 mb-4">
            <Toggle
              label="Launch on startup"
              hint="Start Life OS when Windows boots"
              value={prefs.launch_on_startup === 'true'}
              onChange={v => setPrefs(p => ({...p, launch_on_startup: String(v)}))}
            />
            <Toggle
              label="Start minimized"
              hint="Launch to tray instead of showing window"
              value={prefs.start_minimized === 'true'}
              onChange={v => setPrefs(p => ({...p, start_minimized: String(v)}))}
            />
          </div>
          <SaveBtn onClick={savePrefs} saved={saved === 'prefs'} />
        </Section>

        {/* Data */}
        <Section title="Data">
          <p className="text-[12px] text-text-muted mb-4">All data is stored locally at <code className="bg-teal-light px-1 rounded text-[11px]">%APPDATA%/life-os/lifeos.db</code></p>
          <button
            onClick={exportData}
            disabled={exporting}
            className="px-4 py-2 bg-teal-light text-teal-dark text-[12px] font-bold rounded-[10px] hover:bg-teal-border disabled:opacity-40 transition-colors"
          >
            {exporting ? 'Exporting…' : 'Export All Data (JSON)'}
          </button>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <p className="text-[14px] font-extrabold text-teal-dark mb-4">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}

function SaveBtn({ onClick, saved }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 bg-primary text-white text-[11px] font-bold rounded-[10px] hover:bg-teal-med transition-colors"
    >
      {saved ? '✓ Saved!' : 'Save'}
    </button>
  )
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[12px] font-semibold text-text-pri">{label}</p>
        {hint && <p className="text-[10px] text-text-hint">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-primary' : 'bg-teal-border'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
