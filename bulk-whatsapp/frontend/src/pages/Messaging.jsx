import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { 
  Card, 
  Input, 
  Select, 
  Table, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Pagination, 
  Badge, 
  Tag, 
  Spin, 
  Empty, 
  message,
  Statistic,
  Tooltip,
  Modal,
  Popconfirm,
  Alert
} from 'antd'
import {
  PlusOutlined,
  MessageOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import StyledButton from '../components/common/StyledButton'
import { useToast } from '../context/ToastContext'
import api from '../services/api'
import {
  listCampaigns,
  deleteCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
} from '../services/localCampaign'

const { Title, Text } = Typography
const { Option } = Select

const MessagingPage = memo(function MessagingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { token, logout, user } = useAuth()

  // State management
  const [campaigns, setCampaigns] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDeleting, setIsDeleting] = useState({})
  const [isControlling, setIsControlling] = useState({})
  
  const campaignsPerPage = 10

  // Socket connection for real-time updates
  const { on, off, isConnected } = useSocket({
    token,
    onConnect: () => console.log('🔗 Messaging socket connected'),
    onDisconnect: () => console.log('🔌 Messaging socket disconnected'),
    onError: (error) => console.error('❌ Messaging socket error:', error)
  })

  // Memoized campaign statistics
  const campaignStats = useMemo(() => ({
    total: campaigns.length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    failed: campaigns.filter(c => c.status === 'failed').length,
    processing: campaigns.filter(c => c.status === 'processing').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    stopped: campaigns.filter(c => c.status === 'stop' || c.status === 'stopped').length
  }), [campaigns])

  // Handle unauthorized access
  const handleUnauthorized = useCallback(() => {
    toast.error('Session expired. Please log in again.')
    logout()
    navigate('/login')
  }, [navigate, logout])

  // Fetch campaigns data
  const fetchCampaigns = useCallback(async (showLoader = true) => {
    if (!token) {
      handleUnauthorized()
      return
    }

    showLoader && setIsLoading(true)
    setIsRefreshing(!showLoader)

    try {
      const response = await listCampaigns(user, {
        page: currentPage - 1,
        limit: campaignsPerPage,
        search: searchValue,
        status: statusFilter === 'all' ? undefined : statusFilter
      })

      if (response.status) {
        const mappedCampaigns = response.messages?.map(msg => ({
          _id: msg._id,
          name: msg.name,
          template: {
            _id: msg.templateId && typeof msg.templateId === 'object' ? msg.templateId._id : msg.templateId,
            name: msg.templateId && typeof msg.templateId === 'object' ? msg.templateId.name : 'Loading...',
            messageType: msg.templateId && typeof msg.templateId === 'object' ? msg.templateId.messageType : 'Text'
          },
          instanceCount: (msg.instanceIds || []).length,
          recipients: msg.recipients || [],
          status: msg.status,
          statistics: {
            total: msg.statistics?.total || msg.recipients?.length || 0,
            sent: msg.statistics?.sent || 0,
            failed: msg.statistics?.failed || 0,
            notExist: msg.statistics?.notExist || 0,
            instanceDisconnected: msg.statistics?.instanceDisconnected || 0
          },
          createdAt: msg.createdAt,
          delayRange: msg.delayRange || { start: 3, end: 5 }
        })) || []

        setCampaigns(mappedCampaigns)
        setTotalCampaigns(response.total || mappedCampaigns.length)
      } else {
        toast.error(response.message || 'Failed to fetch campaigns')
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        toast.error('Failed to load campaigns')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token, user, currentPage, campaignsPerPage, searchValue, statusFilter, handleUnauthorized])

  // Initial data fetch
  useEffect(() => {
    token && fetchCampaigns()
  }, [token, fetchCampaigns])

  // Real-time campaign updates via socket with improved status handling
  useEffect(() => {
    if (!isConnected) return

    const handleCampaignUpdate = (data) => {
      console.log('📊 Real-time campaign update received:', data)
      
      setCampaigns(prev => prev.map(campaign => {
        if (campaign._id === data.campaignId) {
          // Ensure we don't override with invalid status
          const newStatus = data.status || campaign.status
          
          // Validate status transition
          const validStatuses = ['pending', 'processing', 'paused', 'completed', 'failed', 'stop', 'stopped']
          const finalStatus = validStatuses.includes(newStatus) ? newStatus : campaign.status
          
          console.log(`🔄 Campaign ${campaign._id} status: ${campaign.status} → ${finalStatus}`)
          
          return { 
            ...campaign, 
            status: finalStatus,
            statistics: {
              ...campaign.statistics,
              sent: data.sent !== undefined ? data.sent : campaign.statistics.sent,
              failed: data.failed !== undefined ? data.failed : campaign.statistics.failed,
              notExist: data.notExist !== undefined ? data.notExist : campaign.statistics.notExist,
              instanceDisconnected: data.instanceDisconnected !== undefined ? data.instanceDisconnected : campaign.statistics.instanceDisconnected
            }
          }
        }
        return campaign
      }))
    }

    const handleCampaignProgress = (data) => {
      console.log('📈 Real-time progress update:', data)
      handleCampaignUpdate({ ...data, status: 'processing' })
    }

    const handleCampaignComplete = (data) => {
      console.log('✅ Campaign completed:', data)
      handleCampaignUpdate({ ...data, status: 'completed' })
      toast.success(`Campaign "${data.campaignName || 'Unknown'}" completed!`)
    }

    const handleCampaignPaused = (data) => {
      console.log('⏸️ Campaign paused:', data)
      handleCampaignUpdate({ ...data, status: 'paused' })
      toast.info(`Campaign paused`)
    }

    const handleCampaignResumed = (data) => {
      console.log('▶️ Campaign resumed:', data)
      handleCampaignUpdate({ ...data, status: 'processing' })
      toast.success(`Campaign resumed`)
    }

    const handleCampaignStopped = (data) => {
      console.log('🛑 Campaign stopped:', data)
      handleCampaignUpdate({ ...data, status: 'stopped' })
      toast.warning(`Campaign stopped`)
    }

    // Socket event listeners
    on('campaign.progress', handleCampaignProgress)
    on('campaign.update', handleCampaignUpdate)
    on('campaign.complete', handleCampaignComplete)
    on('campaign.paused', handleCampaignPaused)
    on('campaign.resumed', handleCampaignResumed)
    on('campaign.stopped', handleCampaignStopped)

    return () => {
      off('campaign.progress', handleCampaignProgress)
      off('campaign.update', handleCampaignUpdate)
      off('campaign.complete', handleCampaignComplete)
      off('campaign.paused', handleCampaignPaused)
      off('campaign.resumed', handleCampaignResumed)
      off('campaign.stopped', handleCampaignStopped)
    }
  }, [isConnected, on, off])

  // Auto-refresh for processing campaigns with improved logic
  useEffect(() => {
    const hasProcessingCampaigns = campaigns.some(c => c.status === 'processing')
    
    if (!hasProcessingCampaigns) return

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing campaigns due to processing status')
      fetchCampaigns(false)
    }, 10000) // Reduced to 10 seconds for better real-time feel

    return () => clearInterval(interval)
  }, [campaigns, fetchCampaigns])

  // Campaign operations with real-time Popconfirm
  const handleDeleteCampaign = useCallback(async (campaignId, campaignName) => {
    setIsDeleting(prev => ({ ...prev, [campaignId]: true }))
    
    try {
      const response = await deleteCampaign(user, campaignId)
      
      if (response.status) {
        setCampaigns(prev => prev.filter(c => c._id !== campaignId))
        setTotalCampaigns(prev => prev - 1)
        toast.success('Campaign Deleted Successfully!')
      } else {
        toast.error(response.message || 'Failed to delete campaign')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        toast.error('Failed to delete campaign')
      }
    } finally {
      setIsDeleting(prev => ({ ...prev, [campaignId]: false }))
    }
  }, [user, handleUnauthorized])

  // Campaign control operations with real-time Popconfirm
  const handlePauseCampaign = useCallback(async (campaignId, campaignName) => {
    setIsControlling(prev => ({ ...prev, [campaignId]: true }))
    
    try {
      const response = await pauseCampaign(user, campaignId)
      
      if (response.status) {
        setCampaigns(prev => prev.map(campaign => 
          campaign._id === campaignId 
            ? { ...campaign, status: 'paused' }
            : campaign
        ))
        toast.success('Campaign Paused Successfully!')
      } else {
        toast.error(response.message || 'Failed to pause campaign')
      }
    } catch (error) {
      console.error('Error pausing campaign:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        toast.error('Failed to pause campaign')
      }
    } finally {
      setIsControlling(prev => ({ ...prev, [campaignId]: false }))
    }
  }, [user, handleUnauthorized])

  const handleResumeCampaign = useCallback(async (campaignId, campaignName) => {
    setIsControlling(prev => ({ ...prev, [campaignId]: true }))
    
    try {
      const response = await resumeCampaign(user, campaignId)
      
      if (response.status) {
        setCampaigns(prev => prev.map(campaign => 
          campaign._id === campaignId 
            ? { ...campaign, status: 'processing' }
            : campaign
        ))
        toast.success('Campaign Resumed Successfully!')
      } else {
        toast.error(response.message || 'Failed to resume campaign')
      }
    } catch (error) {
      console.error('Error resuming campaign:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        toast.error('Failed to resume campaign')
      }
    } finally {
      setIsControlling(prev => ({ ...prev, [campaignId]: false }))
    }
  }, [user, handleUnauthorized])

  const handleStopCampaign = useCallback(async (campaignId, campaignName) => {
    setIsControlling(prev => ({ ...prev, [campaignId]: true }))
    
    try {
      const response = await stopCampaign(user, campaignId)
      
      if (response.status) {
        setCampaigns(prev => prev.map(campaign => 
          campaign._id === campaignId 
            ? { ...campaign, status: 'stopped' }
            : campaign
        ))
        toast.success('Campaign Stopped Successfully!')
      } else {
        toast.error(response.message || 'Failed to stop campaign')
      }
    } catch (error) {
      console.error('Error stopping campaign:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        toast.error('Failed to stop campaign')
      }
    } finally {
      setIsControlling(prev => ({ ...prev, [campaignId]: false }))
    }
  }, [campaigns, handleUnauthorized])

  const handleViewCampaign = useCallback((campaignId) => {
    navigate(`/dashboard/campaign/final/${campaignId}`)
  }, [navigate])

  const handleRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered')
    fetchCampaigns(false)
  }, [fetchCampaigns])

  // Status configuration with improved status handling
  const getStatusConfig = useCallback((status) => {
    const configs = {
      completed: { color: 'success', text: 'Completed', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: 'Failed', icon: <CloseCircleOutlined /> },
      processing: { color: 'processing', text: 'Processing', icon: <SyncOutlined spin /> },
      paused: { color: 'warning', text: 'Paused', icon: <PauseCircleOutlined /> },
      stop: { color: 'error', text: 'Stopped', icon: <StopOutlined /> },
      stopped: { color: 'error', text: 'Stopped', icon: <StopOutlined /> },
      pending: { color: 'default', text: 'Pending', icon: <MessageOutlined /> }
    }
    return configs[status] || configs.pending
  }, [])

  // Table columns with improved action buttons
  const columns = useMemo(() => [
    {
      title: 'Campaign Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong style={{ color: '#ffffff' }}>{text}</Text>
          <br />
          <Text style={{ color: '#888888', fontSize: '12px' }}>
            {new Date(record.createdAt).toLocaleDateString()}
          </Text>
        </div>
      )
    },
    {
      title: 'Template',
      dataIndex: ['template', 'name'],
      key: 'template',
      render: (text, record) => (
        <div>
          <Text style={{ color: '#ffffff' }}>{text}</Text>
          <br />
          <Tag color="blue" size="small">
            {record.template.messageType || 'Text'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Recipients',
      key: 'recipients',
      render: (_, record) => (
        <div>
          <Text style={{ color: '#ffffff' }}>
            {record.statistics.total}
          </Text>
          <br />
          <Text style={{ color: '#888888', fontSize: '12px' }}>
            {record.instanceCount} instances
          </Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = getStatusConfig(status)
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {/* Pause/Resume Button - Toggle between pause and resume */}
          {record.status === 'processing' ? (
            <Tooltip title="Pause Campaign">
              <StyledButton
                variant="secondary"
                size="small"
                icon={<PauseCircleOutlined />}
                loading={isControlling[record._id]}
                onClick={() => handlePauseCampaign(record._id, record.name)}
              />
            </Tooltip>
          ) : record.status === 'paused' ? (
            <Tooltip title="Resume Campaign">
              <StyledButton
                variant="success"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={isControlling[record._id]}
                onClick={() => handleResumeCampaign(record._id, record.name)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Campaign not active">
              <StyledButton
                variant="secondary"
                size="small"
                icon={<PauseCircleOutlined />}
                disabled={true}
              />
            </Tooltip>
          )}

          {/* Stop Button - Only for processing/paused campaigns with real-time Popconfirm */}
          <Popconfirm
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StopOutlined style={{ color: '#ff4d4f' }} />
                <span style={{ color: '#ffffff', fontWeight: '600' }}>Stop Campaign</span>
              </div>
            }
            description={
              <div style={{ maxWidth: '280px' }}>
                <div style={{ color: '#888888', marginBottom: '8px' }}>
                  Are you sure you want to stop "{record.name}"?
                </div>
                <Alert
                  message="This action cannot be undone and the campaign cannot be resumed."
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{
                    background: '#3a2f0f',
                    border: '1px solid #faad14',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
              </div>
            }
            onConfirm={() => handleStopCampaign(record._id, record.name)}
            okText="Yes, Stop"
            cancelText="Cancel"
            disabled={record.status !== 'processing' && record.status !== 'paused'}
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
            placement="topRight"
          >
            <Tooltip title={
              record.status === 'processing' || record.status === 'paused' 
                ? 'Stop Campaign' 
                : 'Campaign already stopped/completed'
            }>
              <StyledButton
                variant="danger"
                size="small"
                icon={<StopOutlined />}
                loading={isControlling[record._id]}
                disabled={record.status !== 'processing' && record.status !== 'paused'}
              />
            </Tooltip>
          </Popconfirm>
          
          {/* View Button - Always available */}
          <Tooltip title="View Details">
            <StyledButton
              variant="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewCampaign(record._id)}
            />
          </Tooltip>
          
          {/* Delete Button - Always available with real-time Popconfirm */}
          <Popconfirm
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DeleteOutlined style={{ color: '#ff4d4f' }} />
                <span style={{ color: '#ffffff', fontWeight: '600' }}>Delete Campaign</span>
              </div>
            }
            description={
              <div style={{ maxWidth: '280px' }}>
                <div style={{ color: '#888888', marginBottom: '8px' }}>
                  Are you sure you want to delete "{record.name}"?
                </div>
                {(record.status === 'processing' || record.status === 'paused') && (
                  <Alert
                    message={`This campaign is currently ${record.status}. Deleting will stop it permanently.`}
                    type="error"
                    showIcon
                    style={{
                      background: '#3a0f0f',
                      border: '1px solid #ff4d4f',
                      borderRadius: '6px',
                      fontSize: '12px',
                      marginBottom: '8px'
                    }}
                  />
                )}
                <div style={{ color: '#666666', fontSize: '12px' }}>
                  This action cannot be undone.
                </div>
              </div>
            }
            onConfirm={() => handleDeleteCampaign(record._id, record.name)}
            okText="Yes, Delete"
            cancelText="Cancel"
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
            placement="topLeft"
          >
            <StyledButton
              variant="danger"
              size="small"
              icon={<DeleteOutlined />}
              loading={isDeleting[record._id]}
            />
          </Popconfirm>
        </Space>
      )
    }
  ], [getStatusConfig, handleViewCampaign, handleDeleteCampaign, handlePauseCampaign, handleResumeCampaign, handleStopCampaign, isDeleting, isControlling])

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesSearch = !searchValue || 
        campaign.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        (campaign.template.name && campaign.template.name.toLowerCase().includes(searchValue.toLowerCase()))
      
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [campaigns, searchValue, statusFilter])

  // Pagination
  const totalPages = Math.ceil(totalCampaigns / campaignsPerPage)

  if (isLoading) {
    return (
      <LoadingSpinner 
        message="Loading campaigns..." 
        style={{ minHeight: '100vh', background: 'transparent' }}
      />
    )
  }

  return (
    <div>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px' 
        }}>
          <div>
            <Title level={2} style={{ color: '#ffffff', margin: 0 }}>
              Messaging Campaigns
              {isConnected && (
                <Badge 
                  status="success" 
                  text={
                    <span style={{ color: '#52c41a', marginLeft: '8px' }}>
                      Real-time Connected
                    </span>
                  }
                />
              )}
            </Title>
            <Text style={{ color: '#888888' }}>
              Manage your WhatsApp messaging campaigns with real-time updates
            </Text>
          </div>
          <Space>
            <StyledButton
              variant="secondary"
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              Refresh
            </StyledButton>
            <StyledButton
              variant="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/campaign')}
            >
              Create Campaign
            </StyledButton>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: '#122033', border: '1px solid #1a2a3d' }}>
              <Statistic
                title={<span style={{ color: '#888888' }}>Total Campaigns</span>}
                value={campaignStats.total}
                valueStyle={{ color: '#0095FF', fontSize: '28px', fontWeight: 'bold' }}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: '#122033', border: '1px solid #1a2a3d' }}>
              <Statistic
                title={<span style={{ color: '#888888' }}>Completed</span>}
                value={campaignStats.completed}
                valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: '#122033', border: '1px solid #1a2a3d' }}>
              <Statistic
                title={<span style={{ color: '#888888' }}>Processing</span>}
                value={campaignStats.processing}
                valueStyle={{ color: '#8b7cf6', fontSize: '28px', fontWeight: 'bold' }}
                prefix={<SyncOutlined spin={campaignStats.processing > 0} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: '#122033', border: '1px solid #1a2a3d' }}>
              <Statistic
                title={<span style={{ color: '#888888' }}>Failed</span>}
                value={campaignStats.failed}
                valueStyle={{ color: '#ff4d4f', fontSize: '28px', fontWeight: 'bold' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card
          style={{
            background: '#0a1524',
            border: '1px solid #1a2a3d',
            borderRadius: '8px',
            marginBottom: '24px'
          }}
          bodyStyle={{ padding: '20px' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Input
                placeholder="Search campaigns..."
                prefix={<SearchOutlined style={{ color: '#888888' }} />}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                style={{
                  background: '#122033',
                  borderColor: '#1a2a3d',
                  color: '#ffffff'
                }}
                size="large"
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                size="large"
                dropdownStyle={{
                  background: '#122033',
                  border: '1px solid #1a2a3d'
                }}
              >
                <Option value="all">All Status</Option>
                <Option value="completed">Completed</Option>
                <Option value="processing">Processing</Option>
                <Option value="paused">Paused</Option>
                <Option value="failed">Failed</Option>
                <Option value="stopped">Stopped</Option>
              </Select>
            </Col>
            <Col xs={24} md={4}>
              <StyledButton
                variant="secondary"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                style={{ width: '100%' }}
                size="large"
              >
                Refresh
              </StyledButton>
            </Col>
          </Row>
        </Card>

        {/* Campaigns Table */}
        <Card
          style={{
            background: '#0a1524',
            border: '1px solid #1a2a3d',
            borderRadius: '8px'
          }}
          bodyStyle={{ padding: '24px' }}
        >
          {filteredCampaigns.length === 0 ? (
            <Empty
              image={<MessageOutlined style={{ fontSize: '64px', color: '#666666' }} />}
              description={
                <div>
                  <Title level={4} style={{ color: '#ffffff' }}>No Campaigns Found</Title>
                  <Text style={{ color: '#888888' }}>
                    {searchValue || statusFilter !== 'all' 
                      ? 'No campaigns match your current filters.' 
                      : 'Create your first campaign to get started.'
                    }
                  </Text>
                </div>
              }
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              {!searchValue && statusFilter === 'all' && (
                <StyledButton
                  variant="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/campaign')}
                >
                  Create Campaign
                </StyledButton>
              )}
            </Empty>
          ) : (
            <>
              <Table
                columns={columns}
                dataSource={filteredCampaigns}
                rowKey="_id"
                pagination={false}
                style={{
                  background: '#0a1524'
                }}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid #1a2a3d'
                }}>
                  <Text style={{ color: '#888888' }}>
                    Showing {(currentPage - 1) * campaignsPerPage + 1}-{Math.min(currentPage * campaignsPerPage, totalCampaigns)} of {totalCampaigns} campaigns
                  </Text>
                  <Pagination
                    current={currentPage}
                    total={totalCampaigns}
                    pageSize={campaignsPerPage}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                    style={{ color: '#ffffff' }}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
})

export default MessagingPage