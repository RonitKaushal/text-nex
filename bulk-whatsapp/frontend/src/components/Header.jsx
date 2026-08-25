import React, { useState } from 'react';
import { Layout, Button, Typography, Avatar, Modal, Input, message } from 'antd';
import { UserOutlined, ReloadOutlined, KeyOutlined, CalendarOutlined } from '@ant-design/icons';
import AppBrand from './common/AppBrand';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = () => {
  const { theme } = useTheme();
  const { user, login, updateUser } = useAuth();
  const [renewVisible, setRenewVisible] = useState(false);
  const [renewKey, setRenewKey] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = () => {
    if (window.electronAPI) {
      setCheckingUpdate(true);
      window.electronAPI.checkForUpdates();
      // Reset loading after 3s (events are handled globally in App.jsx)
      setTimeout(() => setCheckingUpdate(false), 3000);
    } else {
      message.info('Update check is only available in desktop app');
    }
  };

  // Calculate expiry display and status
  const isExpired = user?.licenseExpiry ? new Date(user.licenseExpiry) < new Date() : true;
  const expiryDate = user?.licenseExpiry ? new Date(user.licenseExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const statusColor = isExpired ? 'red' : 'green';

  const boxStyle = {
    border: `1px solid ${theme.border}`,
    padding: '4px 12px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    height: '32px',
    backgroundColor: theme.panel || '#0a1524'
  };

  return (
    <AntHeader style={{ 
      background: theme.headerBackground || 'rgba(10, 21, 36, 0.72)', 
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: '0 24px', 
      borderBottom: `1px solid ${theme.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '52px',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      width: '100%'
    }}>
      <AppBrand />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
         
         {/* Version */}
         <div style={boxStyle}>
            <Text style={{ color: theme.subText, fontSize: '12px' }}>v6.0.0</Text>
         </div>

         {/* Check Update */}
         <Button 
            icon={<ReloadOutlined spin={checkingUpdate} />} 
            onClick={handleCheckUpdate}
            loading={checkingUpdate}
            style={{ 
                background: 'transparent', 
                color: theme.text, 
                borderColor: theme.border,
                display: 'flex',
                alignItems: 'center'
            }}
         >
            Check update
         </Button>

         {/* Expiry Date */}
         <div style={{ ...boxStyle, borderColor: statusColor }}>
             <CalendarOutlined style={{ color: statusColor, marginRight: '8px' }} />
             <Text style={{ color: statusColor }}>
                {expiryDate}
             </Text>
         </div>

         {/* Renew Button */}
           <Button 
              type="primary" 
              icon={<KeyOutlined />}
              style={{ 
                  backgroundColor: '#0095ff', 
                  borderColor: '#0095ff',
                  display: 'flex',
                  alignItems: 'center'
              }}
              onClick={() => setRenewVisible(true)}
           >
              Renew
           </Button>
      

         {/* User Profile */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#bfbfbf' }} />
            <Text style={{ color: theme.subText }}>{user?.name || 'User'}</Text>
         </div>
      </div>

      <Modal
        title={<span style={{ color: '#ffffff' }}>Renew License</span>}
        open={renewVisible}
        onCancel={() => setRenewVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRenewVisible(false)} style={{ background: 'transparent', color: theme.text, borderColor: theme.border }}>Cancel</Button>,
          <Button key="renew" type="primary" loading={renewLoading} onClick={async () => {
            if (!renewKey.trim()) {
              message.error('Please enter a license key');
              return;
            }
            setRenewLoading(true);
            try {
              const response = await api.post('/user/renew-license', {
                licenseKey: renewKey.trim(),
                appType: 'bulk-whatsapp',
              });
              
              if (response.data && (response.data.success || response.data.status)) {
                const newExpiry = response.data.licenseExpiry;
                message.success(`License renewed successfully! New expiry: ${new Date(newExpiry).toLocaleDateString()}`);
                
                if (updateUser) {
                  await updateUser({ 
                    licenseExpiry: newExpiry,
                    isActive: true 
                  });
                }
                
                setRenewVisible(false);
                setRenewKey('');
              } else {
                message.error(response.data?.message || 'Failed to renew license');
              }
            } catch (e) {
              message.error(e.response?.data?.message || e.message || 'Failed to renew license');
            } finally {
              setRenewLoading(false);
            }
          }}>Renew</Button>
        ]}
        centered
        styles={{
          content: {
            background: '#0a1524',
            border: '1px solid #1a2a3d',
            borderRadius: '12px'
          },
          header: {
            background: 'transparent',
            borderBottom: 'none'
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)'
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <Text style={{ color: '#ff4d4f', marginRight: 4 }}>*</Text>
            <Text style={{ color: '#ffffff' }}>Renew License Key</Text>
            <Input
              placeholder="Renew License Key"
              value={renewKey}
              onChange={(e) => setRenewKey(e.target.value)}
              style={{
                marginTop: 8,
                background: '#122033',
                borderColor: '#1a2a3d',
                color: '#ffffff'
              }}
            />
          </div>
          <div style={{ color: '#bfbfbf', fontSize: 12, lineHeight: 1.6 }}>
            <div>RENEW YOUR BUTTON SENDER SUBSCRIPTION BEFORE IT EXPIRES</div>
            <div>GET 30 DAYS FREE ON 1 YEAR SUBSCRIPTION</div>
            <div>GET 9 DAYS FREE ON 3 MONTHS SUBSCRIPTION</div>
            <div>GET 3 DAYS FREE ON 1 MONTH SUBSCRIPTION</div>
            <a href="https://example.com/buy" target="_blank" rel="noreferrer" style={{ color: '#0095ff' }}>Buy Now</a>
          </div>
        </div>
      </Modal>
    </AntHeader>
  );
};

export default Header;
