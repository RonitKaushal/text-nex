import React from 'react'
import { Typography, Button } from 'antd'
import { WifiOutlined } from '@ant-design/icons'
import { useTheme } from '../context/ThemeContext'

const { Title, Text } = Typography

const NetworkError = () => {
  const { theme } = useTheme()

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.background,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        background: theme.componentBackground,
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <WifiOutlined style={{ fontSize: '64px', color: '#ff4d4f', marginBottom: '24px' }} />
        
        <Title level={3} style={{ color: theme.text, marginBottom: '16px' }}>
          No Internet Connection
        </Title>
        
        <Text style={{ color: theme.subText, display: 'block', marginBottom: '32px' }}>
          Please check your network connection and try again. We can't reach the server right now.
        </Text>

        <Button 
          type="primary" 
          size="large" 
          onClick={handleRetry}
          style={{ 
            background: '#8b7cf6', 
            borderRadius: '8px',
            height: '44px',
            padding: '0 32px'
          }}
        >
          Try Again
        </Button>
      </div>
    </div>
  )
}

export default NetworkError
