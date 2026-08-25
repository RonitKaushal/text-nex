import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Upload, Space, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { fileToDataUrl } from '../../utils/imageFile';
import { ServiceLogo } from './ServiceLogo';
import type { ServiceTab, UpdateServicePayload } from '../../types';

interface EditServiceModalProps {
  open: boolean;
  service: ServiceTab | null;
  isDarkMode?: boolean;
  onCancel: () => void;
  onSave: (id: string, updates: UpdateServicePayload) => void;
}

export function EditServiceModal({
  open,
  service,
  isDarkMode,
  onCancel,
  onSave,
}: EditServiceModalProps) {
  const [form] = Form.useForm();
  const [iconPreview, setIconPreview] = useState<string | undefined>();
  const [iconCleared, setIconCleared] = useState(false);

  useEffect(() => {
    if (open && service) {
      form.setFieldsValue({ serviceName: service.name });
      setIconPreview(service.customIcon);
      setIconCleared(false);
    }
  }, [open, service, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (!service) return;
      const updates: UpdateServicePayload = {
        name: values.serviceName.trim(),
      };
      if (iconCleared) {
        updates.customIcon = '';
      } else if (iconPreview) {
        updates.customIcon = iconPreview;
      }
      onSave(service.id, updates);
      message.success('Service updated');
      onCancel();
    } catch {
      /* validation */
    }
  };

  const inputStyle = {
    background: isDarkMode ? '#1f1f1f' : '#fff',
    borderColor: isDarkMode ? '#434343' : '#d9d9d9',
    color: isDarkMode ? '#fff' : undefined,
  };

  return (
    <Modal
      title="Edit Service"
      open={open}
      onOk={() => void handleOk()}
      onCancel={onCancel}
      okText="Save"
      cancelText="Cancel"
      destroyOnClose
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {iconPreview ? (
          <img
            src={iconPreview}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8 }}
          />
        ) : service ? (
          <ServiceLogo iconType={service.iconType} size={48} />
        ) : null}
        <Space>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              void fileToDataUrl(file).then((data) => {
                setIconPreview(data);
                setIconCleared(false);
              });
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Change icon</Button>
          </Upload>
          {(iconPreview || service?.customIcon) && (
            <Button
              type="link"
              danger
              onClick={() => {
                setIconPreview(undefined);
                setIconCleared(true);
              }}
            >
              Reset icon
            </Button>
          )}
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          name="serviceName"
          label="Service Name"
          rules={[
            { required: true, message: 'Please enter a service name' },
            { max: 50, message: 'Name must be less than 50 characters' },
          ]}
        >
          <Input placeholder="Enter service name" autoFocus style={inputStyle} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
