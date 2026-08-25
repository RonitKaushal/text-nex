import React from 'react';
import { Result, Button } from 'antd';
import { ReloadOutlined, LoginOutlined } from '@ant-design/icons';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = async () => {
    // Clear storage to fix auth issues
    try {
        if (window.electronAPI) {
            await window.electronAPI.clearToken();
        } else {
            localStorage.clear();
        }
    } catch (e) {
        console.error("Failed to clear token:", e);
        localStorage.clear(); // Fallback
    }
    
    // Force navigation to login using window.location.hash for HashRouter
    // This is safer for Electron apps using HashRouter
    window.location.hash = '#/login';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: '#000' // Dark theme fallback
        }}>
          <Result
            status="500"
            title="Something went wrong"
            subTitle="Sorry, something went wrong. Please log in again."
            extra={
                <Button type="primary" onClick={this.handleReset} icon={<LoginOutlined />}>
                    Back to Login
                </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;