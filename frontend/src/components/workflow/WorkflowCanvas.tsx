import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode, { CustomNodeData } from './CustomNode';
import NodeToolbar from './NodeToolbar';
import { isValidConnection, validateConnection } from './connectionValidation';

const nodeTypes: NodeTypes = {
  customNode: CustomNode,
};

interface WorkflowCanvasProps {
  initialNodes?: Node<CustomNodeData>[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node<CustomNodeData>[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeSelect?: (node: Node<CustomNodeData> | null) => void;
  onNodeConfigUpdate?: (nodeId: string, config: Record<string, any>) => void;
  readOnly?: boolean; // New prop for execution mode
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  readOnly = false,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesStateChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesStateChange] = useEdgesState(initialEdges);
  // const [selectedNode, setSelectedNode] = useState<Node<CustomNodeData> | null>(null);

  // Update nodes and edges when initialNodes/initialEdges change
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle node changes and notify parent
  const handleNodesChange = useCallback((changes: any) => {
    onNodesStateChange(changes);
    const updatedNodes = nodes; // This will be updated by the state change
    onNodesChange?.(updatedNodes);
  }, [onNodesStateChange, nodes, onNodesChange]);

  // Handle edge changes and notify parent
  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesStateChange(changes);
    const updatedEdges = edges; // This will be updated by the state change
    onEdgesChange?.(updatedEdges);
  }, [onEdgesStateChange, edges, onEdgesChange]);

  // Handle new connections with validation
  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return; // Prevent connections in read-only mode
      
      // Validate the connection before adding it
      if (isValidConnection(params, nodes)) {
        const newEdge = addEdge(params, edges);
        setEdges(newEdge);
        onEdgesChange?.(newEdge);
      } else {
        // Show validation error
        const validationResult = validateConnection(params, nodes);
        console.warn('Invalid connection:', validationResult.errors.join(', '));
        // You could show a toast notification here
      }
    },
    [edges, setEdges, onEdgesChange, nodes, readOnly]
  );

  // Connection validation function for ReactFlow
  const connectionValidator = useCallback(
    (connection: Connection) => {
      return isValidConnection(connection, nodes);
    },
    [nodes]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<CustomNodeData>) => {
      // setSelectedNode(node);
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );



  // Handle canvas click (deselect nodes)
  const onPaneClick = useCallback(() => {
    // setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Add new node from toolbar
  const onAddNode = useCallback(
    (nodeType: string) => {
      if (!reactFlowInstance || readOnly) return; // Prevent adding nodes in read-only mode

      const id = `${nodeType}-${Date.now()}`;
      const position = reactFlowInstance.project({
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      });

      const newNode: Node<CustomNodeData> = {
        id,
        type: 'customNode',
        position,
        data: {
          label: nodeType,
          nodeType,
          config: {},
        },
      };

      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      onNodesChange?.(updatedNodes);
    },
    [reactFlowInstance, nodes, setNodes, onNodesChange, readOnly]
  );

  // Handle drag and drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (readOnly) return; // Prevent dropping nodes in read-only mode

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const nodeType = event.dataTransfer.getData('application/reactflow');

      if (typeof nodeType === 'undefined' || !nodeType || !reactFlowInstance || !reactFlowBounds) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const id = `${nodeType}-${Date.now()}`;
      const newNode: Node<CustomNodeData> = {
        id,
        type: 'customNode',
        position,
        data: {
          label: nodeType,
          nodeType,
          config: {},
        },
      };

      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      onNodesChange?.(updatedNodes);
    },
    [reactFlowInstance, nodes, setNodes, onNodesChange, readOnly]
  );

  return (
    <div className="flex h-full">
      {/* Node Toolbar - Only show in edit mode */}
      {!readOnly && (
        <div className="p-4 bg-gray-50 border-r">
          <NodeToolbar onAddNode={onAddNode} />
        </div>
      )}

      {/* ReactFlow Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setReactFlowInstance}
          onDrop={readOnly ? undefined : onDrop}
          onDragOver={readOnly ? undefined : onDragOver}
          nodeTypes={nodeTypes}
          isValidConnection={readOnly ? undefined : connectionValidator}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={true} // Always allow selection for config
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
};

// Wrapper component with ReactFlowProvider
const WorkflowCanvasWrapper: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvasWrapper;