import { StrictMode, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingPage from './pages/LandingPage.jsx'
import TransitionLoader from './components/TransitionLoader.jsx'
import { Analytics } from "@vercel/analytics/react"

function Root() {

  const [view, setView] = useState('landing')

  const handleStart = useCallback(() => {
    setView('loading')
  }, [])

  const handleLoaderDone = useCallback(() => {
    setView('app')
  }, [])

  return (
    <>
      {/* Landing page — unmount once we're in app */}
      {view === 'landing' && <LandingPage onStart={handleStart} />}

      {/* Skeleton loader — overlays landing briefly, then reveals app */}
      {view === 'loading' && <TransitionLoader onDone={handleLoaderDone} />}

      {/* App — mounted immediately when loading starts so it's ready underneath */}
      {view === 'app' && <App />}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Analytics />
    <Root />
  </StrictMode>,
)
