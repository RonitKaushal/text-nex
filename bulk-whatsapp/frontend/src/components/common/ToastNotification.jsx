import React, { useState, useEffect } from 'react'
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'

const ToastNotification = ({ 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose,
  visible = false 
}) => {
  const [isVisible, setIsVisible] = useState(visible)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (visible) {
      setIsVisible(true)
      setIsAnimating(true)
      
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [visible, duration])

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose && onClose()
    }, 300)
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: '20px' }} />
      case 'info':
        return <InfoCircleOutlined style={{ color: '#8b7cf6', fontSize: '20px' }} />
      default:
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#0f3a2e'
      case 'error':
        return '#3a0f0f'
      case 'warning':
        return '#3a2f0f'
      case 'info':
        return '#0f1f3a'
      default:
        return '#0f3a2e'
    }
  }

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#52c41a'
      case 'error':
        return '#ff4d4f'
      case 'warning':
        return '#faad14'
      case 'info':
        return '#8b7cf6'
      default:
        return '#52c41a'
    }
  }

  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: `translate(-50%, ${isAnimating ? '0' : '-20px'}) scale(${isAnimating ? 1 : 0.9})`,
        zIndex: 9999,
        background: getBackgroundColor(),
        border: `1px solid ${getBorderColor()}`,
        borderRadius: '12px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        minWidth: '300px',
        maxWidth: '500px',
        opacity: isAnimating ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onClick={handleClose}
    >
      {getIcon()}
      <span style={{ 
        color: '#ffffff', 
        fontSize: '16px', 
        fontWeight: '500',
        flex: 1,
        top: 0
      }}>
        {message}
      </span>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          background: getBorderColor(),
          borderRadius: '0 0 12px 12px',
          animation: `shrink ${duration}ms linear`,
          transformOrigin: 'left'
        }}
      />
      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}

export default ToastNotification