const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run:   (sql, params) => ipcRenderer.invoke('db:run',   sql, params),
    get:   (sql, params) => ipcRenderer.invoke('db:get',   sql, params),
  },
  ai: {
    chat: (messages, provider, model, ollamaEndpoint, systemPrompt) =>
      ipcRenderer.invoke('ai:chat', { messages, provider, model, ollamaEndpoint, systemPrompt }),
  },
  settings: {
    get:              (key)        => ipcRenderer.invoke('settings:get',      key),
    set:              (key, value) => ipcRenderer.invoke('settings:set',      key, value),
    getApiKey:        (provider)   => ipcRenderer.invoke('settings:getApiKey',   provider),
    setApiKey:        (provider, plaintext) => ipcRenderer.invoke('settings:setApiKey', provider, plaintext),
  },
  files: {
    readDocument: () => ipcRenderer.invoke('files:readDocument'),
  },
  system: {
    setLoginItem: (enabled)  => ipcRenderer.invoke('system:setLoginItem', enabled),
    exportData:   ()         => ipcRenderer.invoke('system:exportData'),
  },
  xp: {
    award: (amount) => ipcRenderer.invoke('xp:award', amount),
  },
  widget: {
    openMain:      ()      => ipcRenderer.invoke('widget:open-main'),
    minimize:      ()      => ipcRenderer.invoke('widget:minimize'),
    hide:          ()      => ipcRenderer.invoke('widget:hide'),
    setAlwaysOnTop: (val)  => ipcRenderer.invoke('widget:set-always-on-top', val),
  },
})
