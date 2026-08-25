import React, { useState } from 'react'
import { 
  Input, 
  Modal, 
  Typography,
  Space,
  Table,
  Form,
  message,
  Card,
  Alert,
  Upload,
  Select,
  Row,
  Col,
  Button,
  Pagination,
  Popconfirm,
  Tabs,
  InputNumber,
  Checkbox
} from 'antd'
import { 
  UploadOutlined, 
  UsergroupAddOutlined, 
  DeleteOutlined, 
  PlusOutlined, 
  FileTextOutlined, 
  ClearOutlined, 
  DownloadOutlined, 
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
  NumberOutlined
} from '@ant-design/icons'
import StyledButton from '../common/StyledButton'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography
const { Dragger } = Upload
const { Option } = Select

const SelectAudience = ({
  antdContacts,
  setAntdContacts,
  recipients,
  setRecipients,
  showToast: toast
}) => {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [contactForm] = Form.useForm()
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [numVariables, setNumVariables] = useState(10)
  const [tempNumVariables, setTempNumVariables] = useState(10)
  
  // Settings Modal & Generator States
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [genStartNumber, setGenStartNumber] = useState('')
  const [genCount, setGenCount] = useState(10)
  const [genNamePrefix, setGenNamePrefix] = useState('User')

  // Excel import states
  const [excelData, setExcelData] = useState([])
  const [excelHeaders, setExcelHeaders] = useState([])
  const [isExcelDataLoaded, setIsExcelDataLoaded] = useState(false)
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [columnMappings, setColumnMappings] = useState({
    name: '',
    phone: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12
  const maxFields = 32

  const handleGenerateNumbers = () => {
    if (!genStartNumber) {
      toast.error('Please enter a start number')
      return
    }
    if (genCount < 1) {
      toast.error('Count must be at least 1')
      return
    }

    const newContacts = Array.from({ length: genCount }, (_, i) => {
      return {
        key: (Date.now() + i).toString(),
        sn: antdContacts.length + i + 1,
        name: `${genNamePrefix} ${i + 1}`,
        number: genStartNumber,
        ...Object.fromEntries(
          Array.from({ length: numVariables }, (_, j) => [`var${j + 1}`, ''])
        )
      }
    })

    const updatedContacts = [...antdContacts, ...newContacts]
    setAntdContacts(updatedContacts)

    const updatedRecipients = updatedContacts.map(contact => ({
      phone: contact.number,
      name: contact.name,
      variables: Object.fromEntries(
        Array.from({ length: numVariables }, (_, i) => [
          `var${i + 1}`,
          contact[`var${i + 1}`] || ''
        ])
      )
    }))
    setRecipients(updatedRecipients)
    
    message.success(`Generated ${genCount} numbers successfully`)
    setIsSettingsModalOpen(false)
  }

  // Handle Excel Import - Direct to column mapping
  const handleExcelImport = (file) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload a valid Excel or CSV file')
      return false
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        let jsonData
        
        if (file.name.endsWith('.csv')) {
          const text = data
          const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()))
          jsonData = rows.filter(row => row.some(cell => cell))
        } else {
          const workbook = XLSX.read(data, { type: file.name.endsWith('.csv') ? 'string' : 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false })
        }

        if (jsonData.length === 0) {
          toast.error('The uploaded file is empty')
          return
        }

        const headers = jsonData[0].map((header, idx) => header || `Column ${idx + 1}`)
        setExcelHeaders(headers)

        // Determine number of variables based on headers (excluding name and phone)
        const maxVars = Math.min(Math.max(headers.length - 2, 10), 30)
        const initialMappings = {
          name: '',
          phone: '',
          ...Object.fromEntries(
            Array.from({ length: maxVars }, (_, idx) => [`var${idx + 1}`, ''])
          )
        }
        setColumnMappings(initialMappings)

        const rows = jsonData.slice(1).map((row) =>
          row.reduce((obj, value, idx) => {
            obj[headers[idx]] = value?.toString() || ''
            return obj
          }, {})
        )

        setExcelData(rows)
        setIsExcelDataLoaded(true)
        setShowColumnMapping(true)
        setCurrentPage(1)

        // Update numVariables in parent component
        setNumVariables(maxVars)

        // Auto-map columns
        handleAutoMap(headers, initialMappings)

        // Warn if columns were truncated
        if (headers.length - 2 > 30) {
          toast.warning(`Excel file has ${headers.length} columns, but only the first 30 variables (plus name and phone) can be mapped.`)
        }
      } catch (err) {
        toast.error('Error parsing file: The file may be corrupted or in an unsupported format.')
        console.error(err)
      }
    }

    reader.onerror = () => {
      toast.error('Error reading the file')
    }

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }

    return false // Prevent upload
  }

  const handleColumnMappingChange = (field, header) => {
    setColumnMappings(prev => ({ ...prev, [field]: header === 'none' ? '' : header }))
  }

  // Auto mapping function
  const handleAutoMap = (headers = excelHeaders, mappings = columnMappings) => {
    const newMappings = { ...mappings }
    
    // Common patterns for name fields
    const namePatterns = [
      /^name$/i,
      /^full.?name$/i,
      /^customer.?name$/i,
      /^contact.?name$/i,
      /^person.?name$/i,
      /^user.?name$/i,
      /^client.?name$/i,
      /^first.?name$/i,
      /^naam$/i,
      /^नाम$/i
    ]

    // Common patterns for phone fields
    const phonePatterns = [
      /^phone$/i,
      /^mobile$/i,
      /^number$/i,
      /^phone.?number$/i,
      /^mobile.?number$/i,
      /^contact.?number$/i,
      /^whatsapp$/i,
      /^whatsapp.?number$/i,
      /^cell$/i,
      /^telephone$/i,
      /^tel$/i,
      /^mob$/i,
      /^फोन$/i,
      /^मोबाइल$/i
    ]

    // Auto-map name field
    for (const header of headers) {
      if (namePatterns.some(pattern => pattern.test(header))) {
        newMappings.name = header
        break
      }
    }

    // Auto-map phone field
    for (const header of headers) {
      if (phonePatterns.some(pattern => pattern.test(header))) {
        newMappings.phone = header
        break
      }
    }

    // Auto-map variable fields based on common patterns
    const variablePatterns = [
      /^var\d+$/i,
      /^variable\d+$/i,
      /^field\d+$/i,
      /^custom\d+$/i,
      /^data\d+$/i,
      /^value\d+$/i,
      /^param\d+$/i,
      /^attr\d+$/i,
      /^property\d+$/i,
      /^extra\d+$/i
    ]

    // Get remaining headers (not used for name/phone)
    const remainingHeaders = headers.filter(header => 
      header !== newMappings.name && header !== newMappings.phone
    )

    // Map variables in order
    let varIndex = 1
    for (const header of remainingHeaders) {
      if (varIndex > 30) break // Max 30 variables
      
      const varKey = `var${varIndex}`
      if (varKey in newMappings) {
        // Check if it matches variable patterns or just assign in order
        const isVariablePattern = variablePatterns.some(pattern => pattern.test(header))
        if (isVariablePattern || !newMappings[varKey]) {
          newMappings[varKey] = header
          varIndex++
        }
      }
    }

    // If no specific variable patterns found, just map remaining headers in order
    if (varIndex === 1) {
      for (const header of remainingHeaders) {
        if (varIndex > 30) break
        const varKey = `var${varIndex}`
        if (varKey in newMappings && !newMappings[varKey]) {
          newMappings[varKey] = header
          varIndex++
        }
      }
    }

    setColumnMappings(newMappings)
    
    // Show success message with mapping summary
    const mappedCount = Object.values(newMappings).filter(value => value !== '').length
    toast.success(`Auto-mapped ${mappedCount} columns successfully!`)
  }

  const handleImportRecipients = () => {
    if (!columnMappings.name || !columnMappings.phone) {
      toast.error('Please map both Name and Phone columns')
      return
    }

    const numVars = Object.keys(columnMappings).filter(key => key.startsWith('var')).length
    const newContacts = excelData.map((row, index) => {
      const contact = {
        key: (Date.now() + index).toString(),
        sn: antdContacts.length + index + 1,
        name: row[columnMappings.name] || '',
        number: row[columnMappings.phone] || '',
      }

      // Add variables dynamically
      Object.keys(columnMappings).forEach((key) => {
        if (key.startsWith('var') && columnMappings[key]) {
          contact[key] = row[columnMappings[key]] || ''
        }
      })

      return contact
    }).filter(contact => contact.name && contact.number)

    const updatedContacts = [...antdContacts, ...newContacts]
    setAntdContacts(updatedContacts)
    
    // Update recipients state
    const updatedRecipients = updatedContacts.map(contact => ({
      phone: contact.number,
      name: contact.name,
      variables: Object.fromEntries(
        Array.from({ length: numVars }, (_, i) => [
          `var${i + 1}`,
          contact[`var${i + 1}`] || ''
        ])
      )
    }))
    setRecipients(updatedRecipients)
    
    // Reset modal state
    handleClose()
    message.success('Contacts imported successfully')
  }

  const handleClose = () => {
    setIsImportDialogOpen(false)
    setExcelData([])
    setExcelHeaders([])
    setIsExcelDataLoaded(false)
    setShowColumnMapping(false)
    setColumnMappings({ name: '', phone: '' })
    setCurrentPage(1)
  }

  // Pagination logic for column mapping
  const allFields = ['name', 'phone', ...Object.keys(columnMappings).filter(field => field.startsWith('var'))]
  const totalPages = Math.ceil(allFields.length / itemsPerPage)
  const paginatedFields = currentPage === 1
    ? allFields.slice(0, Math.min(itemsPerPage, allFields.length))
    : allFields.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Handle inline editing for any field
  const handleSaveField = (key, field, newValue) => {
    const updatedContacts = antdContacts.map(contact =>
      contact.key === key ? { ...contact, [field]: newValue } : contact
    )
    setAntdContacts(updatedContacts)

    const updatedRecipients = updatedContacts.map(contact => ({
      phone: contact.number,
      name: contact.name,
      variables: Object.fromEntries(
        Array.from({ length: numVariables }, (_, i) => [
          `var${i + 1}`,
          contact[`var${i + 1}`] || ''
        ])
      )
    }))
    setRecipients(updatedRecipients)
    message.success(`${field === 'name' ? 'Name' : field === 'number' ? 'Number' : field.toUpperCase()} updated successfully`)
  }

  // Start editing a cell
  const startEditing = (record, field) => {
    setEditingCell({ key: record.key, field })
    setEditValue(record[field] || '')
  }

  // Save the edited value
  const saveEdit = () => {
    if (editingCell) {
      handleSaveField(editingCell.key, editingCell.field, editValue)
      setEditingCell(null)
      setEditValue('')
    }
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // Generic function to create editable cell
  const createEditableCell = (field, placeholder) => {
    return {
      render: (text, record) => {
        const isEditing = editingCell?.key === record.key && editingCell?.field === field

        if (isEditing) {
          return (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveEdit()
                }
                if (e.key === 'Escape') {
                  cancelEdit()
                }
              }}
              placeholder={placeholder}
              autoFocus
              style={{
                background: '#122033',
                borderColor: '#1a2a3d',
                color: '#ffffff'
              }}
            />
          )
        }

        return (
          <div
            onClick={() => startEditing(record, field)}
            style={{
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              transition: 'background-color 0.3s',
              minHeight: '32px',
              display: 'flex',
              alignItems: 'center',
              color: text ? '#ffffff' : '#888888',
              fontStyle: text ? 'normal' : 'italic',
              backgroundColor: '#0a1524',
              width: '100%',
              position: 'relative',
              zIndex: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#122033' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0a1524' }}
            title="Click to edit"
          >
            {text || placeholder}
          </div>
        )
      },
    }
  }

  // Table Columns
  const columns = [
    {
      title: 'SN',
      key: 'sn',
      width: 60,
      fixed: 'left',
      render: (_, __, index) => (
        <Text style={{ color: '#ffffff' }}>{index + 1}</Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      fixed: 'left',
      ...createEditableCell('name', 'Enter name'),
    },
    {
      title: 'Number',
      dataIndex: 'number',
      key: 'number',
      width: 150,
      fixed: 'left',
      ...createEditableCell('number', 'Enter phone number'),
    },
    ...Array.from({ length: numVariables }, (_, index) => ({
      title: `Variable ${index + 1}`,
      dataIndex: `var${index + 1}`,
      key: `var${index + 1}`,
      width: 120,
      ...createEditableCell(`var${index + 1}`, `Enter variable ${index + 1}`),
    })),
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Delete Contact"
          description="Are you sure you want to delete this contact?"
          onConfirm={() => handleContactDelete(record.key)}
          okText="Yes, Delete"
          cancelText="Cancel"
          okButtonProps={{ 
            style: { 
              background: '#ff4d4f', 
              borderColor: '#ff4d4f',
              color: '#ffffff'
            } 
          }}
          cancelButtonProps={{
            style: {
              background: '#122033',
              borderColor: '#1a2a3d',
              color: '#ffffff'
            }
          }}
          placement="topRight"
        >
          <StyledButton
            variant="danger"
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      ),
    },
    {
      title: 'Setting',
      width: 70,
      fixed: 'right',
      render: () => (
        <StyledButton
          variant="primary"
          icon={<SettingOutlined />}
          size="small"
          onClick={() => {
            setTempNumVariables(numVariables)
            setIsSettingsModalOpen(true)
          }}
        />
      ),
    }
  ]

  // Handle downloading sample Excel file
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        name: 'John Doe',
        number: '+12025550123',
        ...Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            `Sample${i + 1}`
          ])
        )
      },
      {
        name: 'Jane Smith',
        number: '+919876543210',
        ...Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            `Sample${i + 1}`
          ])
        )
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(sampleData)
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      ...Array.from({ length: numVariables }, () => ({ wch: 15 })),
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    XLSX.writeFile(workbook, 'Sample_Contacts.xlsx')
    message.success('Sample Excel file downloaded successfully')
    setIsDownloadDialogOpen(false)
  }

  // Handle downloading sample CSV file
  const handleDownloadSampleCSV = () => {
    const headers = ['name', 'number', ...Array.from({ length: numVariables }, (_, i) => `var${i + 1}`)]
    const sampleData = [
      [
        'John Doe',
        '+12025550123',
        ...Array.from({ length: numVariables }, (_, i) => `Sample${i + 1}`),
      ],
      [
        'Jane Smith',
        '+919876543210',
        ...Array.from({ length: numVariables }, (_, i) => `Sample${i + 1}`),
      ],
    ]

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'Sample_Contacts.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Sample CSV file downloaded successfully')
    setIsDownloadDialogOpen(false)
  }

  const handleContactAdd = () => {
    contactForm.resetFields()
    contactForm.setFieldsValue({ numVariables: numVariables })
    setIsContactDialogOpen(true)
  }

  const handleContactDelete = (key) => {
    setAntdContacts(antdContacts.filter(contact => contact.key !== key))
    message.success('Contact deleted successfully')

    const updatedRecipients = antdContacts
      .filter(contact => contact.key !== key)
      .map(contact => ({
        phone: contact.number,
        name: contact.name,
        variables: Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            contact[`var${i + 1}`] || ''
          ])
        )
      }))
    setRecipients(updatedRecipients)
  }

  const handleContactSubmit = async () => {
    try {
      const values = await contactForm.validateFields()
      const newContact = {
        ...values,
        key: Date.now().toString(),
        sn: antdContacts.length + 1,
      }
      const updatedContacts = [...antdContacts, newContact]
      setAntdContacts(updatedContacts)
      message.success('Contact added successfully')

      const updatedRecipients = updatedContacts.map(contact => ({
        phone: contact.number,
        name: contact.name,
        variables: Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            contact[`var${i + 1}`] || ''
          ])
        )
      }))
      setRecipients(updatedRecipients)

      setIsContactDialogOpen(false)
      contactForm.resetFields()
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const handleRemoveDuplicates = () => {
    const seenPhones = new Set()
    const uniqueContacts = antdContacts.filter((contact) => {
      if (!contact.number) return false
      if (seenPhones.has(contact.number)) return false
      seenPhones.add(contact.number)
      return true
    })

    if (uniqueContacts.length === antdContacts.length) {
      message.info('No duplicate phone numbers found.')
    } else {
      setAntdContacts(uniqueContacts)
      message.success(`Removed ${antdContacts.length - uniqueContacts.length} duplicate contacts.`)

      const updatedRecipients = uniqueContacts.map(contact => ({
        phone: contact.number,
        name: contact.name,
        variables: Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            contact[`var${i + 1}`] || ''
          ])
        )
      }))
      setRecipients(updatedRecipients)
    }
  }

  const handleCleanNumbers = () => {
    let cleanedCount = 0
    const cleanedContacts = antdContacts.map(contact => {
      if (contact.number && contact.number.includes(' ')) {
        cleanedCount++
        return {
          ...contact,
          number: contact.number.replace(/\s+/g, '')
        }
      }
      return contact
    })

    if (cleanedCount === 0) {
      message.info('No phone numbers with spaces found.')
    } else {
      setAntdContacts(cleanedContacts)
      message.success(`Cleaned ${cleanedCount} phone numbers by removing spaces.`)

      const updatedRecipients = cleanedContacts.map(contact => ({
        phone: contact.number,
        name: contact.name,
        variables: Object.fromEntries(
          Array.from({ length: numVariables }, (_, i) => [
            `var${i + 1}`,
            contact[`var${i + 1}`] || ''
          ])
        )
      }))
      setRecipients(updatedRecipients)
    }
  }

  const handleDeleteAll = () => {
    setAntdContacts([])
    setRecipients([{
      phone: '',
      name: '',
      variables: Object.fromEntries(
        Array.from({ length: numVariables }, (_, i) => [
          `var${i + 1}`,
          ''
        ])
      )
    }])
    message.success('All contacts deleted.')
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      height: '100%'
    }}>
      <div>
        <Title level={3} style={{ color: '#ffffff', margin: 0, marginBottom: '8px' }}>
          Select Audience
        </Title>
        <Text style={{ color: '#888888' }}>
          Import recipients from Excel, download a sample file, or add manually. Click any cell to edit.
        </Text>
      </div>

      <Alert
        message="Editing Instructions"
        description={
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Click any cell (Name, Number, or Variables) to edit</li>
            <li>Download the sample file for the correct import format</li>
          </ul>
        }
        type="info"
        showIcon
        icon={<FileTextOutlined />}
        style={{
          background: '#0f1f3a',
          border: '1px solid #8b7cf6',
          borderRadius: '8px'
        }}
      />

      <Space wrap>
        <StyledButton
          variant="primary"
          icon={<UploadOutlined />}
          onClick={() => setIsImportDialogOpen(true)}
        >
          Excel Import
        </StyledButton>
        <StyledButton
          variant="secondary"
          icon={<DownloadOutlined />}
          onClick={() => setIsDownloadDialogOpen(true)}
        >
          Download Sample File
        </StyledButton>
        <StyledButton
          variant="secondary"
          icon={<UsergroupAddOutlined />}
          onClick={handleRemoveDuplicates}
        >
          Remove Duplicates
        </StyledButton>
        <StyledButton
          variant="secondary"
          icon={<ClearOutlined />}
          onClick={handleCleanNumbers}
        >
          Clean Numbers
        </StyledButton>
        <StyledButton
          variant="danger"
          icon={<DeleteOutlined />}
          onClick={handleDeleteAll}
        >
          Delete All
        </StyledButton>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={handleContactAdd}
        >
          Add Contact
        </StyledButton>
      </Space>

      <Card
        style={{
          background: '#0a1524',
          border: '1px solid #1a2a3d',
          borderRadius: '8px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
        bodyStyle={{ 
          padding: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <Table
            className="gray-scrollbar audience-contacts-table"
            columns={columns}
            dataSource={antdContacts}
            scroll={{ x: 960, y: 'calc(100vh - 500px)' }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`,
              style: { color: '#ffffff' }
            }}
            bordered
            size="middle"
            rowKey="key"
          />
        </div>
      </Card>

      <Card
        style={{
          background: '#0a1524',
          border: '1px solid #1a2a3d',
          borderRadius: '8px'
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#888888' }}>Total: {antdContacts.length}</Text>
          <Text style={{ color: '#888888' }}>Valid: {antdContacts.filter(c => c.name && c.number).length}</Text>
          <Text style={{ color: '#888888' }}>Invalid: {antdContacts.filter(c => !c.name || !c.number).length}</Text>
        </div>
      </Card>

      {/* Excel Import Modal - Direct to Column Mapping */}
      <Modal
        title={<span style={{ color: '#ffffff' }}>Import Recipients</span>}
        open={isImportDialogOpen}
        onCancel={handleClose}
        footer={null}
        width={1000}
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
            borderRadius: '12px',
            maxHeight: '85vh'
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)'
          }
        }}
      >
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Text style={{ color: '#888888', marginBottom: '24px', display: 'block' }}>
            Upload Excel or CSV file and map columns to import recipients
          </Text>
          
          {!isExcelDataLoaded ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dragger
                accept=".xlsx,.xls,.csv"
                beforeUpload={handleExcelImport}
                showUploadList={false}
                style={{
                  background: '#122033',
                  border: '2px dashed #333333',
                  borderRadius: '8px',
                  padding: '40px 20px',
                  width: '100%',
                  maxWidth: '500px'
                }}
              >
                <p style={{ fontSize: '48px', color: '#0095FF', margin: '20px 0' }}>
                  <UploadOutlined />
                </p>
                <p style={{ color: '#ffffff', fontSize: '16px', margin: '10px 0' }}>
                  Click or drag file to this area to upload
                </p>
                <p style={{ color: '#888888', fontSize: '14px' }}>
                  Support for Excel (.xlsx, .xls) and CSV files
                </p>
              </Dragger>
            </div>
          ) : showColumnMapping ? (
            <>
              {/* Header with Auto Map button */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid #1a2a3d'
              }}>
                <Text strong style={{ color: '#ffffff' }}>
                  Map Columns to Fields
                </Text>
                <StyledButton
                  variant="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleAutoMap()}
                  size="middle"
                >
                  Auto Map
                </StyledButton>
              </div>
              
              {/* Scrollable content area */}
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                paddingRight: '8px',
                marginRight: '-8px',
                maxHeight: '50vh'
              }}>
                <Row gutter={[16, 16]}>
                  {paginatedFields.map(field => (
                    <Col xs={24} md={12} key={field}>
                      <div style={{ marginBottom: '8px' }}>
                        <Text style={{ color: '#888888' }}>
                          {field === 'name' ? 'Name *' : field === 'phone' ? 'Phone *' : `Variable ${field.slice(3)}`}
                        </Text>
                      </div>
                      <Select
                        value={columnMappings[field]}
                        onChange={(value) => handleColumnMappingChange(field, value)}
                        placeholder={`Select column for ${field}`}
                        style={{ width: '100%' }}
                        dropdownStyle={{
                          background: '#122033',
                          border: '1px solid #1a2a3d'
                        }}
                      >
                        <Option value="none">None</Option>
                        {excelHeaders.map(header => (
                          <Option key={header} value={header}>{header}</Option>
                        ))}
                      </Select>
                    </Col>
                  ))}
                </Row>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '16px',
                  padding: '16px 0',
                  borderTop: '1px solid #1a2a3d',
                  borderBottom: '1px solid #1a2a3d'
                }}>
                  <StyledButton
                    variant="secondary"
                    icon={<LeftOutlined />}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    size="small"
                  />
                  <Text style={{ color: '#888888' }}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <StyledButton
                    variant="secondary"
                    icon={<RightOutlined />}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    size="small"
                  />
                </div>
              )}
              
              {/* Fixed Footer with buttons */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                padding: '20px 0',
                borderTop: '1px solid #1a2a3d',
                marginTop: 'auto',
                backgroundColor: '#0a1524'
              }}>
                <StyledButton
                  variant="secondary"
                  onClick={handleClose}
                >
                  Cancel
                </StyledButton>
                <StyledButton
                  variant="primary"
                  onClick={handleImportRecipients}
                  disabled={!columnMappings.name || !columnMappings.phone}
                >
                  Import
                </StyledButton>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        title={<span style={{ color: '#ffffff' }}>Add New Contact</span>}
        open={isContactDialogOpen}
        onCancel={() => setIsContactDialogOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StyledButton
              variant="secondary"
              onClick={() => setIsContactDialogOpen(false)}
            >
              Cancel
            </StyledButton>
            <StyledButton
              variant="primary"
              onClick={handleContactSubmit}
            >
              Add
            </StyledButton>
          </div>
        }
        width={800}
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
            backgroundColor: 'rgba(0, 0, 0, 0.85)'
          }
        }}
      >
        <Form
          form={contactForm}
          layout="vertical"
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Form.Item
              label={<span style={{ color: '#888888' }}>Name</span>}
              name="name"
              rules={[{ required: true, message: 'Please enter name' }]}
            >
              <Input
                placeholder="Enter name"
                style={{
                  background: '#0a1524',
                  borderColor: '#1a2a3d',
                  color: '#ffffff'
                }}
              />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: '#888888' }}>Phone Number</span>}
              name="number"
              rules={[{ required: true, message: 'Please enter number' }]}
            >
              <Input
                placeholder="Enter phone number (e.g., +12025550123)"
                style={{
                  background: '#0a1524',
                  borderColor: '#1a2a3d',
                  color: '#ffffff'
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            label={<span style={{ color: '#888888' }}>Number of Variables</span>}
            name="numVariables"
            initialValue={numVariables}
            rules={[
              { required: true, message: 'Please enter number of variables' },
              {
                validator: (_, value) => {
                  const num = parseInt(value, 10)
                  if (isNaN(num) || num < 10 || num > 30) {
                    return Promise.reject('Number of variables must be between 10 and 30')
                  }
                  return Promise.resolve()
                }
              }
            ]}
          >
            <Input
              type="number"
              placeholder="Enter number of variables (10-30)"
              style={{
                background: '#0a1524',
                borderColor: '#1a2a3d',
                color: '#ffffff'
              }}
              onChange={(e) => setNumVariables(parseInt(e.target.value) || 10)}
            />
          </Form.Item>

          <div style={{ borderTop: '1px solid #1a2a3d', paddingTop: '16px' }}>
            <Title level={5} style={{ color: '#ffffff', marginBottom: '16px' }}>
              Custom Variables
            </Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {Array.from({ length: numVariables }, (_, index) => (
                <Form.Item
                  key={index}
                  label={<span style={{ color: '#888888' }}>Variable {index + 1}</span>}
                  name={`var${index + 1}`}
                >
                  <Input
                    placeholder={`Enter variable ${index + 1}`}
                    style={{
                      background: '#0a1524',
                      borderColor: '#1a2a3d',
                      color: '#ffffff'
                    }}
                  />
                </Form.Item>
              ))}
            </div>
          </div>
        </Form>
      </Modal>


      {/* Settings Modal */}
      <Modal
        title={<span style={{ color: '#ffffff' }}>Settings & Tools</span>}
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
        width={600}
        centered
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
            backgroundColor: 'rgba(0, 0, 0, 0.85)'
          }
        }}
      >
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: 'General',
              children: (
                <div style={{ paddingTop: '16px' }}>
                  <Text style={{ color: '#888888', display: 'block', marginBottom: '8px' }}>
                    Number of Variables (Columns)
                  </Text>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <InputNumber
                      min={10}
                      max={30}
                      value={tempNumVariables}
                      onChange={(val) => setTempNumVariables(val)}
                      style={{ width: '100%', background: '#122033', borderColor: '#1a2a3d', color: '#ffffff' }}
                    />
                    <StyledButton
                      variant="primary"
                      onClick={() => {
                        setNumVariables(tempNumVariables)
                        message.success('Number of variables updated')
                        setIsSettingsModalOpen(false)
                      }}
                    >
                      Save
                    </StyledButton>
                  </div>
                  <Text style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                    This will update the table columns. Existing data might be shifted if columns are reduced.
                  </Text>
                </div>
              )
            },
            {
              key: '2',
              label: 'Number Generator',
              children: (
                <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Alert 
                    message="Repeat the same number multiple times." 
                    type="info" 
                    showIcon 
                    style={{ background: '#0f1f3a', border: '1px solid #8b7cf6', color: '#fff' }}
                  />
                  
                  <div>
                    <Text style={{ color: '#888888', marginBottom: '4px', display: 'block' }}>Start Number</Text>
                    <Input
                      prefix={<NumberOutlined style={{ color: '#888888' }} />}
                      placeholder="e.g. 919876543210 or +919876543210"
                      value={genStartNumber}
                      onChange={(e) => setGenStartNumber(e.target.value)}
                      style={{ background: '#122033', borderColor: '#1a2a3d', color: '#ffffff' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: '#888888', marginBottom: '4px', display: 'block' }}>Count (How many)</Text>
                      <InputNumber
                        min={1}
                        max={1000}
                        value={genCount}
                        onChange={(val) => setGenCount(val)}
                        style={{ width: '100%', background: '#122033', borderColor: '#1a2a3d', color: '#ffffff' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: '#888888', marginBottom: '4px', display: 'block' }}>Name Prefix</Text>
                      <Input
                        placeholder="e.g. User"
                        value={genNamePrefix}
                        onChange={(e) => setGenNamePrefix(e.target.value)}
                        style={{ background: '#122033', borderColor: '#1a2a3d', color: '#ffffff' }}
                      />
                    </div>
                  </div>

                  <StyledButton
                    variant="primary"
                    onClick={handleGenerateNumbers}
                    style={{ marginTop: '8px' }}
                    block
                  >
                    Generate Numbers
                  </StyledButton>
                </div>
              )
            }
          ]}
        />
      </Modal>

      {/* Download Sample Modal */}
      <Modal
        title={<span style={{ color: '#ffffff' }}>Download Sample File</span>}
        open={isDownloadDialogOpen}
        onCancel={() => setIsDownloadDialogOpen(false)}
        footer={[
          <StyledButton
            key="excel"
            variant="primary"
            onClick={handleDownloadSampleExcel}
          >
            Excel (XLSX)
          </StyledButton>,
          <StyledButton
            key="csv"
            variant="primary"
            onClick={handleDownloadSampleCSV}
          >
            CSV
          </StyledButton>
        ]}
        width={400}
      >
        <Text style={{ color: '#888888', textAlign: 'center', display: 'block' }}>
          What type of sample file would you like to download?
        </Text>
      </Modal>
    </div>
  )
}

export default SelectAudience