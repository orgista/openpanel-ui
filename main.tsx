import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { installDiagnostics, recordDiagnostic } from './app/native/diagnostics'
import './styles/index.css'

installDiagnostics()
recordDiagnostic("info", "OpenPanel started")

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
