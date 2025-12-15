import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Node, Edge } from 'reactflow'
import { 
  Play, 
  ArrowLeft, 
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { workflowAPI, workflowRunAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CustomNodeData } from '@/components/workflow/CustomNode'
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas'

interface Workflow {
  id: string
  name: string
  workflow_definition: {
    nodes: Node<CustomNodeData>[]
    edges: Edge[]
  }
  created_at: string
}

interface WorkflowRun {
  id: string
  workflow_id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  inputs: Record<string, any>
  outputs: Record<string, any>
  created_at: string
  updated_at: string
}

const WorkflowExecution = () => {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [nodes, setNodes] = useState<Node<CustomNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node<CustomNodeData> | null>(null)
  const [executionInputs, setExecutionInputs] = useState<Record<string, any>>({})
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null)

  // Fetch workflow details
  const { data: workflow, isLoading: workflowLoading, error: workflowError } = useQuery<Workflow>({
    queryKey: ['workflow', workflowId],
    queryFn: async () => {
      if (!workflowId) throw new Error('No workflow ID provided')
      const response = await workflowAPI.getWorkflow(workflowId)
      return response.data
    },
    enabled: !!workflowId,
  })

  // Execute workflow mutation
  const executeWorkflowMutation = useMutation({
    mutationFn: async (inputs: Record<string, any>) => {
      if (!workflowId) throw new Error('No workflow ID')
      const response = await workflowRunAPI.createWorkflowRun(workflowId, inputs)
      return response.data
    },
    onSuccess: (run: WorkflowRun) => {
      setCurrentRun(run)
      toast({
        title: "Workflow Started",
        description: `Workflow execution started with ID: ${run.id.slice(0, 8)}...`,
      })
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.response?.data?.detail || "Failed to start workflow execution",
        variant: "destructive",
      })
    }
  })

  // Load workflow data when available
  useEffect(() => {
    if (workflow) {
      const loadedNodes = workflow.workflow_definition.nodes.map(node => ({
        ...node,
        type: 'customNode',
        data: {
          label: node.data.label || node.data.nodeType || node.type || 'Unknown Node',
          nodeType: node.data.nodeType || node.type || 'unknown',
          config: node.data.config || {}
        }
      }))
      
      setNodes(loadedNodes)
      setEdges(workflow.workflow_definition.edges)
      
      // Initialize execution inputs from node configs
      const inputs: Record<string, any> = {}
      loadedNodes.forEach(node => {
        if (node.data.config) {
          inputs[node.id] = { ...node.data.config }
        }
      })
      setExecutionInputs(inputs)
    }
  }, [workflow])

  const handleNodeSelect = (node: Node<CustomNodeData> | null) => {
    setSelectedNode(node)
  }

  const handleConfigUpdate = (nodeId: string, config: Record<string, any>) => {
    setExecutionInputs(prev => ({
      ...prev,
      [nodeId]: config
    }))
    
    // Update the node in the canvas for visual feedback
    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, config } }
          : node
      )
    )
  }

  const handleExecuteWorkflow = () => {
    executeWorkflowMutation.mutate(executionInputs)
  }

  const getExecutionStatusIcon = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Settings className="h-4 w-4 text-gray-500" />
    }
  }

  if (workflowLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading workflow...</p>
        </div>
      </div>
    )
  }

  if (workflowError || !workflow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600">Failed to load workflow</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/workflows')}
              className="mt-4"
            >
              Back to Workflows
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workflows')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Execute Workflow</h1>
              <p className="text-muted-foreground">
                {workflow.name || `Workflow ${workflow.id.slice(0, 8)}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {currentRun && (
              <div className="flex items-center gap-2 text-sm">
                {getExecutionStatusIcon(currentRun.status)}
                <span>Status: {currentRun.status}</span>
              </div>
            )}
            
            <Button
              onClick={handleExecuteWorkflow}
              disabled={executeWorkflowMutation.isPending}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {executeWorkflowMutation.isPending ? 'Starting...' : 'Execute Workflow'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Workflow Canvas */}
        <div className="flex-1">
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodeSelect={handleNodeSelect}
            readOnly={true} // Enable read-only mode for execution
          />
        </div>

        {/* Configuration Panel */}
        <div className="w-96 p-4 bg-gray-50 border-l space-y-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Node Configuration
              </CardTitle>
              <CardDescription>
                Configure node parameters before execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <NodeConfigForm
                  node={selectedNode}
                  config={executionInputs[selectedNode.id] || {}}
                  onConfigUpdate={(config) => handleConfigUpdate(selectedNode.id, config)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a node to configure its parameters
                </p>
              )}
            </CardContent>
          </Card>

          {/* Execution Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Nodes:</span>
                  <span>{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Configured Nodes:</span>
                  <span>{Object.keys(executionInputs).length}</span>
                </div>
                {currentRun && (
                  <>
                    <div className="flex justify-between">
                      <span>Run ID:</span>
                      <span className="font-mono text-xs">{currentRun.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="flex items-center gap-1">
                        {getExecutionStatusIcon(currentRun.status)}
                        {currentRun.status}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Node configuration form component
interface NodeConfigFormProps {
  node: Node<CustomNodeData>
  config: Record<string, any>
  onConfigUpdate: (config: Record<string, any>) => void
}

const NodeConfigForm: React.FC<NodeConfigFormProps> = ({ node, config, onConfigUpdate }) => {
  const handleInputChange = (key: string, value: any) => {
    onConfigUpdate({
      ...config,
      [key]: value
    })
  }

  const getConfigFields = (nodeType: string) => {
    switch (nodeType) {
      case 'StructuredPromptGenerateV2':
        return [
          { key: 'prompt', label: 'Prompt', type: 'textarea', required: true }
        ]
      case 'ImageGenerateV2':
        return [
          { key: 'prompt', label: 'Prompt', type: 'textarea', required: false },
          { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', options: ['1:1', '16:9', '9:16', '4:3', '3:4'], required: false },
          { key: 'steps_num', label: 'Steps', type: 'number', min: 1, max: 100, required: false }
        ]
      case 'ImageRefineV2':
        return [
          { key: 'refinement_prompt', label: 'Refinement Prompt', type: 'textarea', required: true },
          { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', options: ['1:1', '16:9', '9:16', '4:3', '3:4'], required: false },
          { key: 'steps_num', label: 'Steps', type: 'number', min: 1, max: 100, required: false }
        ]
      default:
        return []
    }
  }

  const fields = getConfigFields(node.data.nodeType)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">{node.data.label}</h3>
        <p className="text-xs text-muted-foreground mb-4">Type: {node.data.nodeType}</p>
      </div>

      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {field.type === 'textarea' ? (
            <Textarea
              id={field.key}
              value={config[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              rows={4}
            />
          ) : field.type === 'select' ? (
            <select
              id={field.key}
              value={config[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select {field.label}</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : field.type === 'number' ? (
            <Input
              id={field.key}
              type="number"
              value={config[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, parseInt(e.target.value) || '')}
              min={field.min}
              max={field.max}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          ) : (
            <Input
              id={field.key}
              value={config[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          )}
        </div>
      ))}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No configurable parameters for this node type.
        </p>
      )}
    </div>
  )
}

export default WorkflowExecution