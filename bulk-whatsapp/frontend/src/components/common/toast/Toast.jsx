import React, { useState, useEffect, useCallback } from 'react';
import { InfoCircleFilled, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Toast.css';

const Toast = ({ 
  id, 
  title, 
  message,
  imageUrl, 
  onClose, 
  duration = 5000,
  onClick 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  const handleClose = useCallback((e) => {
    e?.stopPropagation();
    setIsExiting(true);
    // Wait for animation to finish before removing from DOM
    setTimeout(() => {
      onClose(id);
    }, 300);
  }, [id, onClose]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: navigate to received messages
      navigate('/received-messages');
    }
  };

  useEffect(() => {
    if (!duration || isPaused) return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, isPaused, handleClose]);

  return (
    <div 
      className={`toast-card ${isExiting ? 'exiting' : ''}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
      role="alert"
    >
      {imageUrl ? (
         <img src={imageUrl} alt="" className="toast-image" />
      ) : (
        <div className="toast-icon">
          <InfoCircleFilled />
        </div>
      )}
      
      <div className="toast-content">
        <div className="toast-header">
          <span className="toast-title">{title}</span>
        </div>
        <div className="toast-message">
          {message}
        </div>
      </div>

      <div 
        className="toast-close" 
        onClick={handleClose}
        aria-label="Close notification"
      >
        <CloseOutlined style={{ fontSize: '12px' }} />
      </div>
    </div>
  );
};

export default Toast;
