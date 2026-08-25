import React, { createContext, useContext, useState, useCallback } from 'react'
import ToastNotification from '../components/common/ToastNotification'

const ToastContext = createContext()

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      message,
      type,
      duration,
      visible: true
    }

    setToasts(prev => [...prev, newToast])

    // Auto remove after duration + animation time
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, duration + 500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, visible: false } : toast
    ))
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 300)
  }, [])

  const success = useCallback((message, duration) => {
    showToast(message, 'success', duration)
  }, [showToast])

  const error = useCallback((message, duration) => {
    showToast(message, 'error', duration)
  }, [showToast])

  const warning = useCallback((message, duration) => {
    showToast(message, 'warning', duration)
  }, [showToast])

  const info = useCallback((message, duration) => {
    showToast(message, 'info', duration)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ 
      showToast, 
      success, 
      error, 
      warning, 
      info 
    }}>
      {children}
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          visible={toast.visible}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}