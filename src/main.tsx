import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext.tsx'
import { RootFolderProvider } from './drive/RootFolderContext.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RootFolderProvider>
        <App />
      </RootFolderProvider>
    </AuthProvider>
  </StrictMode>,
)
