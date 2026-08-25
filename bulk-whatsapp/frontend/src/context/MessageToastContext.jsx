import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/common/toast/ToastContainer';

const MessageToastContext = createContext();

export const useMessageToast = () => {
  const context = useContext(MessageToastContext);
  if (!context) {
    throw new Error('useMessageToast must be used within a MessageToastProvider');
  }
  return context;
};

export const MessageToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((title, message, imageUrl = null, duration = 5000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      title,
      message,
      imageUrl,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <MessageToastContext.Provider value={{ notify }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </MessageToastContext.Provider>
  );
};
