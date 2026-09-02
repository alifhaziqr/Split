/**
 * Composition root: builds the one real ApiClient and QueryClient and mounts
 * <App/> under them. Deliberately thin and untested — matches
 * src/server/index.ts's own split between an untested process entrypoint
 * and its tested composition (app.ts / App.tsx).
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './App.js'
import { ApiClientProvider } from './net/apiClientContext.js'
import { createApiClient } from './net/client.js'
import './index.css'
import { createQueryClient } from './queries/queryClient.js'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('#root element not found — check src/web/index.html')
}

const apiClient = createApiClient()
const queryClient = createQueryClient()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
)
