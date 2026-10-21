import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import Portal from './Portal.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Portal />
  </StrictMode>,
)
