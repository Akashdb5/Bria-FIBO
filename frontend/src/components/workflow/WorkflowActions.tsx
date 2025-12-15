import React, { useState } from 'react';
import { Node, Edge } from 'reactflow';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { CustomNodeData } from './CustomNode';
import { workflowAPI } from '../../lib/api';
import { useToast } from '../../hooks/use-toast';

interface WorkflowActionsProps {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  currentWorkflowId?: string;
  currentWorkflowName?: string;
  onWorkflowLoad: (nodes: Node<CustomNodeData>[], edges: Edge[], workflowId: string, workflowName: string) => void;
  onWorkflowSaved: (workflowId: string, workflowName: string) => void;
}

interface SavedWorkflow {
  id: string;
  name: string;
  created_at: string;
  workflow_definition: {
    nodes: Node<CustomNodeData>[];
    edges: Edge[];
  };
}

const WorkflowActions: React.FC<WorkflowActionsProps> = ({
  nodes,
  edges,
  currentWorkflowId,
  currentWorkflowName,
  onWorkflowLoad,
  onWorkflowSaved,
}) => {
  const [workflowName, setWorkflowName] = useState(currentWorkflowName || '');
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const { toast } = useToast();

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workflow name",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const workflowData = {
        name: workflowName.trim(),
        workflow_definition: {
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: {
              label: node.data.label,
              nodeType: node.data.nodeType,
              config: node.data.config || {}
            }
          })),
          edges: edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle
          }))
        }
      };

      let response;
      if (currentWorkflowId) {
        // Update existing workflow
        response = await workflowAPI.updateWorkflow(currentWorkflowId, workflowData);
      } else {
        // Create new workflow
        response = await workflowAPI.createWorkflow(workflowData);
      }

      const savedWorkflow = response.data;
      onWorkflowSaved(savedWorkflow.id, savedWorkflow.name);
      setShowSaveDialog(false);

      toast({
        title: "Success",
        description: `Workflow "${workflowName}" saved successfully`,
      });
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save workflow",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadWorkflows = async () => {
    setIsLoading(true);
    try {
      const response = await workflowAPI.getWorkflows();
      setSavedWorkflows(response.data.workflows || []);
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load workflows",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadWorkflow = async (workflow: SavedWorkflow) => {
    try {
      // Convert the saved workflow format back to ReactFlow format
      const loadedNodes: Node<CustomNodeData>[] = workflow.workflow_definition.nodes.map(node => ({
        ...node,
        type: 'customNode', // Ensure ReactFlow node type is set correctly
        data: {
          label: node.data.label || node.data.nodeType || node.type || 'Unknown Node',
          nodeType: node.data.nodeType || node.type || 'unknown', // Use nodeType from data or fallback to type
          config: node.data.config || {}
        }
      }));

      const loadedEdges: Edge[] = workflow.workflow_definition.edges;

      onWorkflowLoad(loadedNodes, loadedEdges, workflow.id, workflow.name);
      setWorkflowName(workflow.name);
      setShowLoadDialog(false);

      toast({
        title: "Success",
        description: `Workflow "${workflow.name}" loaded successfully`,
      });
    } catch (error: any) {
      console.error('Error loading workflow:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow",
        variant: "destructive",
      });
    }
  };

  const handleNewWorkflow = () => {
    onWorkflowLoad([], [], '', '');
    setWorkflowName('');
    toast({
      title: "New Workflow",
      description: "Started a new workflow",
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleNewWorkflow}
      >
        New
      </Button>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {currentWorkflowId ? 'Save' : 'Save As'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentWorkflowId ? 'Save Workflow' : 'Save Workflow As'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWorkflow}
                disabled={isSaving || !workflowName.trim()}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadWorkflows}
          >
            Load
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4">
                <p>Loading workflows...</p>
              </div>
            ) : savedWorkflows.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">No saved workflows found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedWorkflows.map((workflow) => (
                  <Card
                    key={workflow.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleLoadWorkflow(workflow)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{workflow.name}</h3>
                          <p className="text-sm text-gray-500">
                            {workflow.workflow_definition.nodes.length} nodes, {workflow.workflow_definition.edges.length} connections
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(workflow.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadWorkflow(workflow);
                          }}
                        >
                          Load
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {currentWorkflowName && (
        <span className="text-sm text-gray-600 ml-2">
          Current: {currentWorkflowName}
        </span>
      )}
    </div>
  );
};

export default WorkflowActions;