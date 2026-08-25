import React from 'react'
import { Table, Space, Typography, Tag, Popconfirm } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons'
import StyledButton from '../common/StyledButton'

const { Text } = Typography

const TemplateTable = ({
  templates,
  isDeleting,
  currentPage,
  totalPages,
  templatesPerPage,
  totalTemplates,
  onEdit,
  onDelete,
  onPreview,
  onNextPage,
  onPrevPage,
  setCurrentPage
}) => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text) => (
        <Text strong style={{ color: '#ffffff' }}>
          {text}
        </Text>
      )
    },
    {
      title: 'Message Type',
      dataIndex: 'messageType',
      key: 'messageType',
      width: '20%',
      render: (type) => (
        <Tag color={type === 'Text' ? 'blue' : type === 'Buttons' ? 'green' : 'orange'}>
          {type}
        </Tag>
      )
    },
    {
      title: 'Message',
      key: 'message',
      width: '35%',
      render: (_, record) => (
        <Text style={{ color: '#888888' }}>
          {record.template.message?.substring(0, 50)}
          {record.template.message?.length > 50 ? '...' : ''}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_, record) => (
        <Space size="small">
          <StyledButton
            variant="ghost"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onPreview(record)}
          >
            Preview
          </StyledButton>
          <StyledButton
            variant="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            Edit
          </StyledButton>
          <Popconfirm
            title="Delete Template"
            description="Are you sure you want to delete this template?"
            onConfirm={() => onDelete(record._id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ 
              style: { 
                background: '#ff4d4f', 
                borderColor: '#ff4d4f',
                color: '#ffffff'
              } 
            }}
            cancelButtonProps={{
              style: {
                background: '#122033',
                borderColor: '#1a2a3d',
                color: '#ffffff'
              }
            }}
          >
            <StyledButton
              variant="danger"
              size="small"
              icon={<DeleteOutlined />}
              loading={isDeleting[record._id]}
            >
              Delete
            </StyledButton>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Table
      columns={columns}
      dataSource={templates}
      rowKey="_id"
      pagination={{
        current: currentPage,
        total: totalTemplates,
        pageSize: templatesPerPage,
        showSizeChanger: false,
        showQuickJumper: true,
        showTotal: (total, range) => 
          `${range[0]}-${range[1]} of ${total} templates`,
        style: { color: '#ffffff' },
        onChange: setCurrentPage
      }}
      style={{
        background: '#0a1524',
        border: '1px solid #1a2a3d',
        borderRadius: '8px'
      }}
    />
  )
}

export default TemplateTable