import React from 'react';
import Toast from './Toast';
import './Toast.css';

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          title={toast.title}
          message={toast.message}
          imageUrl={toast.imageUrl}
          onClose={removeToast}
          duration={toast.duration}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
