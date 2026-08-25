import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StyledButton from '../components/common/StyledButton'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { listTemplates, deleteTemplate } from '../services/localTemplate'

// Component imports
import TemplateHeader from '../components/templates/TemplateHeader'
import TemplateTable from '../components/templates/TemplateTable'
import TemplatePreviewDialog from '../components/templates/TemplatePreviewDialog'

const Templates = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [isDeleting, setIsDeleting] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTemplates, setTotalTemplates] = useState(0)
  const templatesPerPage = 10

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listTemplates(user, { 
        page: currentPage - 1, 
        limit: templatesPerPage 
      })
      
      if (response.status) {
        setTemplates(response.templates || [])
        setTotalTemplates(response.total || 0)
      } else {
        toast.error(response.message || 'Failed to load templates')
      }
    } catch (error) {
      console.error('Fetch templates error:', error)
      toast.error('Error loading templates. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, templatesPerPage, user])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleEditTemplate = async (values) => {
    toast.info('Edit functionality remains in modal for now')
  }

  const handleDeleteTemplate = async (templateId) => {
    setIsDeleting(prev => ({ ...prev, [templateId]: true }))
    try {
      const response = await deleteTemplate(user, templateId)
      
      if (response.status) {
        toast.success('Template Deleted Successfully!')
        fetchTemplates()
      } else {
        toast.error(response.message || 'Failed to delete template')
      }
    } catch (error) {
      console.error('Delete template error:', error)
      toast.error('Error deleting template')
    } finally {
      setIsDeleting(prev => ({ ...prev, [templateId]: false }))
    }
  }

  const openCreateModal = () => {
    navigate('/add-template')
  }

  const openEditModal = (template) => {
    setEditingTemplate(template)
    toast.info('Edit functionality remains in modal for now')
  }

  const openPreviewModal = (template) => {
    setPreviewTemplate(template)
    setShowPreviewModal(true)
  }

  const totalPages = Math.ceil(totalTemplates / templatesPerPage)

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <div style={{ padding: '0px', background: 'transparent' }}>
      <TemplateHeader
        isLoading={loading}
        onCreateTemplate={openCreateModal}
      />

      <TemplateTable
        templates={templates}
        isDeleting={isDeleting}
        currentPage={currentPage}
        totalPages={totalPages}
        templatesPerPage={templatesPerPage}
        totalTemplates={totalTemplates}
        onEdit={openEditModal}
        onDelete={handleDeleteTemplate}
        onPreview={openPreviewModal}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        setCurrentPage={setCurrentPage}
      />

      {/* Preview Modal */}
      <TemplatePreviewDialog
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        template={previewTemplate}
        previewContent=""
        previewButtons={previewTemplate?.template?.button || []}
      />
    </div>
  )
}

export default Templates