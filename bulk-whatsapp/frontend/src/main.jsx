import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import App from './App.jsx'
import './index.css'

const FONT_FAMILY = "'Gilroy', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const theme = {
  token: {
    colorPrimary: '#8b7cf6',
    fontFamily: FONT_FAMILY,
    colorBgBase: '#000d18',
    colorBgContainer: '#0a1524',
    colorBgElevated: '#122033',
    colorText: '#ffffff',
    colorTextSecondary: '#888888',
    colorBorder: '#1a2a3d',
    colorBorderSecondary: '#1a2a3d',
    borderRadius: 8,
  },
  components: {
    Layout: {
      siderBg: '#000d18',
      bodyBg: 'transparent',
      headerBg: '#000d18',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: '#122033',
      darkItemHoverBg: '#122033',
    },
    Card: {
      colorBgContainer: '#0a1524',
    },
    Button: {
      colorPrimary: '#8b7cf6',
      colorPrimaryHover: '#9b8ef7',
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
)
