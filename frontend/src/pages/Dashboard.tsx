import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Calendar,
  Clock,
  Download,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Play,
  CheckCircle,
  XCircle,
  Pause,
  Eye,
  Image as ImageIcon,
  Plus
} from 'lucide-react'
import { workflowRunAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useError } from '@/contexts/ErrorContext'
import { useOfflineSupport } from '@/hooks/use-network-status'
import AsyncErrorBoundary from '@/components/AsyncErrorBoundary'
import { safeAsync } from '@/utils/error-handling'

interface WorkflowRun {
  id: string
  workflow_id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_APPROVAL'
  execution_snapshot: Record<string, any>
  created_at: string
  completed_at?: string
}

interface WorkflowRunsResponse {
  items: WorkflowRun[]
  total: number
  skip: number
  limit: number
}

type SortField = 'created_at' | 'completed_at' | 'status'
type SortDirection = 'asc' | 'desc'

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pending' },
  RUNNING: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Running' },
  COMPLETED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Completed' },
  FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  WAITING_APPROVAL: { icon: Pause, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Waiting Approval' }
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { handleError, showSuccessToast, showErrorToast } = useError()
  const { executeWithOfflineSupport } = useOfflineSupport()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null)

  const { data: workflowRuns, isLoading, error } = useQuery<WorkflowRunsResponse>({
    queryKey: ['workflow-runs'],
    queryFn: async () => {
      return executeWithOfflineSupport(
        async () => {
          const response = await workflowRunAPI.getWorkflowRuns()
          return response.data
        },
        // Fallback for offline mode - could return cached data
        async () => {
          // For now, just return empty data structure
          return { items: [], total: 0, skip: 0, limit: 10 }
        }
      )
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  })

  // Handle errors
  if (error) {
    handleError(error as Error, 'loading workflow runs')
  }

  // Extract images from execution snapshots
  const extractImages = (executionSnapshot: Record<string, any>): Array<{ nodeId: string, imageUrl: string, nodeType: string }> => {
    const images: Array<{ nodeId: string, imageUrl: string, nodeType: string }> = []

    // Check nodes
    const nodes = executionSnapshot.nodes || {}
    Object.entries(nodes).forEach(([nodeId, nodeData]: [string, any]) => {
      // Check for nested response.image_url (standard structure)
      if (nodeData?.response?.image_url) {
        images.push({
          nodeId,
          imageUrl: nodeData.response.image_url,
          nodeType: nodeData.node_type || 'Unknown'
        })
      }
      // Check for top-level image_url (flattened structure or direct output)
      else if (nodeData?.image_url) {
        images.push({
          nodeId,
          imageUrl: nodeData.image_url,
          nodeType: nodeData.node_type || 'Unknown'
        })
      }
      // Check for result.image_url (raw API response structure)
      else if (nodeData?.response?.result?.image_url) {
        images.push({
          nodeId,
          imageUrl: nodeData.response.result.image_url,
          nodeType: nodeData.node_type || 'Unknown'
        })
      }
      // Check for refined_image_url
      else if (nodeData?.response?.refined_image_url) {
        images.push({
          nodeId,
          imageUrl: nodeData.response.refined_image_url,
          nodeType: nodeData.node_type || 'Unknown'
        })
      }
    })

    return images
  }

  // Filter and sort workflow runs
  const filteredAndSortedRuns = useMemo(() => {
    if (!workflowRuns?.items) return []

    let filtered = workflowRuns.items

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((run: WorkflowRun) =>
        run.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.workflow_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((run: WorkflowRun) => run.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a: WorkflowRun, b: WorkflowRun) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'created_at':
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
        case 'completed_at':
          aValue = a.completed_at ? new Date(a.completed_at) : new Date(0)
          bValue = b.completed_at ? new Date(b.completed_at) : new Date(0)
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [workflowRuns?.items, searchTerm, statusFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleDownloadImage = async (imageUrl: string, nodeId: string) => {
    const result = await safeAsync(
      async () => {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `workflow-image-${nodeId}-${Date.now()}.jpg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        return true
      },
      false,
      (error) => handleError(error, 'downloading image')
    )

    if (result) {
      showSuccessToast("Download Started", "Image download has been initiated.")
    } else {
      showErrorToast("Download Failed", "Failed to download the image. Please try again.")
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            View your workflow execution history and generated outputs.
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <XCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Failed to load workflow runs. Please try again later.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          View your workflow execution history and generated outputs.
        </p>
      </div>

      {/* Quick Actions */}
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
              onClick={() => navigate('/workflows/execute')}
            >
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                <span className="font-medium">Execute Workflow</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Choose from available workflows and run them with custom inputs.
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => navigate('/workflows/builder')}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span className="font-medium">Create Workflow</span>
              </div>
              <p className="text-sm text-muted-foreground text-left">
                Build a new workflow from scratch using our visual editor.
              </p>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by run ID or workflow ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RUNNING">Running</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="WAITING_APPROVAL">Waiting Approval</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Runs</CardTitle>
          <CardDescription>
            {workflowRuns?.total || 0} total runs
            {filteredAndSortedRuns.length !== workflowRuns?.total &&
              ` (${filteredAndSortedRuns.length} filtered)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading workflow runs...</p>
            </div>
          ) : filteredAndSortedRuns.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No workflow runs found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sort Controls */}
              <div className="flex gap-2 pb-4 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('created_at')}
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  Created
                  {sortField === 'created_at' && (
                    sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('completed_at')}
                  className="flex items-center gap-1"
                >
                  <Clock className="h-4 w-4" />
                  Completed
                  {sortField === 'completed_at' && (
                    sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1"
                >
                  Status
                  {sortField === 'status' && (
                    sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Workflow Runs */}
              {filteredAndSortedRuns.map((run: WorkflowRun) => {
                const StatusIcon = statusConfig[run.status as keyof typeof statusConfig].icon
                const images = extractImages(run.execution_snapshot)

                return (
                  <Card key={run.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Run Details */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${statusConfig[run.status as keyof typeof statusConfig].bg}`}>
                                <StatusIcon className={`h-4 w-4 ${statusConfig[run.status as keyof typeof statusConfig].color}`} />
                              </div>
                              <div>
                                <p className="font-medium">Run {run.id.slice(0, 8)}</p>
                                <p className="text-sm text-muted-foreground">
                                  Workflow: {run.workflow_id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[run.status as keyof typeof statusConfig].bg} ${statusConfig[run.status as keyof typeof statusConfig].color}`}>
                              {statusConfig[run.status as keyof typeof statusConfig].label}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Created</p>
                              <p className="font-medium">
                                {format(new Date(run.created_at), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                            {run.completed_at && (
                              <div>
                                <p className="text-muted-foreground">Completed</p>
                                <p className="font-medium">
                                  {format(new Date(run.completed_at), 'MMM dd, yyyy HH:mm')}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              {selectedRun?.id === run.id ? 'Hide Details' : 'View Details'}
                            </Button>
                          </div>
                        </div>

                        {/* Image Gallery */}
                        {images.length > 0 && (
                          <div className="lg:w-80">
                            <p className="text-sm font-medium mb-3">Generated Images ({images.length})</p>
                            <div className="grid grid-cols-2 gap-2">
                              {images.slice(0, 4).map((image, index) => (
                                <div key={`${image.nodeId}-${index}`} className="relative group">
                                  <img
                                    src={image.imageUrl}
                                    alt={`Generated by ${image.nodeType}`}
                                    className="w-full h-24 object-cover rounded-md border"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkM5Ljc5IDEzLjc5IDkuNzkgMTAuMjEgMTIgOEMxNC4yMSAxMC4yMSAxNC4yMSAxMy43OSAxMiAxNloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-md flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDownloadImage(image.imageUrl, image.nodeId)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                                    {image.nodeType}
                                  </div>
                                </div>
                              ))}
                              {images.length > 4 && (
                                <div className="w-full h-24 border rounded-md flex items-center justify-center bg-muted">
                                  <p className="text-sm text-muted-foreground">+{images.length - 4} more</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {selectedRun?.id === run.id && (
                        <div className="mt-6 pt-6 border-t">

                          {/* Images in Details View */}
                          {images.length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-medium mb-3">Generated Content</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map((image, index) => (
                                  <div key={`detail-${image.nodeId}-${index}`} className="border rounded-md p-2">
                                    <div className="relative group mb-2">
                                      <img
                                        src={image.imageUrl}
                                        alt={`Generated by ${image.nodeType}`}
                                        className="w-full h-48 object-contain bg-muted/50 rounded-md"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement
                                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkM5Ljc5IDEzLjc5IDkuNzkgMTAuMjEgMTIgOEMxNC4yMSAxMC4yMSAxNC4yMSAxMy43OSAxMiAxNloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-md flex items-center justify-center">
                                        <Button
                                          size="sm"
                                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => handleDownloadImage(image.imageUrl, image.nodeId)}
                                        >
                                          <Download className="h-4 w-4 mr-2" />
                                          Download
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">Node:</span> {image.nodeId.slice(0, 8)}...
                                      <br />
                                      <span className="text-muted-foreground">{image.nodeType}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <h4 className="font-medium mb-3">Execution Log (JSON)</h4>
                          <div className="bg-muted rounded-md p-4">
                            <pre className="text-sm overflow-auto max-h-96">
                              {JSON.stringify(run.execution_snapshot, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Wrap Dashboard with AsyncErrorBoundary for better error handling
const DashboardWithErrorBoundary = () => (
  <AsyncErrorBoundary>
    <Dashboard />
  </AsyncErrorBoundary>
)

export default DashboardWithErrorBoundary