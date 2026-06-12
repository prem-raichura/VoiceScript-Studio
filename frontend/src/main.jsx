import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingPage from './pages/LandingPage.jsx'
import { Analytics } from "@vercel/analytics/react"

function Root() {
  const [showApp, setShowApp] = useState(false)

  return showApp ? (
    <App />
  ) : (
    <LandingPage onStart={() => setShowApp(true)} />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Analytics />
    <Root />
  </StrictMode>,
)
