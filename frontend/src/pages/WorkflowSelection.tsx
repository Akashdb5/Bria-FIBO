import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { 
  Play, 
  Search, 
  Filter,
  Calendar,
  User,
  Layers,
  ArrowRight,
  Workflow as WorkflowIcon
} from 'lucide-react'
import { workflowAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface Workflow {
  id: string
  name: string
  workflow_definition: {
    nodes: Array<{
      id: string
      type: string
      data: {
        label: string
        nodeType: string
        config: Record<string, any>
      }
    }>
    edges: Array<{
      id: string
      source: string
      target: string
    }>
  }
  user_id: string
  created_at: string
}

interface WorkflowsResponse {
  workflows: Workflow[]
  total: number
}

const WorkflowSelection = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch available workflows
  const { data: workflows, isLoading, error } = useQuery<WorkflowsResponse>({
    queryKey: ['workflows'],
    queryFn: async () => {
      const response = await workflowAPI.getWorkflows()
      return response.data
    },
  })

  // Filter workflows based on search term
  const filteredWorkflows = workflows?.workflows?.filter((workflow: Workflow) =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Get node type summary for a workflow
  const getNodeTypeSummary = (workflow: Workflow) => {
    const nodeTypes = workflow.workflow_definition?.nodes?.map(node => 
      node.data?.nodeType || node.type || 'Unknown'
    ) || []
    
    const uniqueTypes = [...new Set(nodeTypes)]
    return uniqueTypes.slice(0, 3).join(', ') + (uniqueTypes.length > 3 ? '...' : '')
  }

  // Handle workflow execution
  const handleExecuteWorkflow = (workflowId: string, workflowName: string) => {
    toast({
      title: "Loading Workflow",
      description: `Preparing ${workflowName} for execution...`,
    })
    navigate(`/workflows/execute/${workflowId}`)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Select Workflow to Execute</h1>
          <p className="text-muted-foreground">
            Choose a workflow from your collection to run with custom inputs.
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <WorkflowIcon className="h-12 w-12 mx-auto mb-4" />
              <p>Failed to load workflows. Please try again later.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Select Workflow to Execute</h1>
        <p className="text-muted-foreground">
          Choose a workflow from your collection to run with custom inputs.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Workflows</CardTitle>
          <CardDescription>
            {workflows?.total || 0} total workflows
            {filteredWorkflows.length !== workflows?.total && 
              ` (${filteredWorkflows.length} filtered)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading workflows...</p>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-8">
              <WorkflowIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                {workflows?.total === 0 ? 'No workflows found.' : 'No workflows match your search.'}
              </p>
              {workflows?.total === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Get started by creating your first workflow or seeding example workflows.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/workflows/builder')}
                    >
                      Create Workflow
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredWorkflows.map((workflow: Workflow) => (
                <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Workflow Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {workflow.name || `Workflow ${workflow.id.slice(0, 8)}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              ID: {workflow.id.slice(0, 8)}...
                            </p>
                          </div>
                          <Button
                            onClick={() => handleExecuteWorkflow(workflow.id, workflow.name)}
                            className="flex items-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Execute
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Workflow Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Nodes:</span>
                            <span className="font-medium">
                              {workflow.workflow_definition?.nodes?.length || 0}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Created:</span>
                            <span className="font-medium">
                              {format(new Date(workflow.created_at), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Owner:</span>
                            <span className="font-medium">
                              {workflow.user_id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        {/* Node Types Summary */}
                        {workflow.workflow_definition?.nodes?.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground mb-1">Node Types:</p>
                            <p className="text-sm font-medium">
                              {getNodeTypeSummary(workflow)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {workflows?.total === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-start gap-2"
                onClick={() => navigate('/workflows/builder')}
              >
                <div className="flex items-center gap-2">
                  <WorkflowIcon className="h-5 w-5" />
                  <span className="font-medium">Create New Workflow</span>
                </div>
                <p className="text-sm text-muted-foreground text-left">
                  Build a custom workflow from scratch using our visual editor.
                </p>
              </Button>
              
              <div className="h-auto p-4 flex flex-col items-start gap-2 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  <span className="font-medium">Example Workflows</span>
                </div>
                <p className="text-sm text-muted-foreground text-left">
                  Seed example iPhone ad workflows by running the seeding script in the backend.
                </p>
                <code className="text-xs bg-background px-2 py-1 rounded mt-1">
                  python examples/seed_example_workflows.py seed
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default WorkflowSelection