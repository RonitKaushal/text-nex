import React, { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Modal } from 'antd'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Connection from './pages/Connection'
import Templates from './pages/Templates'
import AddTemplate from './pages/AddTemplate'
import Campaign from './pages/Campaign'
import CampaignFinal from './pages/CampaignFinal'
import Messaging from './pages/Messaging'
import ReceivedMessages from './pages/ReceivedMessages'
import Sidebar from './components/Sidebar'
import LoadingSpinner from './components/common/LoadingSpinner'
import NetworkError from './pages/NetworkError'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { MessageToastProvider, useMessageToast } from './context/MessageToastContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Header from './components/Header'
import { useSocket } from './hooks/useSocket'
import ErrorBoundary from './components/common/ErrorBoundary'
import { APP_ICON_256 } from './components/common/AppBrand'

const { Content } = Layout

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, isInitialized } = useAuth()
  
  // Show loading spinner while initializing auth
  if (!isInitialized || loading) {
    return (
      <LoadingSpinner 
        message="Loading..." 
        style={{ minHeight: '100vh', background: 'transparent' }}
      />
    )
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, isInitialized } = useAuth()
  
  // Show loading spinner while initializing auth
  if (!isInitialized || loading) {
    return (
      <LoadingSpinner 
        message="Loading..." 
        style={{ minHeight: '100vh', background: 'transparent' }}
      />
    )
  }
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

const AppLayout = ({ children }) => {
  const { isAuthenticated, loading, isInitialized, token, user } = useAuth()
  const { info } = useToast()
  const { notify } = useMessageToast()
  const { theme } = useTheme()
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { on, off } = useSocket({ token: isAuthenticated ? token : null });

  useEffect(() => {
    if (isAuthenticated && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    if (isAuthenticated && on && off) {
      const showNotification = (msg) => {
        const phone = msg.from ? msg.from.split('@')[0] : '';
        const name = msg.pushName || '';
        const title = name ? `${phone} (${name})` : phone;
        const body = msg.message || 'New message received';
        const imageUrl = msg.profilePicUrl || null;
        
        // Show in-app custom toast
        notify(title, body, imageUrl);

        // Show native desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: imageUrl || APP_ICON_256
            });
          } catch (e) {
            // ignore desktop notification errors
          }
        }
      };

      const handleNewMessage = async (newMessage) => {
        showNotification(newMessage);

        // Save to Electron Store globally
        if (window.electronAPI && user) {
          const messageToSave = { 
              ...newMessage, 
              userId: user._id || user.id 
          };
          
          try {
              await window.electronAPI.saveMessage({
                  userId: user._id || user.id,
                  message: messageToSave
              });
              // Dispatch event to notify components that a message has been saved
              window.dispatchEvent(new CustomEvent('message-saved', { detail: messageToSave }));
           } catch (err) {
             console.error("Failed to save message globally:", err);
          }
        }
      };
      // const handleReceivedMessage = (newMessage) => showNotification(newMessage);

      on('new_message', handleNewMessage);
      // on('received_message', handleReceivedMessage);

      return () => {
        off('new_message', handleNewMessage);
        // off('received_message', handleReceivedMessage);
      };
    }
  }, [isAuthenticated, on, off, user]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable(() => {
        info('A new update is available. Downloading...', 5000)
      })

      window.electronAPI.onUpdateNotAvailable(() => {
        info('You are on the latest version.', 3000)
      })

      window.electronAPI.onUpdateError((err) => {
        console.error('Update error:', err)
        // info('Error checking for updates', 3000) // Optional: don't annoy user if auto-check fails
      })

      window.electronAPI.onUpdateDownloaded(() => {
        Modal.confirm({
          title: 'Update Downloaded',
          content: 'A new version has been downloaded. Restart the application to apply updates?',
          onOk() {
            window.electronAPI.restartApp()
          },
          okText: 'Restart',
          cancelText: 'Later'
        })
      })
    }
  }, [info])
  
  // Show loading spinner while initializing auth
  if (!isInitialized || loading) {
    return (
      <LoadingSpinner 
        message="Verifying Session..." 
        style={{ minHeight: '100vh', background: theme.background }}
      />
    )
  }

  if (!isOnline) {
    return <NetworkError />
  }
  
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: theme.gradient || theme.background }}>
        {children}
      </div>
    )
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', flexDirection: 'column', background: theme.gradient || theme.background }}>
        <Header />
        <Layout hasSider style={{ flex: 1, overflow: 'hidden', background: 'transparent' }}>
          <Sidebar />
          <Content 
            className="layout-content-collapsed"
            style={{ 
              background: 'transparent', 
              overflowY: 'auto',
            flex: 1,
            position: 'relative',
            padding: '20px'
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ThemeProvider>
            <Router>
              <MessageToastProvider>
                <AppLayout>
                  <Routes>
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/connection" 
                  element={
                    <ProtectedRoute>
                      <Connection />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/templates" 
                  element={
                    <ProtectedRoute>
                      <Templates />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/add-template" 
                  element={
                    <ProtectedRoute>
                      <AddTemplate />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/campaign" 
                  element={
                    <ProtectedRoute>
                      <Campaign />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/received-messages" 
                  element={
                    <ProtectedRoute>
                      <ReceivedMessages />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/messaging" 
                  element={
                    <ProtectedRoute>
                      <Messaging />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard/campaign/final/:id" 
                  element={
                    <ProtectedRoute>
                      <CampaignFinal />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </AppLayout>
            </MessageToastProvider>
            </Router>
          </ThemeProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
