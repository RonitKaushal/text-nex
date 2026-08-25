import React, { useState, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Card,
    Button,
    Modal,
    Input,
    Pagination,
    Select,
    Avatar,
    Badge,
    Space,
    Typography,
    Spin,
    Empty,
    message,
    Row,
    Col,
    Divider,
    Steps,
    Alert,
    Popconfirm,
    Table,
    Tag
} from 'antd'
import {
    PhoneOutlined,
    QrcodeOutlined,
    EditOutlined,
    DeleteOutlined,
    LogoutOutlined,
    PlusOutlined,
    LoadingOutlined,
    WifiOutlined,
    DisconnectOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
    FilterOutlined,
    MobileOutlined,
    LinkOutlined
} from '@ant-design/icons'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import StyledButton from '../components/common/StyledButton'
import { useToast } from '../context/ToastContext'
import api from '../services/api'
import { countryList } from '../utils/countryCodes'
import {
    getAllInstances,
    createInstance,
    resolveInstanceLimit,
    updateInstance,
    deleteLocalInstance,
    syncInstanceFromSocket,
} from '../services/instanceStorage'
import {
    requestQR,
    requestPairingCode,
    logoutInstance,
    deleteSession,
    subscribeWhatsAppEvents,
    mapWhatsAppEventToSocket,
    isElectronWhatsApp,
} from '../services/localWhatsApp'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const Connection = memo(function Connection() {
    const navigate = useNavigate()
    const toast = useToast()
    const [instances, setInstances] = useState([])
    const [showQR, setShowQR] = useState(false)
    const [qrCode, setQrCode] = useState('')
    const [selectedInstanceId, setSelectedInstanceId] = useState(null)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [connectedInstance, setConnectedInstance] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [instancesPerPage, setInstancesPerPage] = useState(10)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [editInstanceId, setEditInstanceId] = useState(null)
    const [editInstanceName, setEditInstanceName] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [isProcessingQR, setIsProcessingQR] = useState({})
    const [isProcessingLogout, setIsProcessingLogout] = useState({})
    const [isProcessingDelete, setIsProcessingDelete] = useState({})
    const [isProcessingEdit, setIsProcessingEdit] = useState({})
    const [createInstanceModalVisible, setCreateInstanceModalVisible] = useState(false)
    const [newInstanceName, setNewInstanceName] = useState('')
    const [selectedLoginType, setSelectedLoginType] = useState('QR') // 'QR' or 'PAIRING'

    const { user, token, logout, updateUser } = useAuth()

    const [selectedInstance, setSelectedInstance] = useState(null)
    const [showPairingModal, setShowPairingModal] = useState(false)
    const [pairingPhoneNumber, setPairingPhoneNumber] = useState('')
    const [selectedCountryCode, setSelectedCountryCode] = useState('+91')
    const [pairingCode, setPairingCode] = useState('')
    const [isGeneratingPairingCode, setIsGeneratingPairingCode] = useState(false)
    
    // License Renewal State
    const [showRenewModal, setShowRenewModal] = useState(false)
    const [renewKey, setRenewKey] = useState('')
    const [isRenewing, setIsRenewing] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Socket connection
    const { emit, on, off, isConnected } = useSocket({
        token,
        onConnect: () => {
            console.log('Socket connected successfully')
        },
        onDisconnect: () => {
            console.log('Socket disconnected')
        },
        onError: (error) => {
            console.error('Socket error:', error)
            const isAuthError = error.message.includes('Authentication failed') || error.message.includes('Not authorized')
            isAuthError && handleUnauthorized()
        }
    })

    // Socket event listeners
    useEffect(() => {
        if (!isConnected) {
            console.log('Socket not connected, skipping event listeners')
            return
        }

        console.log('Setting up socket event listeners')

        const handleQREvent = (data) => {
            console.log('QR event received:', data)
            const isValidQR = data.instanceId === selectedInstanceId || data.qr

            isValidQR && (() => {
                setQrCode(data.qr)
                setIsProcessingQR(prev => ({ ...prev, [selectedInstanceId]: false }))
                toast.success('QR code received')
            })()
        }

        const handleInstanceUpdate = async (data) => {
            console.log('Instance update received:', data)
            await syncInstanceFromSocket(user, data)
            setInstances(prev => {
                let changed = false
                const next = prev.map(instance => {
                    if (instance._id !== data.instanceId) return instance
                    const nextStatus = data.whatsapp?.status
                    const nextPhone = data.whatsapp?.phone
                    const nextProfile = data.whatsapp?.profile
                    const nextName = data.name ?? instance.name
                    if (
                        instance.name === nextName &&
                        instance.whatsapp?.status === nextStatus &&
                        instance.whatsapp?.phone === nextPhone &&
                        instance.whatsapp?.profile === nextProfile
                    ) {
                        return instance
                    }
                    changed = true
                    return {
                        ...instance,
                        name: nextName,
                        whatsapp: {
                            phone: nextPhone,
                            status: nextStatus,
                            profile: nextProfile
                        },
                        createdAt: data.createdAt ?? instance.createdAt
                    }
                })
                return changed ? next : prev
            })

            if (data.whatsapp.status === 'connected' && data.instanceId === selectedInstanceId) {
                 // Close any open modals
                 setShowQR(false)
                 setShowPairingModal(false)
                 
                 setConnectedInstance({
                    _id: data._id,
                    name: data.name,
                    whatsapp: {
                        phone: data.whatsapp.phone,
                        status: data.whatsapp.status,
                        profile: data.whatsapp.profile
                    },
                    createdAt: data.createdAt
                })
                setShowSuccessDialog(true)
                setSelectedInstanceId(null)
                toast.success('WhatsApp Connected Successfully!')
            }
        }

        // Listen for QR code events
        on('instance.qr', handleQREvent)
        on('qr', handleQREvent) // Alternative event name

        // Listen for instance updates
        on('instance.update', handleInstanceUpdate)
        on('connection-status', handleInstanceUpdate) // Alternative event name

        return () => {
            console.log('Cleaning up socket event listeners')
            off('instance.qr', handleQREvent)
            off('qr', handleQREvent)
            off('instance.update', handleInstanceUpdate)
            off('connection-status', handleInstanceUpdate)
        }
    }, [isConnected, selectedInstanceId, showQR, on, off])

    // Local WhatsApp events (Electron)
    useEffect(() => {
        if (!isElectronWhatsApp()) return

        const handleLocalEvent = ({ eventName, data }) => {
            mapWhatsAppEventToSocket(eventName, data, {
                onQR: (qrData) => {
                    if (qrData.instanceId === selectedInstanceId || qrData.qr) {
                        setQrCode(qrData.qr)
                        setIsProcessingQR((prev) => ({ ...prev, [selectedInstanceId]: false }))
                        toast.success('QR code received')
                    }
                },
                onInstanceUpdate: async (updateData) => {
                    await syncInstanceFromSocket(user, updateData)
                    setInstances((prev) => {
                        let changed = false
                        const next = prev.map((instance) => {
                            if (instance._id !== updateData.instanceId) return instance
                            const nextStatus = updateData.whatsapp?.status
                            const nextPhone = updateData.whatsapp?.phone
                            const nextProfile = updateData.whatsapp?.profile
                            const nextName = updateData.name ?? instance.name
                            if (
                                instance.name === nextName &&
                                instance.whatsapp?.status === nextStatus &&
                                instance.whatsapp?.phone === nextPhone &&
                                instance.whatsapp?.profile === nextProfile
                            ) {
                                return instance
                            }
                            changed = true
                            return {
                                ...instance,
                                name: nextName,
                                whatsapp: {
                                    phone: nextPhone,
                                    status: nextStatus,
                                    profile: nextProfile,
                                },
                            }
                        })
                        return changed ? next : prev
                    })
                    if (
                        updateData.whatsapp?.status === 'connected' &&
                        updateData.instanceId === selectedInstanceId
                    ) {
                        setShowQR(false)
                        setShowPairingModal(false)
                        setConnectedInstance({
                            _id: updateData._id || updateData.instanceId,
                            name: updateData.name,
                            whatsapp: {
                                phone: updateData.whatsapp?.phone,
                                status: updateData.whatsapp?.status,
                                profile: updateData.whatsapp?.profile
                            },
                            createdAt: updateData.createdAt
                        })
                        setShowSuccessDialog(true)
                        setSelectedInstanceId(null)
                        toast.success('WhatsApp Connected Successfully!')
                    }
                },
            })
        }

        return subscribeWhatsAppEvents(handleLocalEvent)
    }, [selectedInstanceId, user])

    const handleUnauthorized = () => {
        logout()
        navigate('/login')
    }

    const userId = user ? (user.phone || user._id || user.id || null) : null

    const fetchInstances = useCallback(async (opts = {}) => {
        const silent = opts.silent === true
        if (!token) {
            message.error('Please log in to access your devices')
            navigate('/login')
            return
        }

        if (!silent) setIsLoading(true)
        try {
            const allInstances = await getAllInstances(user)
            setInstances((prev) => {
                // Avoid re-render when nothing meaningful changed
                if (
                    prev.length === allInstances.length &&
                    prev.every((p, i) => {
                        const n = allInstances[i]
                        return (
                            p?._id === n?._id &&
                            p?.name === n?.name &&
                            p?.whatsapp?.status === n?.whatsapp?.status &&
                            p?.whatsapp?.phone === n?.whatsapp?.phone &&
                            p?.whatsapp?.profile === n?.whatsapp?.profile
                        )
                    })
                ) {
                    return prev
                }
                return allInstances
            })
        } catch (err) {
            console.error('Error fetching instances:', err)
            toast.error('Error fetching instances: ' + (err instanceof Error ? err.message : 'Unknown error'))
        } finally {
            if (!silent) setIsLoading(false)
        }
    }, [token, userId, navigate])

    useEffect(() => {
        if (token) fetchInstances()
        // Only re-fetch when auth identity changes — not on every user object rewrite
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, userId])

    const handleCreateInstance = async () => {
        if (!newInstanceName.trim()) {
            toast.warning('Please enter an instance name')
            return
        }

        setIsCreating(true)
        try {
            const result = await createInstance(user, {
                name: newInstanceName,
                loginType: selectedLoginType,
            })

            if (result.success) {
                toast.success('Instance created successfully')
                const newInstance = result.instance
                setInstances((prev) => [...prev, newInstance])
                
                const totalPages = Math.ceil((instances.length + 1) / instancesPerPage)
                setCurrentPage(totalPages)

                setCreateInstanceModalVisible(false)
                setNewInstanceName('')
                
                if (selectedLoginType === 'QR') {
                    handleShowQR(newInstance._id, newInstance)
                } else if (selectedLoginType === 'PAIRING') {
                    openPairingModal(newInstance._id, newInstance)
                }
            } else {
                toast.error(result.message || 'Failed to create instance')
            }
        } catch (err) {
            console.error('Error creating instance:', err)
            toast.error('Error creating instance: ' + (err instanceof Error ? err.message : 'Unknown error'))
        } finally {
            setIsCreating(false)
        }
    }

    const openCreateInstanceModal = async () => {
        const limit = await resolveInstanceLimit(user, { forceRefresh: true })
        if ((instances?.length || 0) >= limit) {
            toast.error(`Instance limit reached. Your limit is ${limit}.`)
            return
        }
        if (!newInstanceName.trim()) {
            const nextNumber = (instances?.length || 0) + 1
            setNewInstanceName(`Device ${nextNumber}`)
        }
        setCreateInstanceModalVisible(true)
    }

    const resolveInstance = useCallback(
        (instanceId, instanceOverride) =>
            instanceOverride || instances.find((i) => i._id === instanceId),
        [instances]
    )

    const handleShowQR = async (instanceId, instanceOverride) => {
        if (!token) {
            toast.error('Please log in to view QR code')
            navigate('/login')
            return
        }

        const instanceData = resolveInstance(instanceId, instanceOverride)
        if (!instanceData) {
            toast.error('Instance not found. Please try again.')
            return
        }

        if (!isElectronWhatsApp() && !isConnected) {
            toast.warning('Socket not connected. Please wait for connection.')
            return
        }

        console.log('Requesting QR for instance:', instanceId)
        setIsProcessingQR(prev => ({ ...prev, [instanceId]: true }))
        setSelectedInstanceId(instanceId)
        setQrCode('')
        setShowQR(true)

        try {
            const response = isElectronWhatsApp()
                ? await requestQR(instanceData)
                : (await api.post('/instance/qr', { instance_id: instanceId, instance: instanceData })).data
            console.log('QR request response:', response)

            if (!response.status) {
                toast.error(response.message || 'Failed to request QR code')
                setShowQR(false)
                setSelectedInstanceId(null)
                setIsProcessingQR(prev => ({ ...prev, [instanceId]: false }))
            } else {
                toast.info('QR code requested, waiting for response...')
                response.qr && (() => {
                    setQrCode(response.qr)
                    setIsProcessingQR(prev => ({ ...prev, [instanceId]: false }))
                })()
            }
        } catch (err) {
            console.error('Error requesting QR code:', err)
            toast.error('Error requesting QR code: ' + (err instanceof Error ? err.message : 'Unknown error'))
            setShowQR(false)
            setSelectedInstanceId(null)
            setIsProcessingQR(prev => ({ ...prev, [instanceId]: false }))
        }
    }

    const handleDeleteInstance = async (instanceId) => {
        if (!token) {
            toast.error('Please log in to delete instance')
            navigate('/login')
            return
        }

        setIsProcessingDelete(prev => ({ ...prev, [instanceId]: true }))
        try {
            const instanceData = instances.find((i) => i._id === instanceId)
            if (isElectronWhatsApp()) {
                await deleteSession(instanceData)
            } else {
                await api.post('/instance/delete', { instanceId })
            }
            await deleteLocalInstance(user, instanceId)

            setInstances((prev) => {
                    const newInstances = prev.filter((instance) => instance._id !== instanceId)
                    const totalPages = Math.ceil(newInstances.length / instancesPerPage)
                    const shouldUpdatePage = currentPage > totalPages && totalPages > 0
                    shouldUpdatePage && setCurrentPage(totalPages)
                    return newInstances
                })
                toast.success('Instance Deleted Successfully!')
        } catch (err) {
            console.error('Error deleting instance:', err)
            toast.error('Error deleting instance: ' + (err instanceof Error ? err.message : 'Unknown error'))
        } finally {
            setIsProcessingDelete(prev => ({ ...prev, [instanceId]: false }))
        }
    }

    const handleLogoutInstance = async (instanceId) => {
        if (!token) {
            toast.error('Please log in to log out instance')
            navigate('/login')
            return
        }

        setIsProcessingLogout(prev => ({ ...prev, [instanceId]: true }))
        try {
            const instanceData = instances.find((i) => i._id === instanceId)
            const response = isElectronWhatsApp()
                ? await logoutInstance(instanceData)
                : (await api.post('/instance/logout', { instanceId, instance: instanceData })).data

            if (response.status) {
                await updateInstance(user, instanceId, {
                    whatsapp: {
                        ...instanceData?.whatsapp,
                        status: 'disconnected',
                        phone: null,
                        profile: null,
                    },
                })
                setInstances((prev) =>
                    prev.map((instance) =>
                        instance._id === instanceId
                            ? {
                                ...instance,
                                whatsapp: {
                                    ...instance.whatsapp,
                                    status: 'disconnected',
                                    phone: null,
                                    profile: null
                                }
                            }
                            : instance
                    )
                )
                toast.success('Logged Out Successfully!')
            } else {
                toast.error(response.message || 'Failed to log out')
            }
        } catch (err) {
            console.error('Error logging out:', err)
            toast.error('Error logging out: ' + (err instanceof Error ? err.message : 'Unknown error'))
        } finally {
            setIsProcessingLogout(prev => ({ ...prev, [instanceId]: false }))
        }
    }

    const handleEditInstance = async () => {
        if (!token) {
            toast.error('Please log in to edit instance')
            navigate('/login')
            return
        }

        if (!editInstanceName.trim()) {
            toast.warning('Please enter a valid name')
            return
        }

        setIsProcessingEdit(prev => ({ ...prev, [editInstanceId]: true }))
        try {
            const result = await updateInstance(user, editInstanceId, {
                name: editInstanceName.trim(),
            })

            if (result.success) {
                setInstances((prev) =>
                    prev.map((instance) =>
                        instance._id === editInstanceId
                            ? { ...instance, name: editInstanceName }
                            : instance
                    )
                )
                toast.success('Instance Name Updated Successfully!')
                setShowEditDialog(false)
                setEditInstanceId(null)
                setEditInstanceName('')
                setSelectedInstance(null)
            } else {
                toast.error(result.message || 'Failed to update instance name')
            }
        } catch (err) {
            console.error('Error updating instance name:', err)
            toast.error('Error updating instance name: ' + (err instanceof Error ? err.message : 'Unknown error'))
        } finally {
            setIsProcessingEdit(prev => ({ ...prev, [editInstanceId]: false }))
        }
    }

    const openEditDialog = (instanceId, currentName) => {
        const instance = instances.find(inst => inst._id === instanceId)
        setEditInstanceId(instanceId)
        setEditInstanceName(currentName || '')
        setSelectedInstance(instance || null)
        setShowEditDialog(true)
    }

    // Sort instances from old to new
    const sortedInstances = [...instances].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateA - dateB
    })

    const indexOfLastInstance = currentPage * instancesPerPage
    const indexOfFirstInstance = indexOfLastInstance - instancesPerPage
    const currentInstances = sortedInstances.slice(indexOfFirstInstance, indexOfLastInstance)

    const handleRequestPairingCode = async () => {
        // Check license expiry
        if (user?.licenseExpiry && new Date(user.licenseExpiry) < new Date()) {
            message.error('Your license has expired. Please renew to continue.')
            return
        }

        if (!pairingPhoneNumber) {
            toast.warning('Please enter a valid phone number')
            return
        }

        setIsGeneratingPairingCode(true)
        try {
            const instanceData = resolveInstance(selectedInstanceId)
            if (!instanceData) {
                toast.warning('Instance not found. Please try again.')
                return
            }

            const fullPhoneNumber = `${selectedCountryCode}${pairingPhoneNumber}`.replace(/[^0-9+]/g, '')
            const response = isElectronWhatsApp()
                ? await requestPairingCode(instanceData, fullPhoneNumber)
                : (
                    await api.post('/instance/pairing-code', {
                        instance_id: selectedInstanceId,
                        phoneNumber: fullPhoneNumber,
                        instance: instanceData,
                    })
                ).data

            if (response.status) {
                setPairingCode(response.code)
                toast.success('Pairing code generated!')
            } else {
                toast.error(response.message || 'Failed to generate pairing code')
            }
        } catch (err) {
            console.error('Error generating pairing code:', err)
            toast.error('Error generating pairing code')
        } finally {
            setIsGeneratingPairingCode(false)
        }
    }

    const openPairingModal = (instanceId, instanceOverride) => {
        const instanceData = resolveInstance(instanceId, instanceOverride)
        if (!instanceData) {
            toast.error('Instance not found. Please try again.')
            return
        }
        setSelectedInstanceId(instanceId)
        setPairingPhoneNumber('')
        setPairingCode('')
        setShowPairingModal(true)
    }

    const handleRenewLicense = async () => {
        if (!renewKey.trim()) {
            message.warning('Please enter a license key')
            return
        }
        setIsRenewing(true)
        try {
            const response = await api.post('/user/renew-license', {
              licenseKey: renewKey,
              appType: 'bulk-whatsapp',
            })
            if (response.data.success || response.data.status) {
                const newExpiry = response.data.licenseExpiry
                message.success(`License renewed! New expiry: ${new Date(newExpiry).toLocaleDateString()}`)
                updateUser({ licenseExpiry: newExpiry, isActive: true })
                setShowRenewModal(false)
                setRenewKey('')
            } else {
                message.error(response.data.message || 'Renewal failed')
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Renewal failed')
        } finally {
            setIsRenewing(false)
        }
    }

    return (
        <div style={{ padding: '0px', background: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
                    Devices
                </Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button
                        type="text"
                        icon={<ReloadOutlined />}
                        onClick={() => fetchInstances()}
                        loading={isLoading}
                        style={{ color: 'rgba(255,255,255,0.65)' }}
                    >
                        Refresh
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        loading={isCreating}
                        onClick={openCreateInstanceModal}
                        style={{
                            background: '#0095FF',
                            borderColor: '#0095FF',
                            borderRadius: 8,
                            fontWeight: 600,
                            height: 40,
                            paddingInline: 16,
                        }}
                    >
                        Add Device
                    </Button>
                </div>
            </div>

            {(() => {
                const q = searchTerm.trim().toLowerCase()
                const filtered = sortedInstances.filter((inst) => {
                    if (!q) return true
                    const name = String(inst.name || '').toLowerCase()
                    const phone = String(inst.whatsapp?.phone || '').toLowerCase()
                    return name.includes(q) || phone.includes(q)
                })
                const connectedCount = sortedInstances.filter((i) => i.whatsapp?.status === 'connected').length
                const disconnectedCount = sortedInstances.length - connectedCount
                const iconColors = ['#0095FF', '#A855F7', '#F59E0B', '#22C55E', '#F43F5E', '#06B6D4']
                const formatPhone = (phone) => {
                    if (!phone) return '—'
                    const d = String(phone).replace(/\D/g, '')
                    if (d.length >= 12) return `+${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7)}`
                    if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
                    return phone.startsWith('+') ? phone : `+${phone}`
                }
                const lastActiveLabel = (inst) => {
                    if (inst.whatsapp?.status === 'connected') return 'Just now'
                    const t = inst.updatedAt || inst.createdAt
                    if (!t) return '—'
                    const diff = Date.now() - new Date(t).getTime()
                    const mins = Math.floor(diff / 60000)
                    if (mins < 1) return 'Just now'
                    if (mins < 60) return `${mins} mins ago`
                    const hrs = Math.floor(mins / 60)
                    if (hrs < 24) return `${hrs}h ago`
                    return `${Math.floor(hrs / 24)}d ago`
                }
                const pageData = filtered.slice(indexOfFirstInstance, indexOfLastInstance)

                const statCard = (icon, label, value, color) => (
                    <div
                        key={label}
                        style={{
                            flex: '1 1 180px',
                            background: '#0a1524',
                            border: '1px solid #1a2a3d',
                            borderRadius: 12,
                            padding: '18px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                        }}
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: `${color}22`,
                                color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                            }}
                        >
                            {icon}
                        </div>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{label}</div>
                            <div style={{ color: color === '#0095FF' ? '#fff' : color, fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                                {value}
                            </div>
                        </div>
                    </div>
                )

                return (
                    <>
                        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                            {statCard(<MobileOutlined />, 'Total Devices', sortedInstances.length, '#0095FF')}
                            {statCard(<WifiOutlined />, 'Connected', connectedCount, '#22C55E')}
                            {statCard(<DisconnectOutlined />, 'Disconnected', disconnectedCount, '#EF4444')}
                        </div>

                        <div
                            style={{
                                background: '#0a1524',
                                border: '1px solid #1a2a3d',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                                <Title level={4} style={{ color: '#fff', margin: 0 }}>All Devices</Title>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Input
                                        allowClear
                                        prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.35)' }} />}
                                        placeholder="Search devices..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                                        style={{
                                            width: 220,
                                            background: '#122033',
                                            borderColor: '#1a2a3d',
                                            color: '#fff',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <Button
                                        icon={<FilterOutlined />}
                                        style={{
                                            background: '#122033',
                                            borderColor: '#1a2a3d',
                                            color: 'rgba(255,255,255,0.75)',
                                            borderRadius: 8,
                                        }}
                                    >
                                        Filter
                                    </Button>
                                </div>
                            </div>

                            {isLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                                    <Spin size="large" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <Empty
                                    image={<MobileOutlined style={{ fontSize: 56, color: '#666' }} />}
                                    description={
                                        <div>
                                            <Title level={4} style={{ color: '#fff' }}>No Devices Found</Title>
                                            <Paragraph style={{ color: '#888' }}>
                                                You don't have any WhatsApp instances yet. Create your first instance to get started.
                                            </Paragraph>
                                        </div>
                                    }
                                >
                                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateInstanceModal} style={{ background: '#0095FF', borderColor: '#0095FF' }}>
                                        Add Device
                                    </Button>
                                </Empty>
                            ) : (
                                <Table
                                    rowKey="_id"
                                    pagination={false}
                                    dataSource={pageData}
                                    scroll={{ x: 900 }}
                                    columns={[
                                        {
                                            title: '#',
                                            width: 60,
                                            render: (_v, _r, idx) => (
                                                <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                                                    {String(indexOfFirstInstance + idx + 1).padStart(2, '0')}
                                                </span>
                                            ),
                                        },
                                        {
                                            title: 'Device Name',
                                            dataIndex: 'name',
                                            render: (name, record, idx) => {
                                                const color = iconColors[(indexOfFirstInstance + idx) % iconColors.length]
                                                const connected = record.whatsapp?.status === 'connected'
                                                const profile = record.whatsapp?.profile
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        {connected && profile ? (
                                                            <Avatar
                                                                size={36}
                                                                src={profile}
                                                                style={{
                                                                    flexShrink: 0,
                                                                    border: `2px solid ${color}55`,
                                                                    background: '#122033',
                                                                }}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: 36, height: 36, borderRadius: 8,
                                                                background: `${color}22`, color,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0,
                                                            }}>
                                                                <MobileOutlined />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ color: '#fff', fontWeight: 600 }}>{name || 'Device'}</div>
                                                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                                                                {connected ? 'Primary Device' : 'WhatsApp Device'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            },
                                        },
                                        {
                                            title: 'Phone Number',
                                            render: (_v, r) => (
                                                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{formatPhone(r.whatsapp?.phone)}</span>
                                            ),
                                        },
                                        {
                                            title: 'Status',
                                            render: (_v, r) => {
                                                const on = r.whatsapp?.status === 'connected'
                                                return (
                                                    <Tag
                                                        style={{
                                                            margin: 0,
                                                            borderRadius: 999,
                                                            border: 'none',
                                                            background: on ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                                            color: on ? '#22C55E' : '#EF4444',
                                                            padding: '2px 10px',
                                                        }}
                                                    >
                                                        <span style={{
                                                            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                                                            background: on ? '#22C55E' : '#EF4444', marginRight: 6,
                                                        }} />
                                                        {on ? 'Connected' : 'Disconnected'}
                                                    </Tag>
                                                )
                                            },
                                        },
                                        {
                                            title: 'Last Active',
                                            render: (_v, r) => (
                                                <span style={{ color: 'rgba(255,255,255,0.55)' }}>{lastActiveLabel(r)}</span>
                                            ),
                                        },
                                        {
                                            title: 'Messages Sent',
                                            render: (_v, r) => (
                                                <span style={{ color: '#fff', fontWeight: 700 }}>
                                                    {r.messagesSent ?? r.stats?.sent ?? 0}
                                                </span>
                                            ),
                                        },
                                        {
                                            title: 'Actions',
                                            width: 150,
                                            render: (_v, record) => {
                                                const on = record.whatsapp?.status === 'connected'
                                                const id = record._id
                                                const isPairing = String(record.loginType || '').toUpperCase() === 'PAIRING'
                                                return (
                                                    <Space size={6}>
                                                        {on ? (
                                                            <Button
                                                                size="small"
                                                                icon={<LogoutOutlined />}
                                                                loading={!!isProcessingLogout[id]}
                                                                onClick={() => handleLogoutInstance(id)}
                                                                style={{
                                                                    background: '#122033',
                                                                    borderColor: '#1a2a3d',
                                                                    color: '#0095FF',
                                                                }}
                                                            />
                                                        ) : isPairing ? (
                                                            <Button
                                                                size="small"
                                                                icon={<LinkOutlined />}
                                                                onClick={() => openPairingModal(id)}
                                                                style={{
                                                                    background: '#122033',
                                                                    borderColor: '#1a2a3d',
                                                                    color: '#0095FF',
                                                                }}
                                                            />
                                                        ) : (
                                                            <Button
                                                                size="small"
                                                                icon={<QrcodeOutlined />}
                                                                loading={!!isProcessingQR[id]}
                                                                onClick={() => handleShowQR(id)}
                                                                style={{
                                                                    background: '#122033',
                                                                    borderColor: '#1a2a3d',
                                                                    color: '#0095FF',
                                                                }}
                                                            />
                                                        )}
                                                        <Popconfirm
                                                            title="Delete this device?"
                                                            onConfirm={() => handleDeleteInstance(id)}
                                                            okText="Delete"
                                                            cancelText="Cancel"
                                                        >
                                                            <Button
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                loading={!!isProcessingDelete[id]}
                                                                style={{
                                                                    background: 'rgba(239,68,68,0.12)',
                                                                    borderColor: 'rgba(239,68,68,0.35)',
                                                                }}
                                                            />
                                                        </Popconfirm>
                                                    </Space>
                                                )
                                            },
                                        },
                                    ]}
                                />
                            )}

                            {filtered.length > instancesPerPage && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                                    <Pagination
                                        current={currentPage}
                                        total={filtered.length}
                                        pageSize={instancesPerPage}
                                        onChange={setCurrentPage}
                                        showSizeChanger={false}
                                    />
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                background: '#0a1524',
                                border: '1px solid #1a2a3d',
                                borderRadius: 12,
                                padding: '16px 18px',
                                display: 'flex',
                                gap: 12,
                                alignItems: 'flex-start',
                            }}
                        >
                            <InfoCircleOutlined style={{ color: '#0095FF', fontSize: 18, marginTop: 2 }} />
                            <div>
                                <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>How to connect a device?</div>
                                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.55 }}>
                                    Click <b style={{ color: '#fff' }}>Add Device</b>, choose QR Login, then open WhatsApp on your phone →
                                    Linked Devices → Link a Device and scan the QR code shown here.
                                </div>
                            </div>
                        </div>
                    </>
                )
            })()}

            {/* Create Instance Modal */}
            <Modal
                title={
                    <span style={{ color: '#ffffff', fontSize: '18px' }}>
                        Create Instance
                    </span>
                }
                open={createInstanceModalVisible}
                onCancel={() => setCreateInstanceModalVisible(false)}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <StyledButton
                            key="cancel"
                            variant="secondary"
                            onClick={() => setCreateInstanceModalVisible(false)}
                        >
                            Cancel
                        </StyledButton>
                        <StyledButton
                            key="create"
                            variant="primary"
                            loading={isCreating}
                            onClick={handleCreateInstance}
                            disabled={!newInstanceName.trim()}
                        >
                            Create
                        </StyledButton>
                    </div>
                }
                centered
                styles={{
                    content: {
                        background: '#0a1524',
                        border: '1px solid #1a2a3d',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '100%',
                        overflow: 'hidden'
                    },
                    header: {
                        background: 'transparent',
                        borderBottom: 'none',
                        padding: '0 0 20px 0'
                    },
                    mask: {
                        backgroundColor: 'rgba(5, 10, 18, 0.85)'
                    }
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                         <Text style={{ color: '#ff4d4f', marginRight: '4px' }}>*</Text>
                         <Text style={{ color: '#ffffff', marginBottom: '8px', display: 'inline-block' }}>Select Login Type</Text>
                         <div style={{ display: 'flex', background: '#122033', padding: '4px', borderRadius: '6px', border: '1px solid #1a2a3d', flexWrap: 'wrap' }}>
                            {['QR', 'PAIRING'].map((type) => (
                                <div
                                    key={type}
                                    onClick={() => setSelectedLoginType(type)}
                                    style={{
                                        flex: '1 1 120px',
                                        padding: '10px 0',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: selectedLoginType === type ? '#00A1FF' : 'transparent',
                                        color: '#ffffff',
                                        borderRadius: '4px',
                                        transition: 'all 0.3s',
                                        fontSize: '14px',
                                        fontWeight: selectedLoginType === type ? '600' : '400'
                                    }}
                                >
                                    {type === 'QR' ? 'QR Login' : 'Pairing Code'}
                                </div>
                            ))}
                         </div>
                    </div>

                    <div>
                        <Text style={{ color: '#ff4d4f', marginRight: '4px' }}>*</Text>
                        <Text style={{ color: '#ffffff', marginBottom: '8px', display: 'inline-block' }}>Instance Name</Text>
                        <Input
                            placeholder="Enter instance name"
                            value={newInstanceName}
                            onChange={(e) => setNewInstanceName(e.target.value)}
                            style={{
                                background: '#122033',
                                borderColor: '#1a2a3d',
                                color: '#ffffff',
                                padding: '10px 12px'
                            }}
                        />
                    </div>
                </div>
            </Modal>


            {/* QR Code Modal - Centered */}
            <Modal
                title={
                    <span style={{
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: '600'
                    }}>
                        Connect WhatsApp Device
                    </span>
                }
                open={showQR}
                onCancel={() => {
                    setShowQR(false)
                    setSelectedInstanceId(null)
                    setQrCode('')
                }}
                footer={null}
                width={800}
                centered
                destroyOnClose
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
                        backgroundColor: 'rgba(5, 10, 18, 0.85)'
                    }
                }}
            >
                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {qrCode ? (
                                <div style={{
                                    background: '#ffffff',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    display: 'inline-block',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                }}>
                                    <img src={qrCode} alt="QR Code" style={{ maxWidth: '300px', width: '100%' }} />
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '300px',
                                    width: '100%',
                                    maxWidth: '300px',
                                    background: '#122033',
                                    borderRadius: '8px',
                                    border: '1px solid #1a2a3d'
                                }}>
                                    <Spin size="large" />
                                    <Text style={{ marginTop: '16px', color: '#888888' }}>Waiting for QR code...</Text>
                                </div>
                            )}
                        </div>
                    </Col>

                    <Col xs={24} lg={12}>
                        <Card
                            style={{
                                height: '100%',
                                background: '#122033',
                                border: '1px solid #1a2a3d'
                            }}
                            bodyStyle={{ color: '#ffffff' }}
                        >
                            <Title level={4} style={{ color: '#ffffff' }}>How to Connect</Title>
                            <Steps
                                direction="vertical"
                                size="small"
                                current={-1}
                                items={[
                                    {
                                        title: <span style={{ color: '#ffffff' }}>Open WhatsApp on your phone</span>,
                                        icon: <PhoneOutlined style={{ color: '#0095FF' }} />
                                    },
                                    {
                                        title: <span style={{ color: '#ffffff' }}>Tap Menu or Settings and select Linked Devices</span>,
                                        icon: <QrcodeOutlined style={{ color: '#0095FF' }} />
                                    },
                                    {
                                        title: <span style={{ color: '#ffffff' }}>Tap on "Link a Device"</span>,
                                        icon: <PlusOutlined style={{ color: '#0095FF' }} />
                                    },
                                    {
                                        title: <span style={{ color: '#ffffff' }}>Point your phone to this screen to capture the code</span>,
                                        icon: <CheckCircleOutlined style={{ color: '#0095FF' }} />
                                    }
                                ]}
                            />
                            <Alert
                                message="Once connected, you'll be able to use WhatsApp on this device"
                                type="success"
                                showIcon
                                style={{
                                    marginTop: '16px',
                                    background: '#0f3a2e',
                                    border: '1px solid #52c41a',
                                    color: '#52c41a'
                                }}
                            />
                        </Card>
                    </Col>
                </Row>
            </Modal>

            {/* Success Modal - Centered */}
            <Modal
                title={null}
                open={showSuccessDialog}
                onCancel={() => setShowSuccessDialog(false)}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '12px' }}>
                        <StyledButton
                            key="continue"
                            variant="primary"
                            onClick={() => setShowSuccessDialog(false)}
                            style={{ 
                                minWidth: '200px', 
                                height: '44px',
                                fontSize: '16px'
                            }}
                        >
                            Continue
                        </StyledButton>
                    </div>
                }
                width={420}
                centered
                destroyOnClose
                styles={{
                    content: {
                        background: '#0a1524',
                        border: '1px solid #1a2a3d',
                        borderRadius: '20px',
                        padding: '32px 24px',
                        overflow: 'hidden'
                    },
                    mask: {
                        backgroundColor: 'rgba(5, 10, 18, 0.9)'
                    }
                }}
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'rgba(37, 211, 102, 0.15)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        boxShadow: '0 0 20px rgba(37, 211, 102, 0.2)'
                    }}>
                        <CheckCircleOutlined style={{
                            color: '#25D366',
                            fontSize: '40px'
                        }} />
                    </div>

                    <Title level={3} style={{ 
                        color: '#ffffff', 
                        margin: '0 0 12px',
                        fontSize: '24px',
                        fontWeight: '600'
                    }}>
                        Connected Successfully!
                    </Title>

                    <Text style={{ 
                        color: '#888888', 
                        fontSize: '16px', 
                        display: 'block', 
                        marginBottom: '32px' 
                    }}>
                        Your WhatsApp account is now linked
                    </Text>

                    {connectedInstance && (
                        <div style={{ 
                            background: '#0a1524',
                            borderRadius: '16px',
                            padding: '16px',
                            border: '1px solid #222',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <Avatar
                                size={56}
                                src={connectedInstance.whatsapp.profile}
                                icon={<PhoneOutlined />}
                                style={{
                                    background: '#122033',
                                    border: '2px solid #25D366'
                                }}
                            />
                            <div style={{ textAlign: 'left', flex: 1 }}>
                                <Text strong style={{ 
                                    display: 'block', 
                                    color: '#ffffff', 
                                    fontSize: '16px',
                                    marginBottom: '4px'
                                }}>
                                    {connectedInstance.whatsapp.phone || 'WhatsApp Account'}
                                </Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#25D366' }} />
                                    <Text style={{ color: '#666', fontSize: '14px' }}>Active</Text>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Pairing Code Modal */}
            <Modal
                title={
                    <span style={{ color: '#ffffff', fontSize: '18px' }}>
                        Pairing Code
                    </span>
                }
                open={showPairingModal}
                onCancel={() => setShowPairingModal(false)}
                footer={null}
                centered
                width={500}
                styles={{
                    content: {
                        background: '#0a1524',
                        border: '1px solid #1a2a3d',
                        borderRadius: '12px',
                        padding: '24px'
                    },
                    header: {
                        background: 'transparent',
                        borderBottom: 'none',
                        padding: '0 0 20px 0'
                    },
                    mask: {
                        backgroundColor: 'rgba(5, 10, 18, 0.85)'
                    }
                }}
            >
                {!pairingCode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <Text style={{ color: '#ffffff', marginBottom: '8px', display: 'block' }}>Phone Number</Text>
                            <Input
                                placeholder="9876543210"
                                value={pairingPhoneNumber}
                                onChange={(e) => setPairingPhoneNumber(e.target.value)}
                                addonBefore={
                                    <Select
                                        value={selectedCountryCode}
                                        onChange={setSelectedCountryCode}
                                        style={{ width: 110 }}
                                        bordered={false}
                                        dropdownStyle={{ 
                                            minWidth: '300px'
                                        }}
                                        optionLabelProp="label"
                                        popupMatchSelectWidth={false}
                                        showSearch
                                        filterOption={(input, option) => {
                                            const searchStr = input.toLowerCase()
                                            const name = option.name?.toLowerCase() || ''
                                            const code = option.value?.toString().toLowerCase() || ''
                                            return name.includes(searchStr) || code.includes(searchStr)
                                        }}
                                    >
                                        {countryList.map((country, index) => (
                                            <Option 
                                                key={`${country.code}-${index}`} 
                                                value={country.code} 
                                                name={country.name}
                                                label={
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff' }}>
                                                        <span>{country.flag}</span>
                                                        <span>{country.code}</span>
                                                    </div>
                                                }
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#000000' }}>
                                                    <span style={{ fontSize: '16px' }}>{country.flag}</span>
                                                    <span>{country.name}</span>
                                                    <span style={{ color: '#666', marginLeft: 'auto' }}>{country.code}</span>
                                                </div>
                                            </Option>
                                        ))}
                                    </Select>
                                }
                                style={{
                                    background: '#122033',
                                    borderColor: '#1a2a3d',
                                    color: '#ffffff'
                                }}
                                styles={{
                                    input: { background: '#122033', color: '#ffffff' },
                                    addonBefore: { background: '#2a2a2a', border: '1px solid #1a2a3d', color: '#fff', padding: 0 }
                                }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <StyledButton
                                variant="secondary"
                                onClick={() => setShowPairingModal(false)}
                            >
                                Cancel
                            </StyledButton>
                            <StyledButton
                                variant="primary"
                                onClick={handleRequestPairingCode}
                                loading={isGeneratingPairingCode}
                            >
                                Get Pairing Code
                            </StyledButton>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            background: '#122033',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #1a2a3d'
                        }}>
                            <Text style={{ color: '#ffffff' }}>
                                Linked WhatsApp account: {selectedCountryCode} {pairingPhoneNumber}
                            </Text>
                            <Button 
                                type="text" 
                                icon={<EditOutlined />} 
                                onClick={() => setPairingCode('')}
                                style={{ color: '#ffffff' }}
                            >
                                Edit
                            </Button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                            {/* First 4 characters */}
                            {pairingCode.split('').slice(0, 4).map((char, index) => (
                                <div key={`first-${index}`} style={{
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #1a2a3d',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '20px',
                                    background: '#122033'
                                }}>
                                    {char}
                                </div>
                            ))}
                            
                            {/* Separator */}
                            <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', margin: '0 4px' }}>-</div>

                            {/* Last 4 characters */}
                            {pairingCode.split('').slice(4, 8).map((char, index) => (
                                <div key={`second-${index}`} style={{
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #1a2a3d',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '20px',
                                    background: '#122033'
                                }}>
                                    {char}
                                </div>
                            ))}
                        </div>

                        <div style={{ color: '#aaaaaa', fontSize: '14px', lineHeight: '1.6' }}>
                            <div style={{ marginBottom: '8px' }}>1. Open WhatsApp on your phone</div>
                            <div style={{ marginBottom: '8px' }}>2. Tap Menu on Android or Settings on iPhone</div>
                            <div style={{ marginBottom: '8px' }}>3. Tap Linked devices and then Link Device</div>
                            <div>4. Tap Link with phone number instead and enter this code on your phone</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                             <StyledButton
                                variant="secondary"
                                onClick={() => setShowPairingModal(false)}
                            >
                                Close
                            </StyledButton>
                            <StyledButton
                                variant="primary"
                                onClick={handleRequestPairingCode}
                                loading={isGeneratingPairingCode}
                            >
                                Get New Code
                            </StyledButton>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Edit Modal - Centered */}
            <Modal
                title={<span style={{ color: '#ffffff' }}>Edit Device Name</span>}
                open={showEditDialog}
                onOk={handleEditInstance}
                onCancel={() => {
                    setShowEditDialog(false)
                    setEditInstanceId(null)
                    setEditInstanceName('')
                    setSelectedInstance(null)
                }}
                confirmLoading={isProcessingEdit[editInstanceId]}
                okText="Save Changes"
                okButtonProps={{
                    disabled: !editInstanceName.trim(),
                    style: {
                        background: '#0095FF',
                        borderColor: '#0095FF'
                    }
                }}
                cancelButtonProps={{
                    style: {
                        background: '#122033',
                        borderColor: '#1a2a3d',
                        color: '#ffffff'
                    }
                }}
                centered
                destroyOnClose
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
                        backgroundColor: 'rgba(5, 10, 18, 0.85)'
                    }
                }}
            >
                {selectedInstance && (
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <Avatar
                            size={64}
                            src={selectedInstance.whatsapp.profile}
                            icon={<PhoneOutlined />}
                            style={{
                                marginBottom: '12px',
                                border: `4px solid ${selectedInstance.whatsapp.status === 'connected' ? '#52c41a' : '#ff4d4f'}`,
                                background: '#122033'
                            }}
                        />
                        <Text strong style={{ display: 'block', color: '#ffffff' }}>
                            {selectedInstance.whatsapp.phone || 'WhatsApp Device'}
                        </Text>
                    </div>
                )}

                <div>
                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#ffffff' }}>
                        Instance Name
                    </Text>
                    <Input
                        value={editInstanceName}
                        onChange={(e) => setEditInstanceName(e.target.value)}
                        placeholder="Enter device name"
                        style={{
                            background: '#122033',
                            borderColor: '#1a2a3d',
                            color: '#ffffff'
                        }}
                    />
                </div>
            </Modal>
        </div>
    )
})

export default Connection