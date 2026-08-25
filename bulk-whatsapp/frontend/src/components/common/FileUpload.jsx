import React, { useCallback, useState } from 'react'
import { Upload, message, Image } from 'antd'
import { 
  UploadOutlined, 
  FileImageOutlined, 
  VideoCameraOutlined, 
  AudioOutlined,
  FileOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import StyledButton from './StyledButton'

const { Dragger } = Upload

const FileUpload = ({
  onUploadSuccess,
  onUploadError,
  onFileRemove,
  accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx',
  maxFileSize = 10, // in MB
  multiple = false,
  showPreview = true,
  customRequest,
  children
}) => {
  const [fileList, setFileList] = useState([])
  const [uploading, setUploading] = useState(false)

  const beforeUpload = (file) => {
    const isLtSize = file.size / 1024 / 1024 < maxFileSize
    if (!isLtSize) {
      message.error(`File must be smaller than ${maxFileSize}MB!`)
      return false
    }
    
    // Check file type
    const allowedTypes = accept.split(',').map(type => type.trim())
    const isAllowedType = allowedTypes.some(type => {
      if (type.startsWith('image/')) return file.type.startsWith('image/')
      if (type.startsWith('video/')) return file.type.startsWith('video/')
      if (type.startsWith('audio/')) return file.type.startsWith('audio/')
      if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase())
      return file.type.includes(type.replace('*', ''))
    })
    
    if (!isAllowedType) {
      message.error('File type not supported!')
      return false
    }
    
    return true
  }

  const handleUpload = useCallback(async (options) => {
    const { file, onSuccess, onError } = options
    
    setUploading(true)
    
    try {
      if (customRequest) {
        // Use custom upload function
        const result = await customRequest(file)
        onSuccess(result, file)
        if (onUploadSuccess) onUploadSuccess(result, file)
      } else {
        // Default upload to a mock endpoint
        // In real implementation, you would send to your backend
        setTimeout(() => {
          const result = {
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
            type: file.type
          }
          onSuccess(result, file)
          if (onUploadSuccess) onUploadSuccess(result, file)
        }, 1500)
      }
    } catch (error) {
      onError(error)
      if (onUploadError) onUploadError(error, file)
      message.error('Upload failed!')
    } finally {
      setUploading(false)
    }
  }, [customRequest, onUploadSuccess, onUploadError])

  const handleChange = ({ fileList: newFileList, file, event }) => {
    setFileList(newFileList)
    
    if (file.status === 'done') {
      message.success(`${file.name} uploaded successfully!`)
    } else if (file.status === 'error') {
      message.error(`${file.name} upload failed.`)
    }
  }

  const handleRemove = (file) => {
    const newFileList = fileList.filter(item => item.uid !== file.uid)
    setFileList(newFileList)
    if (onFileRemove) onFileRemove(file)
    return true
  }

  const getFileIcon = (file) => {
    if (file.type?.startsWith('image/')) {
      return <FileImageOutlined style={{ fontSize: '24px', color: '#8b7cf6' }} />
    } else if (file.type?.startsWith('video/')) {
      return <VideoCameraOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
    } else if (file.type?.startsWith('audio/')) {
      return <AudioOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
    } else {
      return <FileOutlined style={{ fontSize: '24px', color: '#faad14' }} />
    }
  }

  const uploadProps = {
    name: 'file',
    multiple,
    fileList,
    beforeUpload,
    customRequest: handleUpload,
    onChange: handleChange,
    onRemove: handleRemove,
    showUploadList: false,
    accept
  }

  return (
    <div>
      <Dragger {...uploadProps}>
        <div style={{ 
          padding: '40px 20px',
          background: '#122033',
          border: '2px dashed #404040',
          borderRadius: '12px',
          textAlign: 'center',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#8b7cf6'
          e.currentTarget.style.backgroundColor = '#1d1d1d'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#404040'
          e.currentTarget.style.backgroundColor = '#1a1a1a'
        }}
        >
          {uploading ? (
            <div>
              <LoadingOutlined style={{ fontSize: '48px', color: '#8b7cf6', marginBottom: '16px' }} />
              <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: '0' }}>
                Uploading...
              </p>
              <p style={{ color: '#888888', fontSize: '14px', margin: '8px 0 0' }}>
                Please wait while your file is being uploaded
              </p>
            </div>
          ) : (
            <div>
              <UploadOutlined style={{ fontSize: '48px', color: '#888888', marginBottom: '16px' }} />
              <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: '0' }}>
                Click or drag file to this area to upload
              </p>
              <p style={{ color: '#888888', fontSize: '14px', margin: '8px 0 0' }}>
                Support for single or bulk upload. Strictly prohibited from uploading company data or other banned files.
              </p>
              <p style={{ color: '#888888', fontSize: '12px', margin: '8px 0 0' }}>
                Max file size: {maxFileSize}MB
              </p>
            </div>
          )}
        </div>
      </Dragger>

      {/* File Preview List */}
      {showPreview && fileList.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Uploaded Files
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fileList.map((file) => (
              <div
                key={file.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#2a2a2a',
                  border: '1px solid #1a2a3d',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#8b7cf6'
                  e.currentTarget.style.backgroundColor = '#2d2d2d'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#404040'
                  e.currentTarget.style.backgroundColor = '#2a2a2a'
                }}
              >
                <div style={{ marginRight: '12px' }}>
                  {file.type?.startsWith('image/') && (file.response?.url || file.url || file.preview) ? (
                    <Image 
                      src={file.response?.url || file.url || file.preview} 
                      alt={file.name}
                      width={48}
                      height={48}
                      style={{ 
                        objectFit: 'cover', 
                        borderRadius: '4px',
                        border: '1px solid #1a2a3d'
                      }} 
                    />
                  ) : (
                    getFileIcon(file)
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    color: '#ffffff', 
                    fontSize: '14px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '4px'
                  }}>
                    {file.name}
                  </div>
                  <div style={{ 
                    color: '#888888', 
                    fontSize: '12px' 
                  }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {file.status === 'uploading' && (
                    <LoadingOutlined style={{ color: '#8b7cf6' }} />
                  )}
                  {file.status === 'done' && (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
                  {file.status === 'error' && (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <StyledButton
                    variant="danger"
                    size="small"
                    onClick={() => handleRemove(file)}
                  >
                    Remove
                  </StyledButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {children && (
        <div style={{ marginTop: '20px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default FileUpload