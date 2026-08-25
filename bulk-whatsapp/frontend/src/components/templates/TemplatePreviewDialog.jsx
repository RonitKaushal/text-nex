import React from 'react'
import { Modal, Typography, Tag, Card } from 'antd'

const { Text, Title } = Typography

const TemplatePreviewDialog = ({
  open,
  onOpenChange,
  template,
  previewContent,
  previewButtons
}) => {
  if (!template) return null

  return (
    <Modal
      title={<span style={{ color: '#ffffff' }}>Template Preview</span>}
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      width={500}
      centered
      styles={{
        header: {
          backgroundColor: 'transparent',
          borderBottom: 'none',
          padding: '20px 24px 0'
        },
        content: {
          background: '#0a1524',
          border: '1px solid #1a2a3d',
          borderRadius: '12px'
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)'
        }
      }}
    >
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{
          background: '#122033',
          border: '1px solid #1a2a3d',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <Text strong style={{ color: '#ffffff', display: 'block', marginBottom: '8px' }}>
            {template.name}
          </Text>
          <Tag color={template.messageType === 'Text' ? 'blue' : 'green'}>
            {template.messageType}
          </Tag>
        </div>

        <div style={{
          background: '#25D366',
          borderRadius: '12px 12px 12px 4px',
          padding: '12px',
          color: '#ffffff',
          maxWidth: '80%',
          marginLeft: 'auto',
          marginBottom: '16px'
        }}>
          {template.template.header && (
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              {template.template.header}
            </div>
          )}
          <div style={{ marginBottom: '8px' }}>
            {template.template.message}
          </div>
          {template.template.footer && (
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {template.template.footer}
            </div>
          )}
          {template.template.button?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              {template.template.button.map((btn, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '4px',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}
                >
                  {btn.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default TemplatePreviewDialog