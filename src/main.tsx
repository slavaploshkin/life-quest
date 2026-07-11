import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PasscodeGate } from './components/PasscodeGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasscodeGate>
      {({ account, logout }) => <App key={account.userId} account={account} onLogout={logout} />}
    </PasscodeGate>
  </StrictMode>,
)
