import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { StartupAnimation } from './app/components/StartupAnimation'
import { installDiagnostics, recordDiagnostic } from './app/native/diagnostics'
import './styles/index.css'

installDiagnostics()
recordDiagnostic("info", "OpenPanel started")

function OpenPanelRoot() {
  const [startupComplete, setStartupComplete] = useState(false)

  return startupComplete
    ? <App />
    : <StartupAnimation onComplete={() => setStartupComplete(true)} />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OpenPanelRoot />
  </React.StrictMode>,
)
