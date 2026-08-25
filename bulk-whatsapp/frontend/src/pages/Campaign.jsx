import React, { useState, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Steps, 
  Typography, 
  Card,
  message,
  Spin
} from 'antd'
import { 
  CheckOutlined, 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  CloseOutlined 
} from '@ant-design/icons'

// Component imports
import BasicConfiguration from '../components/campaign-steps/BasicConfiguration'
import ChooseTemplate from '../components/campaign-steps/ChooseTemplate'
import SelectAudience from '../components/campaign-steps/SelectAudience'
import ScheduleCampaign from '../components/campaign-steps/ScheduleCampaign'
import StyledButton from '../components/common/StyledButton'
import { useAuth } from '../context/AuthContext'
import { getAllInstances } from '../services/instanceStorage'
import { listTemplates } from '../services/localTemplate'
import { createCampaign } from '../services/localCampaign'

const { Title, Text } = Typography

const CAMPAIGN_STEPS = [
  { id: 1, title: 'Basic Configuration', description: '' },
  { id: 2, title: 'Choose Template', description: '' },
  { id: 3, title: 'Select Audience', description: '' },
  { id: 4, title: 'Schedule Campaign', description: '' }
]

const Campaign = memo(function Campaign() {
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()
  
  // State
  const [currentStep, setCurrentStep] = useState(1)
  const [templates, setTemplates] = useState([])
  const [instances, setInstances] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedInstances, setSelectedInstances] = useState([])
  const [recipients, setRecipients] = useState([
    { phone: '', name: '', variables: { var1: '', var2: '', var3: '', var4: '', var5: '', var6: '', var7: '', var8: '', var9: '', var10: '' } },
  ])
  const [delayRange, setDelayRange] = useState({ start: 3, end: 5 })
  const [isLoading, setIsLoading] = useState(true)
  const [campaignName, setCampaignName] = useState('')
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [antdContacts, setAntdContacts] = useState([])
  const [campaignId, setCampaignId] = useState(null)

  const showToast = (msg, type = 'success') => {
    message[type](msg)
  }

  const handleUnauthorized = () => {
    showToast('Session expired. Please log in again.', 'error')
    logout()
    navigate('/login')
  }

  // Fetch data
  const fetchData = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true)
    
    try {
      if (!token) {
        handleUnauthorized()
        return
      }

      // Fetch templates and instances in parallel
      const [templatesResponse, instancesList] = await Promise.all([
        listTemplates(user, { page: 0, limit: 100 }),
        getAllInstances(user, { migrate: false })
      ])

      if (templatesResponse.status) {
        const fetchedTemplates = templatesResponse.templates || []
        setTemplates(fetchedTemplates)
      } else {
        showToast(templatesResponse.message || 'Failed to fetch templates', 'error')
      }

      setInstances(instancesList || [])

    } catch (error) {
      console.error('Error fetching data:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        showToast('Failed to load data. Please try again.', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const validateStep = (step) => {
    if (step === 1) {
      if (!campaignName.trim()) {
        showToast('Please enter a campaign name', 'error')
        return false
      }
      if (selectedInstances.length === 0) {
        showToast('Please select at least one instance', 'error')
        return false
      }
    } else if (step === 2) {
      if (!selectedTemplate) {
        showToast('Please select a template', 'error')
        return false
      }
    } else if (step === 3) {
      if (antdContacts.length === 0 || antdContacts.some((contact) => !contact.number || !contact.name)) {
        showToast('All contacts must have a valid phone number and name', 'error')
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return

    if (currentStep === 4) {
      handleCreateCampaign()
      return
    }
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Create campaign function
  const handleCreateCampaign = async () => {
    setIsCreatingCampaign(true)
    
    try {
      const template = templates.find((t) => t._id === selectedTemplate)
      const campaignData = {
        name: campaignName,
        templateId: selectedTemplate,
        templateSnapshot: template,
        instanceIds: selectedInstances,
        recipients: antdContacts.map(contact => ({
          phone: contact.number,
          name: contact.name,
          variables: Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [
              `var${i + 1}`,
              contact[`var${i + 1}`] || ''
            ])
          )
        })),
        delayRange
      }

      const response = await createCampaign(user, campaignData)

      if (response.status) {
        showToast('Campaign created successfully!', 'success')
        setCampaignId(response.campaignId)
        return response.campaignId
      } else {
        showToast(response.message || 'Failed to create campaign', 'error')
        return null
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      if (error.response?.status === 401) {
        handleUnauthorized()
      } else {
        showToast('Failed to create campaign. Please try again.', 'error')
      }
      return null
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const handleClose = () => {
    // Reset everything and go back to dashboard
    setCurrentStep(1)
    setCampaignName('')
    setSelectedInstances([])
    setSelectedTemplate('')
    setDelayRange({ start: 3, end: 5 })
    setAntdContacts([])
    setCampaignId(null)
    setRecipients([{
      phone: '',
      name: '',
      variables: { var1: '', var2: '', var3: '', var4: '', var5: '', var6: '', var7: '', var8: '', var9: '', var10: '' }
    }])
    navigate('/messaging')
  }

  const renderStepContent = () => {
    const stepComponents = {
      1: (
        <BasicConfiguration
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          selectedInstances={selectedInstances}
          setSelectedInstances={setSelectedInstances}
          instances={instances}
        />
      ),
      2: (
        <ChooseTemplate
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          templates={templates}
        />
      ),
      3: (
        <SelectAudience
          antdContacts={antdContacts}
          setAntdContacts={setAntdContacts}
          recipients={recipients}
          setRecipients={setRecipients}
          showToast={showToast}
        />
      ),
      4: (
        <ScheduleCampaign
            campaignName={campaignName}
            selectedTemplate={selectedTemplate}
            selectedInstances={selectedInstances}
            antdContacts={antdContacts}
            delayRange={delayRange}
            setDelayRange={setDelayRange}
            templates={templates}
            onCreateCampaign={handleCreateCampaign}
            isCreating={isCreatingCampaign}
            campaignId={campaignId}
          />
      )
    }

    return stepComponents[currentStep] || null
  }

  if (isLoading) {
    return (
      <div style={{ 
        background: 'transparent', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Spin size="large" />
          <Text style={{ color: '#888888', marginTop: '16px' }}>Loading...</Text>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'transparent', paddingBottom: '100px' }}>
      <div style={{ padding: '0px' }}>
        {/* Header with Cancel Button */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '24px' 
        }}>
          <div>
            <Title level={2} style={{ color: '#ffffff', margin: 0, fontSize: '28px' }}>
              Create New Campaign
            </Title>
            <Text style={{ color: '#888888', marginTop: '4px' }}>
              Connect with your customers through WhatsApp
            </Text>
          </div>
          <StyledButton
            variant="secondary"
            icon={<CloseOutlined />}
            onClick={handleClose}
          >
            Cancel
          </StyledButton>
        </div>

        {/* Step Indicator */}
        <Card
          style={{
            background: '#0a1524',
            border: '1px solid #1a2a3d',
            borderRadius: '12px',
            marginBottom: '32px'
          }}
          bodyStyle={{ padding: '24px' }}
        >
          <Steps
            current={currentStep - 1}
            items={CAMPAIGN_STEPS.map((step, index) => ({
              title: <span style={{ color: currentStep >= step.id ? '#ffffff' : '#888888' }}>
                {step.title}
              </span>,
              icon: currentStep > step.id ? <CheckOutlined /> : <span>{step.id}</span>
            }))}
          />
        </Card>
        
        {/* Step Content */}
        <Card
          style={{
            background: '#0a1524',
            border: '1px solid #1a2a3d',
            borderRadius: '12px',
            minHeight: '500px'
          }}
          bodyStyle={{ padding: '32px' }}
        >
          {renderStepContent()}
        </Card>
      </div>

      {/* Fixed Footer Navigation */}
      {currentStep !== 4 && (
        <div className="campaign-footer">
          <StyledButton
            variant="secondary"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            disabled={currentStep === 1}
            size="middle"
          >
            Back
          </StyledButton>
          
          <StyledButton
            variant="primary"
            icon={<ArrowRightOutlined />}
            onClick={handleNext}
            disabled={isCreatingCampaign}
            loading={currentStep === 4 && isCreatingCampaign}
            size="middle"
          >
            {currentStep === 4 ? 'Create Campaign' : 'Next'}
          </StyledButton>
        </div>
      )}
    </div>
  )
})

export default Campaign