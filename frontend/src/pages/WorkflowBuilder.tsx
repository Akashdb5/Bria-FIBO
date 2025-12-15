import { useState } from 'react';
import { Node, Edge } from 'reactflow';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import NodeConfigPanel from '../components/workflow/NodeConfigPanel';
import WorkflowValidationPanel from '../components/workflow/WorkflowValidationPanel';
import WorkflowActions from '../components/workflow/WorkflowActions';
import { CustomNodeData } from '../components/workflow/CustomNode';

const WorkflowBuilder = () => {
  const [nodes, setNodes] = useState<Node<CustomNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<CustomNodeData> | null>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string>('');
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string>('');

  const handleNodesChange = (updatedNodes: Node<CustomNodeData>[]) => {
    setNodes(updatedNodes);
    // Update selected node if it was modified
    if (selectedNode) {
      const updatedSelectedNode = updatedNodes.find(n => n.id === selectedNode.id);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      }
    }
  };

  const handleEdgesChange = (updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  };

  const handleNodeSelect = (node: Node<CustomNodeData> | null) => {
    setSelectedNode(node);
  };

  const handleNodeConfigUpdate = (nodeId: string, config: Record<string, any>) => {
    const updatedNodes = nodes.map((node) =>
      node.id === nodeId
        ? {
          ...node,
          data: {
            ...node.data,
            config,
          },
        }
        : node
    );
    setNodes(updatedNodes);

    // Update selected node if it was the one being configured
    if (selectedNode && selectedNode.id === nodeId) {
      const updatedSelectedNode = updatedNodes.find(n => n.id === nodeId);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      }
    }
  };

  const handleCloseConfigPanel = () => {
    setSelectedNode(null);
  };

  const handleWorkflowLoad = (
    loadedNodes: Node<CustomNodeData>[],
    loadedEdges: Edge[],
    workflowId: string,
    workflowName: string
  ) => {
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setCurrentWorkflowId(workflowId);
    setCurrentWorkflowName(workflowName);
    setSelectedNode(null);
  };

  const handleWorkflowSaved = (workflowId: string, workflowName: string) => {
    setCurrentWorkflowId(workflowId);
    setCurrentWorkflowName(workflowName);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode(null);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 border-b bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflow Builder</h1>
            <p className="text-muted-foreground">
              Create visual workflows using a node-based editor.
            </p>
          </div>
          <WorkflowActions
            nodes={nodes}
            edges={edges}
            currentWorkflowId={currentWorkflowId}
            currentWorkflowName={currentWorkflowName}
            onWorkflowLoad={handleWorkflowLoad}
            onWorkflowSaved={handleWorkflowSaved}
          />
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1">
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeSelect={handleNodeSelect}
            onNodeConfigUpdate={handleNodeConfigUpdate}
          />
        </div>

        {/* Configuration Panel */}
        <div className="p-4 bg-gray-50 border-l space-y-4">
          <NodeConfigPanel
            selectedNode={selectedNode}
            onNodeUpdate={handleNodeConfigUpdate}
            onClose={handleCloseConfigPanel}
            onDelete={handleDeleteNode}
          />

          <WorkflowValidationPanel
            nodes={nodes}
            edges={edges}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;