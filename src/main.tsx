import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppUpdateProvider } from './context/AppUpdateContext';
import { UnreadProvider } from './context/UnreadContext';
import { InboxProvider } from './context/InboxContext';
import { ServiceChromeProvider } from './context/ServiceChromeContext';
import { ErrorBoundary, PopoutServiceApp } from './components/common';
import './index.css';

function isPopoutRoute() {
  return (window.location.hash || '').startsWith('#/popout/');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isPopoutRoute() ? (
        <ThemeProvider>
          <PopoutServiceApp />
        </ThemeProvider>
      ) : (
        <ThemeProvider>
          <AuthProvider>
            <AppUpdateProvider>
              <UnreadProvider>
                <InboxProvider>
                  <ServiceChromeProvider>
                    <App />
                  </ServiceChromeProvider>
                </InboxProvider>
              </UnreadProvider>
            </AppUpdateProvider>
          </AuthProvider>
        </ThemeProvider>
      )}
    </ErrorBoundary>
  </StrictMode>
);
