import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Select, Row, Col, Card, Typography, Space, message, Upload } from 'antd'
import {
  PlusOutlined,
  MinusOutlined,
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  CodeOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  AudioOutlined
} from '@ant-design/icons'
import StyledButton from '../components/common/StyledButton'
import ToggleSwitch from '../components/common/ToggleSwitch'
import FileUpload from '../components/common/FileUpload'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { createTemplate, uploadTemplateMedia, getMediaDisplayUrl } from '../services/localTemplate'
import './AddTemplate.css'

const { TextArea } = Input
const { Option } = Select
const { Text } = Typography

const AddTemplate = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [form] = Form.useForm()
  
  // Template state
  const [templateName, setTemplateName] = useState('')
  const [messageType, setMessageType] = useState('Text')
  const [templateMessage, setTemplateMessage] = useState('{{name}}')
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [media, setMedia] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [buttons, setButtons] = useState([])
  const [enableButtons, setEnableButtons] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Additional fields for different message types
  const [pollOptions, setPollOptions] = useState([{ name: '' }])
  const [listOptions, setListOptions] = useState([{ id: '', title: '', description: '' }])
  const [listButtonText, setListButtonText] = useState('Choose')
  const [listFooter, setListFooter] = useState('')
  const [listSectionTitle, setListSectionTitle] = useState('Options')
  const [carouselCards, setCarouselCards] = useState([{ media: '', text: '', footer: '', buttons: [] }])

  // Add default button when switching to Buttons type or enabling buttons for Media
  useEffect(() => {
    if ((messageType === 'Buttons' || (messageType === 'Media' && enableButtons)) && buttons.length === 0) {
      setButtons([{ title: '', type: 'REPLY', url: '', phone: '', copyCode: '' }])
    }
  }, [messageType, enableButtons, buttons.length])

  // Add default poll option when switching to Poll type
  useEffect(() => {
    if (messageType === 'Poll' && pollOptions.length === 0) {
      setPollOptions([{ name: '' }])
    }
  }, [messageType, pollOptions.length])

  // Add default list option when switching to List type
  useEffect(() => {
    if (messageType === 'List' && listOptions.length === 0) {
      setListOptions([{ id: '', title: '', description: '' }])
    }
  }, [messageType, listOptions.length])

  // Add default carousel card when switching to Carousel type
  useEffect(() => {
    if (messageType === 'Carousel' && carouselCards.length === 0) {
      setCarouselCards([{ media: '', text: '', footer: '', buttons: [] }])
    }
  }, [messageType, carouselCards.length])

  const handleMediaUpload = async (file) => {
    try {
      const response = await uploadTemplateMedia(file)
      
      if (response.status) {
        return {
           url: response.data.url,
           name: response.data.fileName
        }
      } else {
        throw new Error(response.message || 'Upload failed')
      }
    } catch (error) {
       console.error('Upload error:', error)
       throw error
    }
  }

  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { title: '', type: 'REPLY', url: '' }])
    }
  }

  const removeButton = (index) => {
    const newButtons = buttons.filter((_, i) => i !== index)
    setButtons(newButtons)
  }

  const updateButton = (index, field, value) => {
    const updatedButtons = [...buttons]
    updatedButtons[index] = { ...updatedButtons[index], [field]: value }
    setButtons(updatedButtons)
  }

  const addPollOption = () => {
    if (pollOptions.length < 12) {
      setPollOptions([...pollOptions, { name: '' }])
    }
  }

  const removePollOption = (index) => {
    const newOptions = pollOptions.filter((_, i) => i !== index)
    setPollOptions(newOptions)
  }

  const updatePollOption = (index, value) => {
    const updatedOptions = [...pollOptions]
    updatedOptions[index] = { name: value }
    setPollOptions(updatedOptions)
  }

  const addListOption = () => {
    setListOptions([...listOptions, { id: '', title: '', description: '' }])
  }

  const removeListOption = (index) => {
    const newOptions = listOptions.filter((_, i) => i !== index)
    setListOptions(newOptions)
  }

  const updateListOption = (index, field, value) => {
    const updatedOptions = [...listOptions]
    updatedOptions[index] = { ...updatedOptions[index], [field]: value }
    setListOptions(updatedOptions)
  }

  const addCarouselCard = () => {
    setCarouselCards([...carouselCards, { media: '', text: '', footer: '', buttons: [] }])
  }

  const removeCarouselCard = (index) => {
    const newCards = carouselCards.filter((_, i) => i !== index)
    setCarouselCards(newCards)
  }

  const updateCarouselCard = (index, field, value) => {
    const updatedCards = [...carouselCards]
    updatedCards[index] = { ...updatedCards[index], [field]: value }
    setCarouselCards(updatedCards)
  }

  const addCarouselButton = (cardIndex) => {
    const updatedCards = [...carouselCards]
    if (updatedCards[cardIndex].buttons.length < 3) {
      updatedCards[cardIndex].buttons.push({ title: '', type: 'REPLY', url: '' })
      setCarouselCards(updatedCards)
    }
  }

  const removeCarouselButton = (cardIndex, buttonIndex) => {
    const updatedCards = [...carouselCards]
    updatedCards[cardIndex].buttons = updatedCards[cardIndex].buttons.filter((_, i) => i !== buttonIndex)
    setCarouselCards(updatedCards)
  }

  const updateCarouselButton = (cardIndex, buttonIndex, field, value) => {
    const updatedCards = [...carouselCards]
    updatedCards[cardIndex].buttons[buttonIndex] = { 
      ...updatedCards[cardIndex].buttons[buttonIndex], 
      [field]: value 
    }
    setCarouselCards(updatedCards)
  }

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea[placeholder*="message content"]')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newMessage = templateMessage.substring(0, start) + `{{${variable}}}` + templateMessage.substring(end)
      setTemplateMessage(newMessage)
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  const formatText = (format) => {
    const textarea = document.querySelector('textarea[placeholder*="message content"]')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = templateMessage.substring(start, end)
      
      if (selectedText) {
        let formattedText = selectedText
        
        if (format === 'bold') formattedText = `*${selectedText}*`
        else if (format === 'italic') formattedText = `_${selectedText}_`
        else if (format === 'strikethrough') formattedText = `~${selectedText}~`
        else if (format === 'code') formattedText = `\`${selectedText}\``
        
        const newMessage = templateMessage.substring(0, start) + formattedText + templateMessage.substring(end)
        setTemplateMessage(newMessage)
        
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start, start + formattedText.length)
        }, 0)
      }
    }
  }

  const handleSubmit = async (values) => {
    // Check license expiry
    if (user?.licenseExpiry && new Date(user.licenseExpiry) < new Date()) {
      message.error('Your license has expired. Please renew to continue creating templates.')
      return
    }

    // Validate required fields
    if (!templateName.trim()) {
      message.error('Please enter template name')
      return
    }
    
    if (!templateMessage?.trim() && messageType !== 'Poll' && messageType !== 'List' && messageType !== 'Carousel') {
      message.error('Please enter message content')
      return
    }
    
    // Validate media for Media type
    if (messageType === 'Media' && !media?.trim()) {
      message.error('Please upload a media file')
      return
    }
    
    // Validate buttons if message type is Buttons or Media with buttons enabled
    if (messageType === 'Buttons' || (messageType === 'Media' && enableButtons)) {
      const validButtons = buttons.filter(btn => btn.title?.trim())
      if (validButtons.length === 0) {
        message.error(`Please add at least one button for ${messageType === 'Media' ? 'Media' : 'Buttons'} message type`)
        return
      }
      
      // Validate URL buttons
      const urlButtons = validButtons.filter(btn => btn.type === 'URL')
      const invalidUrlButtons = urlButtons.filter(btn => !btn.url?.trim())
      if (invalidUrlButtons.length > 0) {
        message.error('Please provide URL for all URL type buttons')
        return
      }
      
      // Validate Call buttons
      const callButtons = validButtons.filter(btn => btn.type === 'Call')
      const invalidCallButtons = callButtons.filter(btn => !btn.phone?.trim())
      if (invalidCallButtons.length > 0) {
        message.error('Please provide phone number for all Call type buttons')
        return
      }
      
      // Validate Copy buttons
      const copyButtons = validButtons.filter(btn => btn.type === 'Copy')
      const invalidCopyButtons = copyButtons.filter(btn => !btn.copyCode?.trim())
      if (invalidCopyButtons.length > 0) {
        message.error('Please provide copy code for all Copy type buttons')
        return
      }
    }
    
    // Validate poll options if message type is Poll
    if (messageType === 'Poll') {
      const validOptions = pollOptions.filter(opt => opt.name?.trim())
      if (validOptions.length < 2) {
        message.error('Please add at least 2 poll options')
        return
      }
    }
    
    // Validate list options if message type is List
    if (messageType === 'List') {
      const validOptions = listOptions.filter(opt => opt.title?.trim())
      if (validOptions.length === 0) {
        message.error('Please add at least one list option')
        return
      }
    }
    
    // Validate carousel cards if message type is Carousel
    if (messageType === 'Carousel') {
      const validCards = carouselCards.filter(card => card.media?.trim() && card.text?.trim())
      if (validCards.length === 0) {
        message.error('Please add at least one carousel card with media and text')
        return
      }
    }
    
    setIsSubmitting(true)
    
    try {
      const templateData = {
        name: templateName,
        messageType: messageType,
        template: {
          header: messageType === 'Buttons' ? header : '',
          media: messageType === 'Media' ? media : '',
          message: templateMessage,
          footer: messageType === 'Buttons' ? footer : '',
          button: (messageType === 'Buttons' || (messageType === 'Media' && enableButtons)) 
            ? buttons.filter(btn => btn.title?.trim()) 
            : [],
          // Add poll data if message type is Poll
          ...(messageType === 'Poll' && {
            poll: {
              options: pollOptions.filter(opt => opt.name?.trim()).map(opt => ({ name: opt.name })),
              maxOptions: 0
            }
          }),
          // Add list data if message type is List
          ...(messageType === 'List' && {
            list: {
              buttonText: listButtonText,
              footer: listFooter,
              sectionTitle: listSectionTitle,
              options: listOptions.filter(opt => opt.title?.trim()).map(opt => ({
                id: opt.id || opt.title.toLowerCase().replace(/\s+/g, '_'),
                title: opt.title,
                description: opt.description || ''
              }))
            }
          }),
          // Add carousel data if message type is Carousel
          ...(messageType === 'Carousel' && {
            carousel: {
              cards: carouselCards.map(card => ({
                media: card.media,
                text: card.text,
                footer: card.footer || '',
                buttons: card.buttons.filter(btn => btn.title?.trim())
              }))
            }
          })
        }
      }

      const response = await createTemplate(user, templateData)
      
      if (response.status) {
        toast.success('Template Created Successfully!')
        navigate('/templates')
      } else {
        toast.error(response.message || 'Failed to create template')
      }
    } catch (error) {
      console.error('Create template error:', error)
      toast.error(error.message || 'Error creating template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderButtonForm = (button, index) => (
    <Card
      key={index}
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
            Button {index + 1}
          </Text>
          {/* Only show remove button if there's more than 1 button OR it's not the first button */}
          {(buttons.length > 1 || index > 0) && (
            <StyledButton
              variant="danger"
              size="small"
              icon={<MinusOutlined />}
              onClick={() => removeButton(index)}
            />
          )}
        </div>
      }
      style={{
        background: '#122033',
        border: '1px solid #1a2a3d',
        marginBottom: '20px',
        borderRadius: '12px'
      }}
      bodyStyle={{ padding: '20px' }}
    >
      <Row gutter={[20, 20]}>
        <Col span={12}>
          <Text style={{ 
            color: '#ffffff', 
            fontSize: '16px', 
            fontWeight: '600', 
            display: 'block', 
            marginBottom: '12px' 
          }}>
            Title
          </Text>
          <Input
            placeholder={`Enter title for Button ${index + 1}`}
            value={button.title}
            onChange={(e) => updateButton(index, 'title', e.target.value)}
            style={{
              background: '#2a2a2a',
              border: '1px solid #555555',
              color: '#ffffff',
              height: '44px',
              fontSize: '16px',
              borderRadius: '8px'
            }}
          />
        </Col>
        <Col span={12}>
          <Text style={{ 
            color: '#ffffff', 
            fontSize: '16px', 
            fontWeight: '600', 
            display: 'block', 
            marginBottom: '12px' 
          }}>
            Type
          </Text>
          <Select
            value={button.type}
            onChange={(value) => updateButton(index, 'type', value)}
            style={{ width: '100%', height: '44px' }}
            dropdownStyle={{
              background: '#122033',
              border: '1px solid #1a2a3d'
            }}
          >
            <Option value="REPLY">Reply</Option>
            <Option value="URL">URL</Option>
            <Option value="Call">Call</Option>
            <Option value="Copy">Copy</Option>
          </Select>
        </Col>
        {button.type === 'URL' && (
          <Col span={24}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              URL
            </Text>
            <Input
              placeholder="Enter URL"
              value={button.url}
              onChange={(e) => updateButton(index, 'url', e.target.value)}
              prefix={<LinkOutlined style={{ color: '#888888' }} />}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
        )}
        {button.type === 'Call' && (
          <Col span={24}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              Phone Number
            </Text>
            <Input
              placeholder="Enter phone number"
              value={button.phone}
              onChange={(e) => updateButton(index, 'phone', e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
        )}
        {button.type === 'Copy' && (
          <Col span={24}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              Copy Code
            </Text>
            <Input
              placeholder="Enter copy code"
              value={button.copyCode}
              onChange={(e) => updateButton(index, 'copyCode', e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
        )}
      </Row>
    </Card>
  )

  const renderPollOptions = () => (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
          Poll Options
        </Text>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={addPollOption}
          disabled={pollOptions.length >= 12}
        >
          Add Option
        </StyledButton>
      </div>
      {pollOptions.map((option, index) => (
        <Row key={index} gutter={[20, 20]} style={{ marginBottom: '20px' }}>
          <Col span={20}>
            <Input
              placeholder={`Option ${index + 1}`}
              value={option.name}
              onChange={(e) => updatePollOption(index, e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
          <Col span={4}>
            {(pollOptions.length > 1 || index > 0) && (
              <StyledButton
                variant="danger"
                icon={<MinusOutlined />}
                onClick={() => removePollOption(index)}
                style={{ width: '100%', height: '44px' }}
              />
            )}
          </Col>
        </Row>
      ))}
    </div>
  )

  const renderListOptions = () => (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
          List Options
        </Text>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={addListOption}
        >
          Add Option
        </StyledButton>
      </div>
      
      <Card
        size="small"
        title={<Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>List Configuration</Text>}
        style={{
          background: '#122033',
          border: '1px solid #1a2a3d',
          marginBottom: '20px',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Row gutter={[20, 20]}>
          <Col span={12}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              Button Text
            </Text>
            <Input
              placeholder="Button text"
              value={listButtonText}
              onChange={(e) => setListButtonText(e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
          <Col span={12}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              Section Title
            </Text>
            <Input
              placeholder="Section title"
              value={listSectionTitle}
              onChange={(e) => setListSectionTitle(e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
          <Col span={24}>
            <Text style={{ 
              color: '#ffffff', 
              fontSize: '16px', 
              fontWeight: '600', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              Footer (Optional)
            </Text>
            <Input
              placeholder="Footer text"
              value={listFooter}
              onChange={(e) => setListFooter(e.target.value)}
              style={{
                background: '#2a2a2a',
                border: '1px solid #555555',
                color: '#ffffff',
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            />
          </Col>
        </Row>
      </Card>
      
      {listOptions.map((option, index) => (
        <Card
          key={index}
          size="small"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
                Option {index + 1}
              </Text>
              {(listOptions.length > 1 || index > 0) && (
                <StyledButton
                  variant="danger"
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() => removeListOption(index)}
                />
              )}
            </div>
          }
          style={{
            background: '#122033',
            border: '1px solid #1a2a3d',
            marginBottom: '20px',
            borderRadius: '12px'
          }}
          bodyStyle={{ padding: '20px' }}
        >
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                ID (Optional)
              </Text>
              <Input
                placeholder="Option ID"
                value={option.id}
                onChange={(e) => updateListOption(index, 'id', e.target.value)}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  color: '#ffffff',
                  height: '44px',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
              />
            </Col>
            <Col span={12}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                Title *
              </Text>
              <Input
                placeholder="Option title"
                value={option.title}
                onChange={(e) => updateListOption(index, 'title', e.target.value)}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  color: '#ffffff',
                  height: '44px',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
              />
            </Col>
            <Col span={24}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                Description (Optional)
              </Text>
              <Input
                placeholder="Option description"
                value={option.description}
                onChange={(e) => updateListOption(index, 'description', e.target.value)}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  color: '#ffffff',
                  height: '44px',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
              />
            </Col>
          </Row>
        </Card>
      ))}
    </div>
  )

  const renderCarouselCards = () => (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
          Carousel Cards
        </Text>
        <StyledButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={addCarouselCard}
        >
          Add Card
        </StyledButton>
      </div>
      
      {carouselCards.map((card, index) => (
        <Card
          key={index}
          size="small"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
                Card {index + 1}
              </Text>
              {(carouselCards.length > 1 || index > 0) && (
                <StyledButton
                  variant="danger"
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() => removeCarouselCard(index)}
                />
              )}
            </div>
          }
          style={{
            background: '#122033',
            border: '1px solid #1a2a3d',
            marginBottom: '20px',
            borderRadius: '12px'
          }}
          bodyStyle={{ padding: '20px' }}
        >
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                Image *
              </Text>
              <FileUpload
                customRequest={handleMediaUpload}
                onUploadSuccess={(result) => {
                  updateCarouselCard(index, 'media', result.url)
                  message.success('Image saved locally')
                }}
                onUploadError={() => message.error('Upload failed')}
                onFileRemove={() => updateCarouselCard(index, 'media', '')}
                accept="image/*"
                maxFileSize={20}
                multiple={false}
              />
              {card.media ? (
                <img
                  src={getMediaDisplayUrl(card.media)}
                  alt=""
                  style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginTop: 12 }}
                />
              ) : null}
            </Col>
            <Col span={12}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                Footer (Optional)
              </Text>
              <Input
                placeholder="Card footer"
                value={card.footer}
                onChange={(e) => updateCarouselCard(index, 'footer', e.target.value)}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  color: '#ffffff',
                  height: '44px',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
              />
            </Col>
            <Col span={24}>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '12px' 
              }}>
                Text *
              </Text>
              <TextArea
                placeholder="Card text"
                value={card.text}
                onChange={(e) => updateCarouselCard(index, 'text', e.target.value)}
                rows={4}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  color: '#ffffff',
                  fontSize: '16px',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
            </Col>
          </Row>
          
          <div style={{ marginTop: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '16px' 
            }}>
              <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                Card Buttons
              </Text>
              <StyledButton
                variant="primary"
                icon={<PlusOutlined />}
                onClick={() => addCarouselButton(index)}
                disabled={card.buttons.length >= 3}
              >
                Add Button
              </StyledButton>
            </div>
            
            {card.buttons.map((button, buttonIndex) => (
              <Card
                key={buttonIndex}
                size="small"
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #555555',
                  marginBottom: '16px',
                  borderRadius: '8px'
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text style={{ 
                      color: '#ffffff', 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      display: 'block', 
                      marginBottom: '8px' 
                    }}>
                      Title *
                    </Text>
                    <Input
                      placeholder="Button title"
                      value={button.title}
                      onChange={(e) => updateCarouselButton(index, buttonIndex, 'title', e.target.value)}
                      style={{
                        background: '#122033',
                        border: '1px solid #1a2a3d',
                        color: '#ffffff',
                        height: '36px',
                        fontSize: '14px',
                        borderRadius: '6px'
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Text style={{ 
                      color: '#ffffff', 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      display: 'block', 
                      marginBottom: '8px' 
                    }}>
                      Type
                    </Text>
                    <Select
                      value={button.type}
                      onChange={(value) => updateCarouselButton(index, buttonIndex, 'type', value)}
                      style={{ width: '100%', height: '36px' }}
                      size="small"
                      dropdownStyle={{
                        background: '#122033',
                        border: '1px solid #1a2a3d'
                      }}
                    >
                      <Option value="REPLY">Reply</Option>
                      <Option value="URL">URL</Option>
                      <Option value="Call">Call</Option>
                      <Option value="Copy">Copy</Option>
                    </Select>
                  </Col>
                  {button.type === 'URL' && (
                    <Col span={24}>
                      <Text style={{ 
                        color: '#ffffff', 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        display: 'block', 
                        marginBottom: '8px' 
                      }}>
                        URL
                      </Text>
                      <Input
                        placeholder="Enter URL"
                        value={button.url}
                        onChange={(e) => updateCarouselButton(index, buttonIndex, 'url', e.target.value)}
                        prefix={<LinkOutlined style={{ color: '#888888' }} />}
                        style={{
                          background: '#122033',
                          border: '1px solid #1a2a3d',
                          color: '#ffffff',
                          height: '36px',
                          fontSize: '14px',
                          borderRadius: '6px'
                        }}
                      />
                    </Col>
                  )}
                  {button.type === 'Call' && (
                    <Col span={24}>
                      <Text style={{ 
                        color: '#ffffff', 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        display: 'block', 
                        marginBottom: '8px' 
                      }}>
                        Phone Number
                      </Text>
                      <Input
                        placeholder="Enter phone number"
                        value={button.phone}
                        onChange={(e) => updateCarouselButton(index, buttonIndex, 'phone', e.target.value)}
                        style={{
                          background: '#122033',
                          border: '1px solid #1a2a3d',
                          color: '#ffffff',
                          height: '36px',
                          fontSize: '14px',
                          borderRadius: '6px'
                        }}
                      />
                    </Col>
                  )}
                  {button.type === 'Copy' && (
                    <Col span={24}>
                      <Text style={{ 
                        color: '#ffffff', 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        display: 'block', 
                        marginBottom: '8px' 
                      }}>
                        Copy Code
                      </Text>
                      <Input
                        placeholder="Enter copy code"
                        value={button.copyCode}
                        onChange={(e) => updateCarouselButton(index, buttonIndex, 'copyCode', e.target.value)}
                        style={{
                          background: '#122033',
                          border: '1px solid #1a2a3d',
                          color: '#ffffff',
                          height: '36px',
                          fontSize: '14px',
                          borderRadius: '6px'
                        }}
                      />
                    </Col>
                  )}
                  <Col span={24}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StyledButton
                        variant="danger"
                        size="small"
                        icon={<MinusOutlined />}
                        onClick={() => removeCarouselButton(index, buttonIndex)}
                      >
                        Remove Button
                      </StyledButton>
                    </div>
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )

  return (
    <div className="add-template-page" style={{ 
      padding: '24px', 
      background: 'transparent', 
      minHeight: '100vh',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .section-fade-in {
            animation: slideIn 0.4s ease-out;
          }
        `}
      </style>
      
      <div style={{ marginBottom: '24px' }}>
        <StyledButton
          variant="secondary"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/templates')}
          style={{ marginBottom: '16px' }}
        >
          Back to Templates
        </StyledButton>
        <h1 style={{ 
          color: '#ffffff', 
          fontSize: '36px', 
          fontWeight: '800', 
          margin: 0,
          background: 'linear-gradient(90deg, #ffffff 0%, #8b7cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Add New Template
        </h1>
        <p style={{ 
          color: '#888888', 
          fontSize: '16px', 
          marginTop: '8px',
          fontWeight: '400'
        }}>
          Create engaging message templates for your campaigns
        </p>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ messageType: 'Text' }}
        style={{ 
          padding: '24px', 
          background: '#0a1524', 
          border: '1px solid #1a2a3d', 
          borderRadius: '16px' 
        }}
      >
        <Row gutter={[32, 0]}>
          <Col span={12}>
            <Form.Item
              label={<span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                Template Name
              </span>}
              name="name"
              rules={[{ required: true, message: 'Please enter template name' }]}
              style={{ marginBottom: '32px' }}
            >
              <Input
                placeholder="Enter template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{
                  background: '#122033',
                  border: '1px solid #1a2a3d',
                  color: '#ffffff',
                  height: '52px',
                  fontSize: '16px',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#8b7cf6'
                  e.target.style.boxShadow = '0 0 0 2px rgba(139, 124, 246, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040'
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={<span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                Message Type
              </span>}
              name="messageType"
              rules={[{ required: true, message: 'Please select message type' }]}
              style={{ marginBottom: '32px' }}
            >
              <Select
                value={messageType}
                onChange={setMessageType}
                className="custom-select"
                style={{ 
                  width: '100%', 
                  height: '52px',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
                dropdownStyle={{
                  background: '#122033',
                  border: '1px solid #1a2a3d',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                <Option value="Text">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📝</span>
                    <span>Text</span>
                  </span>
                </Option>
                <Option value="Buttons">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔘</span>
                    <span>Buttons</span>
                  </span>
                </Option>
                <Option value="Media">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🖼️</span>
                    <span>Media</span>
                  </span>
                </Option>
                <Option value="Poll">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📊</span>
                    <span>Poll</span>
                  </span>
                </Option>
                <Option value="List">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📋</span>
                    <span>List</span>
                  </span>
                </Option>
                <Option value="Carousel">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎠</span>
                    <span>Carousel</span>
                  </span>
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {messageType === 'Buttons' && (
          <Row gutter={[32, 0]}>
            <Col span={12}>
              <Form.Item
                label={<span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                  Header (Optional)
                </span>}
                name="header"
                style={{ marginBottom: '32px' }}
              >
                <Input
                  placeholder="Enter header text"
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  style={{
                    background: '#122033',
                    border: '1px solid #1a2a3d',
                    color: '#ffffff',
                    height: '52px',
                    fontSize: '16px',
                    borderRadius: '8px'
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={<span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
                  Footer (Optional)
                </span>}
                name="footer"
                style={{ marginBottom: '32px' }}
              >
                <Input
                  placeholder="Enter footer text"
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  style={{
                    background: '#122033',
                    border: '1px solid #1a2a3d',
                    color: '#ffffff',
                    height: '52px',
                    fontSize: '16px',
                    borderRadius: '8px'
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {messageType === 'Media' && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              padding: '20px',
              background: '#122033',
              border: '1px solid #1a2a3d',
              borderRadius: '12px'
            }}>
              <div>
                <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', display: 'block' }}>
                  Media Upload
                </Text>
                <Text style={{ color: '#888888', fontSize: '14px' }}>
                  Upload a file — it will be saved on your device
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
                  Add Buttons
                </Text>
                <ToggleSwitch
                  checked={enableButtons}
                  onChange={setEnableButtons}
                  style={{
                    transform: 'scale(1.2)'
                  }}
                />
              </div>
            </div>
            
            <FileUpload
              customRequest={handleMediaUpload}
              onUploadSuccess={(result, file) => {
                setMediaFile(file)
                setMedia(result.url)
                message.success(`${file.name} saved locally`)
              }}
              onUploadError={(error, file) => {
                message.error(`${file.name} upload failed!`)
              }}
              onFileRemove={() => {
                setMediaFile(null)
                setMedia('')
              }}
              accept="image/*,video/*,audio/*"
              maxFileSize={20}
              multiple={false}
            />
          </div>
        )}

        {(messageType === 'Text' || messageType === 'Buttons' || messageType === 'Media') && (
          <Form.Item
            label={<span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
              Message Content
            </span>}
            name="message"
            rules={[{ required: true, message: 'Please enter message content' }]}
            style={{ marginBottom: '32px' }}
          >
            <div>
              <div style={{ 
                marginBottom: '16px', 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'center', 
                flexWrap: 'wrap',
                padding: '16px',
                background: '#122033',
                border: '1px solid #1a2a3d',
                borderRadius: '12px'
              }}>
                <Select
                  placeholder="Insert variable"
                  className="custom-select"
                  style={{ 
                    width: 200, 
                    height: '44px',
                    fontSize: '16px',
                    color: '#ffffff'
                  }}
                  size="large"
                  onSelect={insertVariable}
                  value={undefined}
                  dropdownStyle={{
                    background: '#122033',
                    border: '1px solid #1a2a3d'
                  }}
                  dropdownRender={(menu) => (
                    <div style={{ background: '#122033', border: '1px solid #1a2a3d' }}>
                      {menu}
                    </div>
                  )}
                >
                  <Option value="name" style={{ fontSize: '16px' }}>{'{{name}}'}</Option>
                  <Option value="phone" style={{ fontSize: '16px' }}>{'{{phone}}'}</Option>
                  {Array.from({ length: 30 }, (_, i) => (
                    <Option key={`var${i + 1}`} value={`var${i + 1}`} style={{ fontSize: '16px' }}>
                      {`{{var${i + 1}}}`}
                    </Option>
                  ))}
                </Select>
                <div style={{ 
                  height: '32px', 
                  width: '2px', 
                  background: '#404040',
                  margin: '0 8px'
                }} />
                <Space size="middle">
                  <StyledButton 
                    size="middle" 
                    icon={<BoldOutlined />} 
                    onClick={() => formatText('bold')}
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                  <StyledButton 
                    size="middle" 
                    icon={<ItalicOutlined />} 
                    onClick={() => formatText('italic')}
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                  <StyledButton 
                    size="middle" 
                    icon={<StrikethroughOutlined />} 
                    onClick={() => formatText('strikethrough')}
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                  <StyledButton 
                    size="middle" 
                    icon={<CodeOutlined />} 
                    onClick={() => formatText('code')}
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                  <StyledButton 
                    size="middle" 
                    icon={<UnorderedListOutlined />} 
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                  <StyledButton 
                    size="middle" 
                    icon={<LinkOutlined />} 
                    variant="ghost"
                    style={{ width: '44px' }}
                  />
                </Space>
              </div>
              <TextArea
                rows={10}
                placeholder="Enter your message content here..."
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
                style={{
                  background: '#122033',
                  border: '1px solid #1a2a3d',
                  color: '#ffffff',
                  resize: 'none',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  borderRadius: '12px',
                  padding: '16px'
                }}
              />
            </div>
          </Form.Item>
        )}

        {(messageType === 'Buttons' || (messageType === 'Media' && enableButtons)) && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              padding: '20px',
              background: '#122033',
              border: '1px solid #1a2a3d',
              borderRadius: '12px'
            }}>
              <div>
                <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', display: 'block' }}>
                  {messageType === 'Media' ? 'Media Buttons' : 'Buttons'}
                </Text>
                <Text style={{ color: '#888888', fontSize: '14px' }}>
                  Add interactive buttons to your message
                </Text>
              </div>
              <StyledButton
                variant="primary"
                icon={<PlusOutlined />}
                onClick={addButton}
                disabled={buttons.length >= 3}
              >
                Add Button
              </StyledButton>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {buttons.map((button, index) => renderButtonForm(button, index))}
            </div>
          </div>
        )}
        
        {messageType === 'Poll' && renderPollOptions()}
        
        {messageType === 'List' && renderListOptions()}
        
        {messageType === 'Carousel' && renderCarouselCards()}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px', 
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #1a2a3d'
        }}>
          <StyledButton
            variant="secondary"
            onClick={() => navigate('/templates')}
            style={{ minWidth: '120px' }}
          >
            Cancel
          </StyledButton>
          <StyledButton
            variant="primary"
            htmlType="submit"
            loading={isSubmitting}
            style={{ minWidth: '160px' }}
          >
            Create Template
          </StyledButton>
        </div>
      </Form>
    </div>
  )
}

export default AddTemplate
