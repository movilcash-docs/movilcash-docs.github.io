import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext.tsx'
import { RootFolderProvider } from './drive/RootFolderContext.tsx'
import { LightboxProvider } from './lightbox/LightboxContext.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RootFolderProvider>
        <LightboxProvider>
          <App />
        </LightboxProvider>
      </RootFolderProvider>
    </AuthProvider>
  </StrictMode>,
)
