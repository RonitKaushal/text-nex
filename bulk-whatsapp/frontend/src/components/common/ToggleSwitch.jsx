import React from 'react'
import { Switch } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'

const ToggleSwitch = ({
  checked,
  onChange,
  checkedChildren = "ON",
  unCheckedChildren = "OFF",
  size = "default",
  disabled = false,
  loading = false,
  style = {},
  className = ""
}) => {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      checkedChildren={
        <span style={{ display: 'flex', alignItems: 'center', fontSize: size === 'small' ? '10px' : '12px' }}>
          <CheckOutlined />
        </span>
      }
      unCheckedChildren={
        <span style={{ display: 'flex', alignItems: 'center', fontSize: size === 'small' ? '10px' : '12px' }}>
          <CloseOutlined />
        </span>
      }
      size={size}
      disabled={disabled}
      loading={loading}
      style={{
        backgroundColor: checked ? '#8b7cf6' : '#404040',
        ...style
      }}
      className={className}
    />
  )
}

export default ToggleSwitch