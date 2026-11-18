import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Prototype from './prototype/role-graph-timeline'
import './prototype/role-graph-timeline/prototype.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.pathname.startsWith('/prototype') ? <Prototype /> : <App />}
  </StrictMode>,
)
