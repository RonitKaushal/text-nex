import React from 'react'
import { Spin, Typography } from 'antd'
import AppBrand from './AppBrand'

const { Text } = Typography

const LoadingSpinner = ({
  message = 'Loading...',
  size = 'large',
  height = '400px',
  showLogo = true,
  style = {},
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height,
        flexDirection: 'column',
        ...style,
      }}
    >
      {showLogo && (
        <div style={{ marginBottom: '24px' }}>
          <AppBrand iconSize={40} centered />
        </div>
      )}
      <Spin size={size} />
      <Text style={{ color: '#888888', marginTop: '16px' }}>{message}</Text>
    </div>
  )
}

export default LoadingSpinner
