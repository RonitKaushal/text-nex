import React, { useState, useEffect, useCallback } from 'react'
import { 
  Input, 
  Badge, 
  Checkbox, 
  Table, 
  Typography,
  Space,
  Pagination
} from 'antd'
import { SearchOutlined, PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import StyledButton from '../common/StyledButton'
import { useAuth } from '../../context/AuthContext'
import { listTemplates } from '../../services/localTemplate'

const { Title, Text } = Typography

const ChooseTemplate = ({
  selectedTemplate,
  setSelectedTemplate,
  templates: initialTemplates
}) => {
  const [templates, setTemplates] = useState(initialTemplates)
  const [templateSearchValue, setTemplateSearchValue] = useState('')
  const [templateCurrentPage, setTemplateCurrentPage] = useState(1)
  const [templatesPerPage] = useState(5)
  const [totalTemplates, setTotalTemplates] = useState(0)
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const handleUnauthorized = () => {
    logout()
    navigate('/login')
  }

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await listTemplates(user, { 
        page: templateCurrentPage - 1, 
        limit: templatesPerPage,
        search: templateSearchValue 
      })
      
      if (response.status) {
        setTemplates(response.templates || [])
        setTotalTemplates(response.total || 0)
      }
    } catch (err) {
      console.error('Error fetching templates:', err)
      if (err.response?.status === 401) {
        handleUnauthorized()
      }
    }
  }, [templateCurrentPage, templateSearchValue, templatesPerPage, navigate])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const columns = [
    {
      title: 'SN',
      key: 'sn',
      width: 60,
      render: (_, __, index) => (
        <Text style={{ color: '#ffffff' }}>
          {(templateCurrentPage - 1) * templatesPerPage + index + 1}
        </Text>
      )
    },
    {
      title: 'Template',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Text style={{ color: '#ffffff' }}>{text}</Text>
      )
    },
    {
      title: 'Template Type',
      dataIndex: 'messageType',
      key: 'messageType',
      render: (type) => (
        <Badge 
          color={type === 'Text' ? 'blue' : type === 'Buttons' ? 'green' : 'orange'}
          text={<span style={{ color: '#ffffff' }}>{type}</span>}
        />
      )
    },
    {
      title: 'Created At',
      key: 'createdAt',
      render: () => (
        <Text style={{ color: '#888888' }}>
          {new Date().toLocaleDateString()}
        </Text>
      )
    },
    {
      title: 'Select',
      key: 'select',
      render: (_, record) => (
        <Checkbox
          checked={selectedTemplate === record._id}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedTemplate(record._id)
            } else {
              setSelectedTemplate('')
            }
          }}
        />
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <Title level={3} style={{ color: '#ffffff', margin: 0, marginBottom: '8px' }}>
          Choose Template
        </Title>
        <Text style={{ color: '#888888' }}>
          Choose from a list of pre-approved templates or create a new template to make your campaigns live on the go.
        </Text>
      </div>

      {/* Search and Create Template */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <Input
            placeholder="Search templates..."
            prefix={<SearchOutlined style={{ color: '#888888' }} />}
            value={templateSearchValue}
            onChange={(e) => setTemplateSearchValue(e.target.value)}
            style={{
              background: '#122033',
              borderColor: '#1a2a3d',
              color: '#ffffff'
            }}
            size="large"
          />
        </div>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/templates')}
          size="large"
        >
          Create A New Template
        </StyledButton>
      </div>

      {/* Templates Table */}
      <div style={{ 
        border: '1px solid #1a2a3d', 
        borderRadius: '8px', 
        overflow: 'hidden',
        background: '#0a1524'
      }}>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="_id"
          pagination={false}
        />
      </div>

      {/* Template Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <StyledButton
            variant="secondary"
            icon={<LeftOutlined />}
            onClick={() => setTemplateCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={templateCurrentPage === 1}
            size="small"
          />
          <Text style={{ color: '#888888' }}>
            {templateCurrentPage}
          </Text>
          <StyledButton
            variant="secondary"
            icon={<RightOutlined />}
            onClick={() => setTemplateCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalTemplates / templatesPerPage)))}
            disabled={templateCurrentPage === Math.ceil(totalTemplates / templatesPerPage)}
            size="small"
          />
        </Space>
        
        <Text style={{ color: '#888888', fontSize: '14px' }}>
          Total: {totalTemplates} templates
        </Text>
      </div>
    </div>
  )
}

export default ChooseTemplate