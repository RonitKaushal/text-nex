import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Table,
    Button,
    Card,
    Statistic,
    Space,
    Tag,
    Pagination,
    Typography,
    Row,
    Col,
    Alert,
    Spin,
    Badge,
    message,
    Progress
} from 'antd'
import {
    LoadingOutlined,
    UserOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    WifiOutlined,
    DisconnectOutlined,
    StopOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    LeftOutlined,
    DownloadOutlined,
    SendOutlined,
    ClockCircleOutlined,
    SyncOutlined
} from '@ant-design/icons'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import StyledButton from '../components/common/StyledButton'
import { useToast } from '../context/ToastContext'
import { getAllInstances } from '../services/instanceStorage'
import {
  fetchCampaignById,
  sendCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
} from '../services/localCampaign'

const { Title, Text } = Typography

const CampaignFinal = () => {
    const navigate = useNavigate()
    const toast = useToast()
    const { id: campaignId } = useParams()
    const { user, token, logout } = useAuth()

    // Campaign data states
    const [campaign, setCampaign] = useState(null)
    const [recipientStatuses, setRecipientStatuses] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false)

    // Campaign control states
    const [isProcessing, setIsProcessing] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [isStopped, setIsStopped] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [controlStates, setControlStates] = useState({
        isPausing: false,
        isResuming: false,
        isStopping: false
    })

    // Real-time progress states
    const [liveProgress, setLiveProgress] = useState({
        processed: 0,
        progressPercentage: 0,
        estimatedTimeRemaining: 0,
        lastRecipient: '',
        lastRecipientPhone: '',
        currentInstanceIndex: 0,
        availableInstances: 0
    })

    // UI states
    const [currentPage, setCurrentPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState('all')
    const [connectionStatus, setConnectionStatus] = useState({
        isConnected: false,
        isLoading: false,
        connectedCount: 0,
        totalCount: 0,
        message: '',
        subMessage: '',
        messageColor: '#000000'
    })

    const recipientsPerPage = 10
    const lastUpdateRef = useRef(0)

    // Enhanced Socket connection with real-time updates
    const { emit, on, off, isConnected } = useSocket({
        token,
        onConnect: () => {
            console.log('🔗 Socket connected for campaign tracking')
            // Join campaign room for real-time updates
            emit('join-campaign', { campaignId })
        },
        onDisconnect: () => {
            console.log('🔌 Socket disconnected')
        },
        onError: (error) => {
            console.error('❌ Socket error:', error)
        }
    })

    // Enhanced Socket event handlers for real-time updates
    useEffect(() => {
        if (!isConnected || !campaignId) return

        console.log('🎯 Setting up enhanced real-time campaign listeners for:', campaignId)

        // Real-time campaign progress updates with individual recipient status
        const handleCampaignProgress = (data) => {
            console.log('📊 Real-time progress update:', data)

            if (data.campaignId !== campaignId) return

            const now = Date.now()
            if (now - lastUpdateRef.current < 500) return // Throttle updates to 500ms
            lastUpdateRef.current = now

            // Update live progress
            setLiveProgress({
                processed: data.processed || 0,
                progressPercentage: data.progressPercentage || 0,
                estimatedTimeRemaining: data.estimatedTimeRemaining || 0,
                lastRecipient: data.lastRecipient || '',
                lastRecipientPhone: data.lastRecipientPhone || '',
                currentInstanceIndex: data.currentRoundRobinIndex || 0,
                availableInstances: data.availableInstances || 0
            })

            // 🎯 Real-time recipient status update
            if (data.lastRecipientIndex !== undefined && data.lastMessageStatus) {
                setRecipientStatuses(prev => {
                    const newStatuses = [...prev]
                    newStatuses[data.lastRecipientIndex] = data.lastMessageStatus
                    console.log(`📱 Status updated for recipient ${data.lastRecipientIndex}: ${data.lastMessageStatus}`)
                    return newStatuses
                })
            }

            // Update campaign statistics in real-time
            setCampaign(prev => prev ? {
                ...prev,
                statistics: {
                    total: data.total || prev.statistics.total,
                    sent: data.sent || 0,
                    failed: data.failed || 0,
                    notExist: data.notExist || 0,
                    instanceDisconnected: data.instanceDisconnected || 0
                }
            } : null)

            // Update processing state
            setIsProcessing(true)
            setIsPaused(false)
            setIsStopped(false)
        }

        // Individual message status updates
        const handleMessageStatusUpdate = (data) => {
            console.log('📱 Individual message status update:', data)

            if (data.campaignId !== campaignId) return

            const { recipientIndex, status, phone, name } = data

            if (recipientIndex !== undefined && status) {
                setRecipientStatuses(prev => {
                    const newStatuses = [...prev]
                    newStatuses[recipientIndex] = status
                    console.log(`📱 Real-time status update: ${name} (${phone}) → ${status}`)
                    return newStatuses
                })

                // Show real-time notification for status changes
                if (status === 'sent') {
                    message.success(`✅ Message sent to ${name} (${phone})`, 2)
                } else if (status === 'failed') {
                    message.error(`❌ Failed to send to ${name} (${phone})`, 2)
                } else if (status === 'not_exist') {
                    message.warning(`⚠️ ${name} (${phone}) not on WhatsApp`, 2)
                }
            }
        }

        // Campaign completion handler
        const handleCampaignComplete = (data) => {
            console.log('✅ Campaign completed:', data)

            if (data.campaignId !== campaignId) return

            setIsProcessing(false)
            setIsPaused(false)
            setIsStopped(data.status === 'stop' || data.status === 'stopped')

            // Update final statistics
            setCampaign(prev => prev ? {
                ...prev,
                status: data.status,
                statistics: {
                    total: data.total || prev.statistics.total,
                    sent: data.sent || 0,
                    failed: data.failed || 0,
                    notExist: data.notExist || 0,
                    instanceDisconnected: data.instanceDisconnected || 0
                }
            } : null)

            toast.success('🎉 Campaign completed!')

            // Refresh campaign details to get final state
            fetchCampaignDetails(false)
        }

        // Campaign paused handler
        const handleCampaignPaused = (data) => {
            console.log('⏸️ Campaign paused:', data)

            if (data.campaignId !== campaignId) return

            setIsProcessing(false)
            setIsPaused(true)
            setIsStopped(false)

            toast.info('⏸️ Campaign paused')
        }

        // Campaign resumed handler
        const handleCampaignResumed = (data) => {
            console.log('▶️ Campaign resumed:', data)

            if (data.campaignId !== campaignId) return

            setIsProcessing(true)
            setIsPaused(false)
            setIsStopped(false)

            toast.success('▶️ Campaign resumed')
        }

        // Campaign stopped handler
        const handleCampaignStopped = (data) => {
            console.log('🛑 Campaign stopped:', data)

            if (data.campaignId !== campaignId) return

            setIsProcessing(false)
            setIsPaused(false)
            setIsStopped(true)

            toast.warning('🛑 Campaign stopped')
        }

        // Bulk status updates (for efficiency)
        const handleBulkStatusUpdate = (data) => {
            console.log('📦 Bulk status update:', data)

            if (data.campaignId !== campaignId) return

            const { statusUpdates } = data
            if (statusUpdates && Array.isArray(statusUpdates)) {
                setRecipientStatuses(prev => {
                    const newStatuses = [...prev]
                    statusUpdates.forEach(({ index, status }) => {
                        if (index !== undefined && status) {
                            newStatuses[index] = status
                        }
                    })
                    return newStatuses
                })
            }
        }

        // Listen for all campaign events
        on('campaign.progress', handleCampaignProgress)
        on('campaign.message.status', handleMessageStatusUpdate)
        on('campaign.bulk.status', handleBulkStatusUpdate)
        on('campaign.complete', handleCampaignComplete)
        on('campaign.paused', handleCampaignPaused)
        on('campaign.resumed', handleCampaignResumed)
        on('campaign.stopped', handleCampaignStopped)

        return () => {
            console.log('🧹 Cleaning up enhanced campaign listeners')
            off('campaign.progress', handleCampaignProgress)
            off('campaign.message.status', handleMessageStatusUpdate)
            off('campaign.bulk.status', handleBulkStatusUpdate)
            off('campaign.complete', handleCampaignComplete)
            off('campaign.paused', handleCampaignPaused)
            off('campaign.resumed', handleCampaignResumed)
            off('campaign.stopped', handleCampaignStopped)

            // Leave campaign room
            emit('leave-campaign', { campaignId })
        }
    }, [isConnected, campaignId, on, off, emit])

    // Fetch campaign details
    const fetchCampaignDetails = async (showLoading = true) => {
        if (showLoading) setIsLoading(true)

        try {
            const response = await fetchCampaignById(user, campaignId)

            if (response.status) {
                const campaignData = response.message
                setCampaign(campaignData)

                // Initialize recipient statuses
                const statuses = campaignData.recipients?.map(recipient => recipient.status || 'pending') || []
                setRecipientStatuses(statuses)

                // Update campaign state
                const status = campaignData.status
                setIsProcessing(status === 'processing')
                setIsPaused(status === 'paused')
                setIsStopped(status === 'stop' || status === 'stopped')

                // Check connection status for instances
                if (campaignData.instanceIds?.length > 0) {
                    await checkInstanceConnections(campaignData.instanceIds)
                }
            } else {
                toast.error(response.message || 'Failed to fetch campaign details')
            }
        } catch (error) {
            console.error('Error fetching campaign:', error)
            if (error.response?.status === 401) {
                logout()
                navigate('/login')
            } else {
                toast.error('Failed to load campaign details')
            }
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    // Check instance connections
    const checkInstanceConnections = async (instanceIds) => {
        setConnectionStatus(prev => ({ ...prev, isLoading: true }))

        try {
            const allInstances = await getAllInstances(user, { migrate: false })

            if (allInstances) {
                const campaignInstances = allInstances.filter(instance =>
                    instanceIds.includes(instance._id)
                )

                const connectedInstances = campaignInstances.filter(instance =>
                    instance.whatsapp?.status === 'connected'
                )

                const connectedCount = connectedInstances.length
                const totalCount = campaignInstances.length
                const isConnected = connectedCount > 0

                setConnectionStatus({
                    isConnected,
                    isLoading: false,
                    connectedCount,
                    totalCount,
                    messageColor: '#000000',
                    message: isConnected
                        ? `${connectedCount}/${totalCount} instances connected`
                        : 'No instances connected',
                    subMessage: isConnected
                        ? 'Campaign can proceed with connected instances'
                        : 'Please connect at least one instance to continue',

                })
            }
        } catch (error) {
            console.error('Error checking instance connections:', error)
            setConnectionStatus(prev => ({
                ...prev,
                isLoading: false,
                message: 'Failed to check instance status',
                subMessage: 'Please refresh to check connection status'
            }))
        }
    }

    // Campaign control functions
    const handleStopCampaign = async () => {
        setControlStates(prev => ({ ...prev, isStopping: true }))

        try {
            const response = await stopCampaign(user, campaignId)

            if (response.status) {
                setIsStopped(true)
                setIsProcessing(false)
                setIsPaused(false)
                toast.success('Campaign Stopped Successfully!')
            } else {
                toast.error(response.message || 'Failed to stop campaign')
            }
        } catch (error) {
            console.error('Error stopping campaign:', error)
            toast.error('Failed to stop campaign')
        } finally {
            setControlStates(prev => ({ ...prev, isStopping: false }))
        }
    }

    const handlePauseCampaign = async () => {
        setControlStates(prev => ({ ...prev, isPausing: true }))

        try {
            const response = await pauseCampaign(user, campaignId)

            if (response.status) {
                setIsPaused(true)
                setIsProcessing(false)
                toast.success('Campaign Paused Successfully!')
            } else {
                toast.error(response.message || 'Failed to pause campaign')
            }
        } catch (error) {
            console.error('Error pausing campaign:', error)
            toast.error('Failed to pause campaign')
        } finally {
            setControlStates(prev => ({ ...prev, isPausing: false }))
        }
    }

    const handleResumeCampaign = async () => {
        setControlStates(prev => ({ ...prev, isResuming: true }))

        try {
            const response = await resumeCampaign(user, campaignId)

            if (response.status) {
                setIsProcessing(true)
                setIsPaused(false)
                toast.success('Campaign Resumed Successfully!')
            } else {
                toast.error(response.message || 'Failed to resume campaign')
            }
        } catch (error) {
            console.error('Error resuming campaign:', error)
            toast.error('Failed to resume campaign')
        } finally {
            setControlStates(prev => ({ ...prev, isResuming: false }))
        }
    }

    const handleStartCampaign = async () => {
        // Check license expiry
        if (user?.licenseExpiry && new Date(user.licenseExpiry) < new Date()) {
            message.error('Your license has expired. Please renew to continue sending messages.');
            return;
        }

        setIsStarting(true)

        try {
            const response = await sendCampaign(user, campaignId)

            if (response.status) {
                setIsProcessing(true)
                setIsPaused(false)
                setIsStopped(false)
                toast.success('Campaign Started Successfully!')
            } else {
                toast.error(response.message || 'Failed to start campaign')
            }
        } catch (error) {
            console.error('Error starting campaign:', error)
            toast.error('Failed to start campaign')
        } finally {
            setIsStarting(false)
        }
    }

    // Excel download — local campaign data (no MongoDB)
    const handleDownloadExcel = async () => {
        setIsDownloadingExcel(true)
        try {
            if (!campaign?.recipients?.length) {
                toast.error('No recipients found for this campaign')
                return
            }

            const pendingRecipients = campaign.recipients.filter((r) => r.status !== 'sent')
            if (!pendingRecipients.length) {
                toast.error('No pending recipients found for this campaign')
                return
            }

            const headers = ['name', 'phone', ...Array.from({ length: 30 }, (_, i) => `var${i + 1}`)]
            const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
            const rows = pendingRecipients.map((recipient) => {
                const vars = recipient.variables || {}
                return [
                    recipient.name || '',
                    recipient.phone || '',
                    ...Array.from({ length: 30 }, (_, i) => vars[`var${i + 1}`] || ''),
                ].map(escape).join(',')
            })

            const csv = [headers.join(','), ...rows].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `campaign-${campaign?.name || campaignId}-pending-recipients.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
            toast.success('CSV file downloaded successfully')
        } catch (error) {
            console.error('Error downloading CSV:', error)
            toast.error('Error downloading file: ' + (error.message || 'Unknown error'))
        } finally {
            setIsDownloadingExcel(false)
        }
    }

    const refreshCampaignDetails = () => {
        setIsRefreshing(true)
        fetchCampaignDetails(false)
    }

    // Initial load
    useEffect(() => {
        if (campaignId) {
            fetchCampaignDetails()
        }
    }, [campaignId])

    // Memoized calculations with real-time updates
    const { filteredRecipients, sentCount, failedCount, notExistCount, totalMessages } = useMemo(() => {
        const recipients = campaign?.recipients || []

        const filtered = recipients.filter((recipient, index) => {
            if (statusFilter === 'all') return true
            const status = recipientStatuses[index] || 'pending'
            return status === statusFilter
        })

        const sent = recipientStatuses.filter(status => status === 'sent').length
        const failed = recipientStatuses.filter(status => status === 'failed').length
        const notExist = recipientStatuses.filter(status => status === 'not_exist').length
        const total = recipients.length

        return {
            filteredRecipients: filtered,
            sentCount: sent,
            failedCount: failed,
            notExistCount: notExist,
            totalMessages: total
        }
    }, [campaign?.recipients, recipientStatuses, statusFilter])

    // Pagination calculations
    const { totalPages, currentRecipients, indexOfFirstRecipient } = useMemo(() => {
        const total = Math.ceil(filteredRecipients.length / recipientsPerPage)
        const lastIndex = currentPage * recipientsPerPage
        const firstIndex = lastIndex - recipientsPerPage
        const current = filteredRecipients.slice(firstIndex, lastIndex)

        return {
            totalPages: total,
            currentRecipients: current,
            indexOfFirstRecipient: firstIndex
        }
    }, [filteredRecipients, currentPage, recipientsPerPage])

    const getRecipientStatus = (recipient) => {
        const originalIndex = campaign?.recipients?.indexOf(recipient) || 0
        const status = recipientStatuses[originalIndex] || 'pending'
        return status === 'stopped' ? 'pending' : status
    }

    const getStatusConfig = (status) => {
        const configs = {
            sent: { color: 'success', text: 'Sent', icon: <CheckCircleOutlined /> },
            failed: { color: 'error', text: 'Failed', icon: <CloseCircleOutlined /> },
            not_exist: { color: 'warning', text: 'Not on WhatsApp', icon: <ExclamationCircleOutlined /> },
            stopped: { color: 'error', text: 'Stopped', icon: <StopOutlined /> },
            processing: { color: 'processing', text: 'Sending...', icon: <SyncOutlined spin /> },
            default: { color: 'default', text: 'Pending', icon: <ClockCircleOutlined /> }
        }
        return configs[status] || configs.default
    }

    const canResume = isPaused && connectionStatus.connectedCount > 0
    const showDownloadButton = isPaused || isStopped || (!isProcessing && (sentCount > 0 || failedCount > 0 || notExistCount > 0))

    // Enhanced table columns with real-time status indicators
    const columns = [
        {
            title: 'SN',
            key: 'sn',
            width: 80,
            render: (_, __, index) => (
                <Text style={{ color: '#ffffff' }}>
                    {indexOfFirstRecipient + index + 1}
                </Text>
            )
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text) => (
                <Text strong style={{ color: '#ffffff' }}>
                    {text}
                </Text>
            )
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            render: (text) => (
                <Text style={{ color: '#ffffff' }}>
                    {text}
                </Text>
            )
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => {
                const status = getRecipientStatus(record)
                const config = getStatusConfig(status)
                return (
                    <Tag color={config.color} icon={config.icon}>
                        {config.text}
                    </Tag>
                )
            }
        }
    ]

    // Filter buttons data
    const filterButtons = [
        {
            key: 'all',
            icon: <UserOutlined />,
            label: `All (${totalMessages})`,
            count: totalMessages
        },
        {
            key: 'sent',
            icon: <CheckCircleOutlined />,
            label: `Sent (${sentCount})`,
            count: sentCount
        },
        {
            key: 'failed',
            icon: <CloseCircleOutlined />,
            label: `Failed (${failedCount})`,
            count: failedCount
        },
        {
            key: 'not_exist',
            icon: <ExclamationCircleOutlined />,
            label: `Error (${notExistCount})`,
            count: notExistCount
        }
    ]

    if (isLoading) {
        return (
            <LoadingSpinner
                message="Loading campaign details..."
                style={{ minHeight: '100vh', background: 'transparent' }}
            />
        )
    }

    if (!campaign) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px',
                background: 'transparent',
                minHeight: '100vh'
            }}>
                <Text style={{ color: '#ffffff', fontSize: '18px' }}>
                    Campaign not found.
                </Text>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'transparent',
            padding: '24px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px'
                }}>
                    <div>
                        <Title level={2} style={{ color: '#ffffff', margin: 0 }}>
                            Campaign Details
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                            <Badge
                                status={isConnected ? "success" : "error"}
                                text={
                                    <span style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }}>
                                        {isConnected ? 'Real-time Connected' : 'Real-time Disconnected'}
                                    </span>
                                }
                            />
                            {isProcessing && (
                                <Badge
                                    status="processing"
                                    text={
                                        <span style={{ color: '#8b7cf6' }}>
                                            Live Processing...
                                        </span>
                                    }
                                />
                            )}
                        </div>
                    </div>
                    <Space wrap>
                        {isProcessing && (
                            <>
                                <StyledButton
                                    variant="secondary"
                                    icon={<PauseCircleOutlined />}
                                    onClick={handlePauseCampaign}
                                    loading={controlStates.isPausing}
                                    size="middle"
                                >
                                    {controlStates.isPausing ? 'Pausing...' : 'Pause'}
                                </StyledButton>
                                <StyledButton
                                    variant="danger"
                                    icon={<StopOutlined />}
                                    onClick={handleStopCampaign}
                                    loading={controlStates.isStopping}
                                    size="middle"
                                >
                                    {controlStates.isStopping ? 'Stopping...' : 'Stop'}
                                </StyledButton>
                            </>
                        )}
                        {isPaused && (
                            <>
                                <StyledButton
                                    variant={canResume ? "success" : "secondary"}
                                    icon={<PlayCircleOutlined />}
                                    onClick={handleResumeCampaign}
                                    loading={controlStates.isResuming}
                                    disabled={!canResume}
                                    size="middle"
                                >
                                    {controlStates.isResuming ? 'Resuming...' :
                                        !canResume ? 'Waiting for Connection' : 'Resume'}
                                </StyledButton>
                                <StyledButton
                                    variant="danger"
                                    icon={<StopOutlined />}
                                    onClick={handleStopCampaign}
                                    loading={controlStates.isStopping}
                                    size="middle"
                                >
                                    {controlStates.isStopping ? 'Stopping...' : 'Stop'}
                                </StyledButton>
                            </>
                        )}
                        {isStopped && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#ff4d4f',
                                fontSize: '14px',
                                fontWeight: 500
                            }}>
                                <StopOutlined />
                                Campaign Stopped
                            </div>
                        )}
                        {showDownloadButton && (
                            <StyledButton
                                variant="success"
                                icon={isDownloadingExcel ? <LoadingOutlined /> : <DownloadOutlined />}
                                onClick={handleDownloadExcel}
                                loading={isDownloadingExcel}
                                size="middle"
                            >
                                {isDownloadingExcel ? 'Downloading...' : 'Download Excel'}
                            </StyledButton>
                        )}
                        <StyledButton
                            variant="secondary"
                            icon={<ReloadOutlined spin={isRefreshing || isLoading} />}
                            onClick={refreshCampaignDetails}
                            loading={isRefreshing || isLoading}
                            size="middle"
                        >
                            Refresh
                        </StyledButton>
                        {campaign.status === 'pending' && (
                            <StyledButton
                                variant="primary"
                                icon={<SendOutlined />}
                                onClick={handleStartCampaign}
                                loading={isStarting}
                                size="middle"
                            >
                                {isStarting ? 'Starting...' : 'Start Campaign'}
                            </StyledButton>
                        )}
                        <StyledButton
                            variant="secondary"
                            icon={<LeftOutlined />}
                            onClick={() => navigate('/dashboard')}
                            size="middle"
                        >
                            Back to Dashboard
                        </StyledButton>
                    </Space>
                </div>

                {/* Connection Status Alert */}
                {(isProcessing || isPaused) && campaign.instanceIds?.length > 0 && (
                    <Alert
                        message={
                            <span style={{ color: connectionStatus.messageColor }}>
                                {connectionStatus.message}
                            </span>
                        }
                        description={
                            <span style={{ color: connectionStatus.messageColor }}>
                                {connectionStatus.subMessage}
                            </span>
                        }
                        type={connectionStatus.isLoading ? 'info' : connectionStatus.isConnected ? 'success' : 'error'}
                        icon={connectionStatus.isLoading ? <LoadingOutlined /> : connectionStatus.isConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                        style={{ marginBottom: '24px' }}
                        showIcon
                    />
                )}

                {/* Stopped Alert */}
                {isStopped && (
                    <Alert
                        message={
                            <span style={{ color: '#000000' }}>
                                🛑 Campaign Stopped
                            </span>
                        }
                        description={
                            <span style={{ color: '#000000' }}>
                                Campaign has been permanently stopped and cannot be resumed
                            </span>
                        }
                        type="error"
                        icon={<StopOutlined />}
                        style={{ marginBottom: '24px' }}
                        showIcon
                    />
                )}

                {/* Statistics Cards with Real-time Updates */}
                <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
                    <Col xs={12} md={6}>
                        <Card style={{
                            background: '#122033',
                            border: '1px solid #1a2a3d',
                            borderRadius: '8px'
                        }}>
                            <Statistic
                                title={<span style={{ color: '#888888' }}>Total</span>}
                                value={totalMessages}
                                valueStyle={{ color: '#0095FF', fontSize: '32px', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} md={6}>
                        <Card style={{
                            background: '#122033',
                            border: '1px solid #1a2a3d',
                            borderRadius: '8px'
                        }}>
                            <Statistic
                                title={<span style={{ color: '#888888' }}>Sent</span>}
                                value={sentCount}
                                valueStyle={{ color: '#52c41a', fontSize: '32px', fontWeight: 'bold' }}
                                suffix={isProcessing && sentCount > 0 ? <SyncOutlined spin style={{ fontSize: '16px' }} /> : null}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} md={6}>
                        <Card style={{
                            background: '#122033',
                            border: '1px solid #1a2a3d',
                            borderRadius: '8px'
                        }}>
                            <Statistic
                                title={<span style={{ color: '#888888' }}>Failed</span>}
                                value={failedCount}
                                valueStyle={{ color: '#ff4d4f', fontSize: '32px', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} md={6}>
                        <Card style={{
                            background: '#122033',
                            border: '1px solid #1a2a3d',
                            borderRadius: '8px'
                        }}>
                            <Statistic
                                title={<span style={{ color: '#888888' }}>Error</span>}
                                value={notExistCount}
                                valueStyle={{ color: '#faad14', fontSize: '32px', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Recipients Section with Real-time Status Updates */}
                <Card
                    style={{
                        background: '#0a1524',
                        border: '1px solid #1a2a3d',
                        borderRadius: '8px'
                    }}
                    bodyStyle={{ padding: '24px' }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '24px'
                    }}>
                        <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
                            Recipients ({totalMessages})
                            {isProcessing && (
                                <Badge
                                    count="LIVE"
                                    style={{
                                        backgroundColor: '#52c41a',
                                        marginLeft: '8px',
                                        animation: 'pulse 2s infinite'
                                    }}
                                />
                            )}
                        </Title>
                        <Space wrap>
                            {filterButtons.map(button => (
                                <StyledButton
                                    key={button.key}
                                    variant={statusFilter === button.key ? 'primary' : 'secondary'}
                                    icon={button.icon}
                                    onClick={() => {
                                        setStatusFilter(button.key)
                                        setCurrentPage(1)
                                    }}
                                    size="middle"
                                >
                                    {button.label}
                                </StyledButton>
                            ))}
                        </Space>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={currentRecipients}
                        rowKey={(record, index) => `${record.phone}-${index}`}
                        pagination={false}
                        style={{
                            background: '#0a1524',
                            borderRadius: '8px'
                        }}
                    />

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
                                Showing {indexOfFirstRecipient + 1}-{Math.min(indexOfFirstRecipient + recipientsPerPage, filteredRecipients.length)} of {filteredRecipients.length} recipients
                                {statusFilter !== 'all' && (
                                    <Badge
                                        count={statusFilter}
                                        style={{
                                            backgroundColor: '#1a2a3d',
                                            color: '#ffffff',
                                            marginLeft: '8px'
                                        }}
                                    />
                                )}
                            </Text>
                            <Pagination
                                current={currentPage}
                                total={filteredRecipients.length}
                                pageSize={recipientsPerPage}
                                onChange={setCurrentPage}
                                showSizeChanger={false}
                                style={{
                                    color: '#ffffff'
                                }}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}

export default CampaignFinal