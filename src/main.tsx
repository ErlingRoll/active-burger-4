import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToasterProvider } from './ui/Toaster'
import { ErrorBoundary } from './ui/ErrorBoundary'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('index.html must provide a #root element to mount into.')
}

createRoot(rootElement).render(
  <StrictMode>
    <ToasterProvider>
      <ErrorBoundary label="Active Burger">
        <App />
      </ErrorBoundary>
    </ToasterProvider>
  </StrictMode>,
)
