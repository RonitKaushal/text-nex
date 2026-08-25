import React from 'react'
import { Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import StyledButton from '../common/StyledButton'

const { Title, Text } = Typography

const TemplateHeader = ({ isLoading, onCreateTemplate }) => {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: '#ffffff', margin: 0 }}>
            Message Templates
          </Title>
          <Text style={{ color: '#888888' }}>
            Create and manage your message templates
          </Text>
        </div>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={onCreateTemplate}
          disabled={isLoading}
        >
          Add Template
        </StyledButton>
      </div>
    </div>
  )
}

export default TemplateHeader