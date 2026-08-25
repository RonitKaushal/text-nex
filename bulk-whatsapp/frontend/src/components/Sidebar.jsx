import React from 'react'
import { Layout, Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  HomeOutlined,
  MobileOutlined,
  SendOutlined,
  FileTextOutlined,
  CommentOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useTheme } from '../context/ThemeContext'

const { Sider } = Layout

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()

  const menuItems = [
    { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/connection', icon: <MobileOutlined />, label: 'Devices' },
    { key: '/campaign', icon: <SendOutlined />, label: 'Send Message' },
    { key: '/messaging', icon: <MessageOutlined />, label: 'Message' },
    { key: '/templates', icon: <FileTextOutlined />, label: 'Templates' },
    { key: '/received-messages', icon: <CommentOutlined />, label: 'Received Messages' },
  ]

  const selectedKey = location.pathname.startsWith('/templates')
    ? '/templates'
    : location.pathname

  return (
    <Sider
      width={72}
      collapsedWidth={72}
      collapsed
      collapsible={false}
      trigger={null}
      style={{
        background: theme.sidebarBackground,
        borderRight: `1px solid ${theme.border}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: '0 0 72px',
        maxWidth: 72,
        minWidth: 72,
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 12, paddingBottom: 8 }}>
        <Menu
          theme="dark"
          mode="inline"
          inlineCollapsed
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            border: 'none',
          }}
          className="bulk-sidebar-menu"
        />
      </div>
    </Sider>
  )
}

export default Sidebar
