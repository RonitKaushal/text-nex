import React, { useState, useEffect, useCallback } from 'react';
import { Table, Typography, Input, Select, Button, Modal, Space, notification, Avatar } from 'antd';
import { SearchOutlined, ExportOutlined, DeleteOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import { getAllInstances } from '../services/instanceStorage';
import { useAuth } from '../context/AuthContext';
import StyledButton from '../components/common/StyledButton';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import './ReceivedMessages.css';

const { Title } = Typography;
const { Option } = Select;

const ReceivedMessages = () => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', instanceId: '', country: '', sortBy: 'newest' });
  const [instances, setInstances] = useState([]);
  const [previewMessage, setPreviewMessage] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // const { on, off } = useSocket({ token }); // Socket handled in App.jsx now

  const fetchMessages = useCallback(async (page = 1) => {
    // Only fetch if instance is selected and user is available
    if (!filters.instanceId || !user) {
        setMessages([]);
        setPagination(prev => ({ ...prev, current: 1, total: 0 }));
        return;
    }

    setLoading(true);
    try {
      // Use Electron API if available
      if (window.electronAPI) {
        const result = await window.electronAPI.getMessages({
          userId: user._id || user.id, // Ensure we handle both id formats
          instanceId: filters.instanceId,
          page,
          limit: pagination.pageSize,
          search: filters.search
        });

        if (result.success) {
          setMessages(result.data);
          setPagination(prev => ({ ...prev, current: page, total: result.total }));
        }
      } else {
        // Fallback or legacy API support if needed, but user requested Electron Store
        console.warn('Electron API not found. Messages are only available in Desktop App.');
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, filters, user]);

  const fetchInstances = async () => {
    try {
        const fetchedInstances = await getAllInstances(user, { migrate: false });
        setInstances(fetchedInstances);

        if (fetchedInstances.length > 0 && !filters.instanceId) {
            setFilters(prev => ({ ...prev, instanceId: fetchedInstances[0]._id }));
        }
    } catch (error) {
        console.error('Error fetching instances:', error);
    }
  };

  const handleClearAll = () => {
    if (!filters.instanceId) {
        notification.error({
            message: 'Error',
            description: 'Please select an instance first to clear messages.'
        });
        return;
    }
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
        setLoading(true);
        if (window.electronAPI && user) {
            const result = await window.electronAPI.clearMessages({
                userId: user._id || user.id,
                instanceId: filters.instanceId
            });

            if (result.success) {
                notification.success({
                    message: 'Success',
                    description: 'Messages deleted successfully'
                });
                fetchMessages(1);
                setIsDeleteModalOpen(false);
            } else {
                notification.error({
                    message: 'Error',
                    description: result.error || 'Failed to delete messages'
                });
            }
        } else {
            notification.error({
                message: 'Error',
                description: 'Delete function is only available in Desktop App'
            });
        }
    } catch (error) {
        notification.error({
            message: 'Error',
            description: error.message || 'Failed to delete messages'
        });
    } finally {
        setLoading(false);
        setIsDeleteModalOpen(false);
    }
  };

  const handleExport = async () => {
    try {
        setLoading(true);
        if (window.electronAPI && user && filters.instanceId) {
            const limit = pagination.total > 0 ? pagination.total : 1000;
            const result = await window.electronAPI.getMessages({
                userId: user._id || user.id,
                instanceId: filters.instanceId,
                page: 1,
                limit: limit,
                search: filters.search
            });

            if (result.success && result.data) {
                const exportData = result.data.map((msg, index) => ({
                    'sr_no': index + 1,
                    'name': msg.pushName || '-',
                    'number': msg.from,
                    'instance': instances.find(i => i._id === msg.instance_id)?.name || 'Unknown',
                    'instance_number': msg.to,
                    'message': msg.message,
                    'received_at': dayjs(msg.timestamp).format('DD MMM YYYY hh:mm A')
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Received Messages");
                XLSX.writeFile(wb, `Received Message ${dayjs().format('DD-MM-YYYY')}.xlsx`);
                
                notification.success({
                    message: 'Success',
                    description: 'Messages exported successfully'
                });
            } else {
                 notification.error({
                    message: 'Error',
                    description: 'Failed to fetch data for export'
                });
            }
        }
    } catch (error) {
        console.error('Export error:', error);
        notification.error({
            message: 'Error',
            description: 'Failed to export messages'
        });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const handleMessageSaved = (event) => {
        const newMessage = event.detail;
        // Refresh list if the message belongs to the currently selected instance
        if (newMessage && newMessage.instance_id === filters.instanceId) {
             fetchMessages(1);
        }
    };

    window.addEventListener('message-saved', handleMessageSaved);

    return () => {
        window.removeEventListener('message-saved', handleMessageSaved);
    }
  }, [fetchMessages, filters.instanceId]);

  const columns = [
    {
      title: 'SN',
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
      width: 60,
    },
    {
      title: 'DP',
      dataIndex: 'profilePicUrl',
      key: 'profilePicUrl',
      width: 60,
      render: (url) => (
        <Avatar 
          src={url} 
          icon={<UserOutlined />} 
          size="large"
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'pushName',
      key: 'pushName',
      render: (text) => text || '-',
    },
    {
      title: 'Number',
      dataIndex: 'from',
      key: 'from',
    },
    {
        title: 'Instance',
        key: 'instance',
        render: (_, record) => {
            const instance = instances.find(i => i._id === record.instance_id);
            return instance ? instance.name : (record.instance_id || 'Unknown');
        }
    },
    {
        title: 'Instance Number',
        dataIndex: 'to',
        key: 'to',
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
        title: 'Preview',
        key: 'preview',
        render: (_, record) => (
            <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => setPreviewMessage(record)}
            >
                Preview
            </Button>
        )
    },
    {
      title: 'Received At',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text) => dayjs(text).format('DD MMM YYYY hh:mm A'),
    },
  ];

  return (
    <div className="received-messages-page" style={{ padding: '24px', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: 12, flexWrap: 'wrap' }}>
        <Title level={2} style={{ color: '#fff', margin: 0 }}>Received Message Report</Title>
        <Space>
            <StyledButton
                variant="danger"
                size="middle"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
            >
                Clear All
            </StyledButton>
            <StyledButton
                variant="primary"
                size="middle"
                icon={<ExportOutlined />}
                onClick={handleExport}
            >
                Export
            </StyledButton>
        </Space>
      </div>

      <div style={{ background: '#0a1524', padding: '24px', borderRadius: '12px', border: '1px solid #1a2a3d' }}>
        <Space style={{ marginBottom: '16px', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Input 
                placeholder="Search..." 
                prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />} 
                style={{ width: 300, background: '#122033', border: '1px solid #1a2a3d', color: '#fff', borderRadius: 8 }}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                allowClear
            />
            <Space>
                <Select 
                    placeholder="Instance" 
                    style={{ width: 200 }}
                    allowClear
                    value={filters.instanceId}
                    onChange={(val) => setFilters(prev => ({ ...prev, instanceId: val }))}
                    className="custom-select"
                >
                    {instances.map(inst => (
                        <Option key={inst._id} value={inst._id}>{inst.name}</Option>
                    ))}
                </Select>
            </Space>
        </Space>

        <Table
            columns={columns}
            dataSource={messages}
            rowKey="_id"
            pagination={{
                ...pagination,
                onChange: (page) => fetchMessages(page),
                showTotal: (total) => `Total ${total} items`,
                showSizeChanger: false
            }}
            loading={loading}
            scroll={{ x: true }}
            style={{ marginTop: '16px' }}
        />
      </div>

      <Modal
        title={<span style={{ color: '#fff' }}>Clear All Messages</span>}
        open={isDeleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText="Yes, Delete"
        okType="danger"
        cancelText="Cancel"
        centered
        styles={{
            content: {
              background: '#0a1524',
              border: '1px solid #1a2a3d',
              borderRadius: '20px',
              padding: '32px 24px',
              overflow: 'hidden'
            },
            header: {
                background: 'transparent',
                marginBottom: '16px'
            },
            mask: {
              backgroundColor: 'rgba(5, 10, 18, 0.9)'
            }
        }}
      >
        <p style={{ color: '#ccc' }}>Are you sure you want to delete all messages for the selected instance? This action cannot be undone.</p>
      </Modal>

      <Modal
        title="Message Details"
        open={!!previewMessage}
        onCancel={() => setPreviewMessage(null)}
        footer={null}
        centered
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
        {previewMessage && (
            <div style={{ color: '#fff' }}>
                <p><strong>From:</strong> {previewMessage.from} ({previewMessage.pushName})</p>
                <p><strong>To:</strong> {previewMessage.to}</p>
                <p><strong>Message:</strong></p>
                <div style={{ background: '#122033', padding: '10px', borderRadius: '8px', color: '#fff', border: '1px solid #1a2a3d' }}>
                    {previewMessage.message}
                </div>
                <p style={{ marginTop: '10px' }}><small>{dayjs(previewMessage.timestamp).format('YYYY-MM-DD HH:mm:ss')}</small></p>
            </div>
        )}
      </Modal>
    </div>
  );
};

export default ReceivedMessages;
