import fs from 'fs'

const p = 'bulk-whatsapp/frontend/src/pages/Connection.jsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('[searchTerm, setSearchTerm]')) {
  s = s.replace(
    "const [isRenewing, setIsRenewing] = useState(false)",
    "const [isRenewing, setIsRenewing] = useState(false)\n    const [searchTerm, setSearchTerm] = useState('')"
  )
}

if (!s.includes('ReloadOutlined')) {
  s = s.replace(
    `InfoCircleOutlined
} from '@ant-design/icons'`,
    `InfoCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
    FilterOutlined,
    MobileOutlined,
    LinkOutlined
} from '@ant-design/icons'`
  )
}

if (!s.includes('Table,')) {
  s = s.replace(
    `Popconfirm
} from 'antd'`,
    `Popconfirm,
    Table,
    Tag
} from 'antd'`
  )
}

const startMarker = "    return (\n        <div style={{ padding: '0px', background: 'transparent' }}>"
const qrMarker = '            {/* QR Code Modal - Centered */}'
const createMarker = '            {/* Create Instance Modal */}'

const start = s.indexOf(startMarker)
const qr = s.indexOf(qrMarker)
const createModalStart = s.indexOf(createMarker)

if (start < 0 || qr < 0 || createModalStart < 0) {
  console.error('markers', { start, qr, createModalStart })
  process.exit(1)
}

const newMain = `    return (
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
                    const d = String(phone).replace(/\\D/g, '')
                    if (d.length >= 12) return \`+\${d.slice(0, 2)} \${d.slice(2, 7)} \${d.slice(7)}\`
                    if (d.length === 10) return \`+91 \${d.slice(0, 5)} \${d.slice(5)}\`
                    return phone.startsWith('+') ? phone : \`+\${phone}\`
                }
                const lastActiveLabel = (inst) => {
                    if (inst.whatsapp?.status === 'connected') return 'Just now'
                    const t = inst.updatedAt || inst.createdAt
                    if (!t) return '—'
                    const diff = Date.now() - new Date(t).getTime()
                    const mins = Math.floor(diff / 60000)
                    if (mins < 1) return 'Just now'
                    if (mins < 60) return \`\${mins} mins ago\`
                    const hrs = Math.floor(mins / 60)
                    if (hrs < 24) return \`\${hrs}h ago\`
                    return \`\${Math.floor(hrs / 24)}d ago\`
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
                                background: \`\${color}22\`,
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
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 8,
                                                            background: \`\${color}22\`, color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            <MobileOutlined />
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#fff', fontWeight: 600 }}>{name || 'Device'}</div>
                                                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                                                                {record.whatsapp?.status === 'connected' ? 'Primary Device' : 'WhatsApp Device'}
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
                                                return (
                                                    <Space size={6}>
                                                        <Button
                                                            size="small"
                                                            icon={<QrcodeOutlined />}
                                                            loading={!!isProcessingQR[id]}
                                                            onClick={() => handleShowQR(id)}
                                                            disabled={on}
                                                            style={{
                                                                background: '#122033',
                                                                borderColor: '#1a2a3d',
                                                                color: '#0095FF',
                                                            }}
                                                        />
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
                                                        ) : (
                                                            <Button
                                                                size="small"
                                                                icon={<LinkOutlined />}
                                                                onClick={() => {
                                                                    if (record.loginType === 'PAIRING') openPairingModal(id)
                                                                    else handleShowQR(id)
                                                                }}
                                                                style={{
                                                                    background: '#122033',
                                                                    borderColor: '#1a2a3d',
                                                                    color: 'rgba(255,255,255,0.55)',
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

`

const createToQr = s.slice(createModalStart, qr)
const afterList = s.slice(qr)
const rebuilt = s.slice(0, start) + newMain + createToQr + afterList
fs.writeFileSync(p, rebuilt)
console.log('OK', rebuilt.length)
