import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// The frontend (Cloudflare Pages) and backend (Cloudflare Workers) are
// deployed separately, so API calls need an absolute URL instead of a
// same-origin relative path. Set VITE_API_BASE_URL in Pages' build
// environment variables to your Worker's URL, e.g.
// https://relay-mesh.<your-subdomain>.workers.dev
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
