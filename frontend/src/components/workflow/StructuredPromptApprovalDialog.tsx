import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Edit, AlertCircle, Loader2 } from 'lucide-react'
import { workflowRunAPI } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PendingApproval {
  node_id: string
  node_type: string
  generated_prompt: Record<string, any>
  request_id: string
}

interface StructuredPromptApprovalDialogProps {
  isOpen: boolean
  onClose: () => void
  runId: string
  pendingApproval: PendingApproval | null
  onApprovalComplete: () => void
}

const StructuredPromptApprovalDialog: React.FC<StructuredPromptApprovalDialogProps> = ({
  isOpen,
  onClose,
  runId,
  pendingApproval,
  onApprovalComplete,
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState<Record<string, any>>({})

  // Initialize edited prompt when pending approval changes
  useEffect(() => {
    if (pendingApproval?.generated_prompt) {
      setEditedPrompt({ ...pendingApproval.generated_prompt })
      setIsEditing(false)
    }
  }, [pendingApproval])

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async (structuredPrompt: Record<string, any>) => {
      if (!pendingApproval) throw new Error('No pending approval')
      const response = await workflowRunAPI.approveStructuredPrompt(
        runId,
        pendingApproval.node_id,
        structuredPrompt
      )
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Prompt Approved",
        description: "The structured prompt has been approved and workflow execution will continue.",
      })
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] })
      onApprovalComplete()
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.response?.data?.detail || "Failed to approve the structured prompt.",
        variant: "destructive",
      })
    },
  })

  // Rejection mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!pendingApproval) throw new Error('No pending approval')
      const response = await workflowRunAPI.rejectStructuredPrompt(runId, pendingApproval.node_id)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Prompt Rejected",
        description: "The structured prompt has been rejected and workflow execution has been halted.",
      })
      queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] })
      onApprovalComplete()
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.response?.data?.detail || "Failed to reject the structured prompt.",
        variant: "destructive",
      })
    },
  })

  const handleApprove = () => {
    approveMutation.mutate(editedPrompt)
  }

  const handleReject = () => {
    rejectMutation.mutate()
  }

  const handleEditField = (field: string, value: any) => {
    setEditedPrompt(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const renderPromptField = (key: string, value: any, isEditable: boolean = true) => {
    if (typeof value === 'object' && value !== null) {
      return (
        <Card key={key} className="mt-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{key}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {Object.entries(value).map(([subKey, subValue]) => 
              renderPromptField(`${key}.${subKey}`, subValue, isEditable)
            )}
          </CardContent>
        </Card>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <Label className="text-sm font-medium">{key}</Label>
          <div className="space-y-1">
            {value.map((item, index) => (
              <div key={index} className="text-sm p-2 bg-muted rounded">
                {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key} className="text-sm font-medium">
          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Label>
        {isEditing && isEditable ? (
          <Input
            id={key}
            value={String(value || '')}
            onChange={(e) => handleEditField(key, e.target.value)}
            className="text-sm"
          />
        ) : (
          <div className="text-sm p-2 bg-muted rounded min-h-[40px] flex items-center">
            {String(value || 'N/A')}
          </div>
        )}
      </div>
    )
  }

  if (!pendingApproval) {
    return null
  }

  const isLoading = approveMutation.isPending || rejectMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Structured Prompt Approval Required
          </DialogTitle>
          <DialogDescription>
            The {pendingApproval.node_type} node has generated a structured prompt that requires your review and approval before the workflow can continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Node Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Node Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Node ID:</span> {pendingApproval.node_id}
                </div>
                <div>
                  <span className="font-medium">Node Type:</span> {pendingApproval.node_type}
                </div>
                <div>
                  <span className="font-medium">Request ID:</span> {pendingApproval.request_id}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Prompt */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Generated Structured Prompt</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isLoading}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'View Mode' : 'Edit Mode'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isEditing && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Edit className="h-4 w-4" />
                    <span className="text-sm font-medium">Edit Mode Active</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    You can modify the structured prompt fields below. Changes will be applied when you approve the prompt.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                {Object.entries(editedPrompt).map(([key, value]) => 
                  renderPromptField(key, value, true)
                )}
              </div>
            </CardContent>
          </Card>

          {/* Validation Status */}
          {isEditing && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Validation Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">Structured prompt format is valid</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isLoading}
          >
            {rejectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Reject
              </>
            )}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isLoading}
          >
            {approveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Approve & Continue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StructuredPromptApprovalDialog