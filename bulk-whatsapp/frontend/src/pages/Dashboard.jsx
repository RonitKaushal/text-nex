import React, { useState, useEffect, useCallback } from 'react'
import { Row, Col, Card, Typography, Progress, Badge, Button } from 'antd'
import {
  WhatsAppOutlined,
  MessageOutlined,
  SmileOutlined,
  FileTextOutlined,
  GlobalOutlined,
  RobotOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  StopOutlined
} from '@ant-design/icons'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { fetchLocalStatistics } from '../services/localStatistics'

const { Title, Text } = Typography

const EMPTY_STATS = {
  totalMessages: 0,
  connectedInstances: 0,
  disconnectedInstances: 0,
  totalInstances: 0,
  totalTemplates: 0,
  autoReply: 0,
  welcomeMessages: 0,
  totalCampaigns: 0,
  delivered: 0,
  failed: 0,
  pending: 0,
  paused: 0,
  cancelled: 0,
  invalid: 0,
  instanceDisconnected: 0,
}

const Dashboard = () => {
  const { theme } = useTheme()
  const { user } = useAuth()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [countries, setCountries] = useState([])
  const [campaignSummary, setCampaignSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    if (!user) return
    try {
      const result = await fetchLocalStatistics(user)
      if (result?.status && result.statistics) {
        setStats((prev) => ({ ...prev, ...result.statistics }))
        setCountries(result.countries || [])
        setCampaignSummary(result.campaignSummary || null)
      }
    } catch (error) {
      console.error('Error loading local statistics:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 15_000)
    return () => clearInterval(interval)
  }, [loadStats])

  useEffect(() => {
    if (!window.electronAPI?.onCampaignEvent) return undefined
    const unsub = window.electronAPI.onCampaignEvent(() => {
      loadStats()
    })
    return unsub
  }, [loadStats])

  if (loading) {
    return (
      <LoadingSpinner
        message="Loading dashboard..."
        style={{ minHeight: '100vh', background: theme.background }}
      />
    )
  }

  const StatCard = ({ title, icon, children }) => (
    <Card
      style={{
        background: theme.componentBackground,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        height: '100%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      bodyStyle={{ padding: '20px' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
        }}
      >
        <Text style={{ color: theme.text, fontSize: '16px', fontWeight: 600 }}>{title}</Text>
        <div
          style={{
            background: theme.isDarkMode ? '#333' : '#f0f0f0',
            borderRadius: '50%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon, { style: { fontSize: '20px', color: theme.text } })}
        </div>
      </div>
      {children}
    </Card>
  )

  const analyticsList = [
    { label: 'Pending Messages', value: stats.pending, color: '#faad14' },
    { label: 'Delivered Messages', value: stats.delivered, color: '#52c41a' },
    { label: 'Auto Reply Bots', value: stats.autoReply, color: '#8b7cf6' },
    { label: 'Total Bots', value: stats.welcomeMessages, color: '#722ed1' },
    { label: 'Paused Messages', value: stats.paused, color: '#faad14' },
    { label: 'Error While Sending', value: stats.failed, color: '#ff4d4f' },
    { label: 'Invalid Phone Number', value: stats.invalid, color: '#ff4d4f' },
    { label: 'Cancelled Messages', value: stats.cancelled, color: '#faad14' },
    { label: 'Instance Not Connected', value: stats.instanceDisconnected, color: '#ff4d4f' },
  ]

  const maxCountry = countries[0]?.count || 1

  return (
    <div style={{ padding: '0px' }}>
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={2} style={{ color: theme.text, margin: 0, fontSize: '24px' }}>
          Dashboard
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setLoading(true)
            loadStats()
          }}
          style={{ background: theme.componentBackground, borderColor: theme.border, color: theme.text }}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={24} md={12} lg={8} xl={6}>
          <StatCard title="Devices" icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: theme.subText, fontSize: '12px' }}>Total</Text>
                <div style={{ color: theme.text, fontSize: '20px', fontWeight: 'bold' }}>{stats.totalInstances}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: theme.subText, fontSize: '12px' }}>Connected</Text>
                <div style={{ color: '#52c41a', fontSize: '20px', fontWeight: 'bold' }}>{stats.connectedInstances}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: theme.subText, fontSize: '12px' }}>Disconnected</Text>
                <div style={{ color: '#ff4d4f', fontSize: '20px', fontWeight: 'bold' }}>{stats.disconnectedInstances}</div>
              </div>
            </div>
          </StatCard>
        </Col>

        <Col xs={24} sm={12} md={6} lg={8} xl={4}>
          <StatCard title="Active Bots" icon={<RobotOutlined style={{ color: '#8b7cf6' }} />}>
            <div style={{ color: theme.text, fontSize: '28px', fontWeight: 'bold' }}>{stats.autoReply}</div>
          </StatCard>
        </Col>

        <Col xs={24} sm={12} md={6} lg={8} xl={5}>
          <StatCard title="Total Bots" icon={<SmileOutlined style={{ color: '#722ed1' }} />}>
            <div style={{ color: theme.text, fontSize: '28px', fontWeight: 'bold' }}>{stats.welcomeMessages}</div>
          </StatCard>
        </Col>

        <Col xs={24} sm={12} md={12} lg={12} xl={4}>
          <StatCard title="Templates" icon={<FileTextOutlined style={{ color: '#faad14' }} />}>
            <div style={{ color: theme.text, fontSize: '28px', fontWeight: 'bold' }}>{stats.totalTemplates}</div>
          </StatCard>
        </Col>

        <Col xs={24} sm={12} md={12} lg={12} xl={5}>
          <StatCard title="Total Campaigns" icon={<MessageOutlined style={{ color: '#13c2c2' }} />}>
            <div style={{ color: theme.text, fontSize: '28px', fontWeight: 'bold' }}>{stats.totalCampaigns}</div>
          </StatCard>
        </Col>
      </Row>

      {campaignSummary && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          {[
            { label: 'Active', value: campaignSummary.active, icon: <MessageOutlined />, color: '#8b7cf6' },
            { label: 'Completed', value: campaignSummary.completed, icon: <CheckCircleOutlined />, color: '#52c41a' },
            { label: 'Paused', value: campaignSummary.paused, icon: <PauseCircleOutlined />, color: '#faad14' },
            { label: 'Stopped', value: campaignSummary.stopped, icon: <StopOutlined />, color: '#ff4d4f' },
          ].map((item) => (
            <Col xs={12} sm={6} key={item.label}>
              <Card
                size="small"
                style={{
                  background: theme.componentBackground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: item.color, fontSize: 18 }}>{item.icon}</span>
                  <div>
                    <Text style={{ color: theme.subText, fontSize: 12 }}>{item.label} Campaigns</Text>
                    <div style={{ color: theme.text, fontSize: 20, fontWeight: 'bold' }}>{item.value}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ color: theme.text }}>Countries Statistics</span>}
            style={{
              background: theme.componentBackground,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              minHeight: '420px',
            }}
            headStyle={{ borderBottom: `1px solid ${theme.border}` }}
          >
            {countries.length === 0 ? (
              <div
                style={{
                  height: '340px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <GlobalOutlined style={{ fontSize: '48px', color: theme.subText, marginBottom: '12px' }} />
                <Text style={{ color: theme.subText }}>No campaign recipients yet</Text>
                <Text style={{ color: theme.subText, fontSize: '12px' }}>Create a campaign to see country breakdown</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
                {countries.map((c) => (
                  <div key={c.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: theme.text }}>{c.name}</Text>
                      <Text style={{ color: theme.subText }}>{c.count} recipients</Text>
                    </div>
                    <Progress
                      percent={Math.round((c.count / maxCountry) * 100)}
                      showInfo={false}
                      strokeColor="#25D366"
                      trailColor={theme.isDarkMode ? '#333' : '#f0f0f0'}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ color: theme.text }}>Analytics</span>}
            style={{
              background: theme.componentBackground,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              minHeight: '420px',
              overflow: 'hidden',
            }}
            headStyle={{ borderBottom: `1px solid ${theme.border}` }}
            bodyStyle={{ padding: '24px', overflowY: 'auto', maxHeight: '500px' }}
          >
            <div style={{ marginBottom: '24px' }}>
              <Text style={{ color: theme.subText, fontSize: '12px' }}>Total Messages</Text>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.text, marginBottom: '8px' }}>
                {stats.totalMessages}
              </div>
              <Progress percent={stats.totalMessages > 0 ? 100 : 0} showInfo={false} strokeColor="#00b96b" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {analyticsList.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge color={item.color} />
                    <Text style={{ color: theme.text, fontSize: '13px' }}>{item.label}</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text style={{ color: theme.text, fontWeight: 'bold' }}>{item.value}</Text>
                    <Text style={{ color: theme.subText, fontSize: '12px', width: '30px', textAlign: 'right' }}>
                      {stats.totalMessages > 0 ? Math.round((item.value / stats.totalMessages) * 100) : 0}%
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
