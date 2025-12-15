import { Connection, Node } from 'reactflow';
import { CustomNodeData } from './CustomNode';

export interface ConnectionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Define the output types for each node type
const getNodeOutputTypes = (nodeType: string): string[] => {
  switch (nodeType) {
    case 'GenerateImageV2':
    case 'ImageGenerateV2':
      return ['image']; // Generates images
    case 'StructuredPromptV2':
    case 'StructuredPromptGenerateV2':
      return ['structured_prompt']; // Generates structured prompts
    case 'RefineImageV2':
    case 'ImageRefineV2':
      return ['image']; // Refines and outputs images
    default:
      return [];
  }
};

// Define the input types for each node type
const getNodeInputTypes = (nodeType: string): string[] => {
  switch (nodeType) {
    case 'GenerateImageV2':
    case 'ImageGenerateV2':
      return ['structured_prompt']; // Can accept structured prompts as input
    case 'StructuredPromptV2':
    case 'StructuredPromptGenerateV2':
      return ['image']; // Can accept images for analysis (optional)
    case 'RefineImageV2':
    case 'ImageRefineV2':
      return ['image']; // Requires image input for refinement
    default:
      return [];
  }
};

// Check if a connection between two node types is valid
export const validateConnection = (
  connection: Connection,
  nodes: Node<CustomNodeData>[]
): ConnectionValidationResult => {
  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      errors: ['Source or target node not found'],
      warnings: []
    };
  }

  const sourceNodeType = sourceNode.data.nodeType || sourceNode.type || 'unknown';
  const targetNodeType = targetNode.data.nodeType || targetNode.type || 'unknown';

  const sourceOutputTypes = getNodeOutputTypes(sourceNodeType);
  const targetInputTypes = getNodeInputTypes(targetNodeType);

  // Check if there's any compatible type between source outputs and target inputs
  const compatibleTypes = sourceOutputTypes.filter(outputType =>
    targetInputTypes.includes(outputType)
  );

  if (compatibleTypes.length === 0) {
    return {
      valid: false,
      errors: [
        `Cannot connect ${sourceNodeType} to ${targetNodeType}. ` +
        `Source outputs: [${sourceOutputTypes.join(', ')}], ` +
        `Target accepts: [${targetInputTypes.join(', ')}]`
      ],
      warnings: []
    };
  }

  // Additional validation rules
  const warnings: string[] = [];

  // Check for potential issues with GenerateImageV2 inputs
  if (targetNodeType === 'GenerateImageV2' || targetNodeType === 'ImageGenerateV2') {
    const hasPromptConfig = targetNode.data.config?.prompt;
    // const hasImagesConfig = targetNode.data.config?.images;
    // const hasStructuredPromptConfig = targetNode.data.config?.structured_prompt;

    if ((sourceNodeType === 'StructuredPromptV2' || sourceNodeType === 'StructuredPromptGenerateV2') && hasPromptConfig) {
      warnings.push(
        'ImageGenerateV2 node has a prompt configured. ' +
        'Connecting a StructuredPromptGenerateV2 node will override the prompt input.'
      );
    }

    if ((sourceNodeType === 'GenerateImageV2' || sourceNodeType === 'ImageGenerateV2') && hasPromptConfig) {
      warnings.push(
        'ImageGenerateV2 node has a prompt configured. ' +
        'Connecting another image source will override the prompt input.'
      );
    }
  }

  // Check for RefineImageV2 requirements
  if (targetNodeType === 'RefineImageV2' || targetNodeType === 'ImageRefineV2') {
    if (!sourceOutputTypes.includes('image') && !sourceOutputTypes.includes('structured_prompt')) {
      return {
        valid: false,
        errors: ['ImageRefineV2 requires an image or structured_prompt input'],
        warnings: []
      };
    }
  }

  return {
    valid: true,
    errors: [],
    warnings
  };
};

// ReactFlow connection validator function
export const isValidConnection = (connection: Connection, nodes: Node<CustomNodeData>[]): boolean => {
  const result = validateConnection(connection, nodes);
  return result.valid;
};

// Check for cycles in the workflow graph
export const hasCycles = (nodes: Node<CustomNodeData>[], edges: any[]): boolean => {
  const adjacencyList: Record<string, string[]> = {};

  // Build adjacency list
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });

  edges.forEach(edge => {
    if (adjacencyList[edge.source]) {
      adjacencyList[edge.source].push(edge.target);
    }
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of adjacencyList[nodeId] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of Object.keys(adjacencyList)) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        return true;
      }
    }
  }

  return false;
};

// Find disconnected nodes (nodes with no inputs or outputs)
export const findDisconnectedNodes = (nodes: Node<CustomNodeData>[], edges: any[]): string[] => {
  const connectedNodes = new Set<string>();

  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  return nodes
    .filter(node => !connectedNodes.has(node.id))
    .map(node => node.id);
};

// Comprehensive workflow validation
export const validateWorkflow = (
  nodes: Node<CustomNodeData>[],
  edges: any[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasCycles: boolean;
  disconnectedNodes: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for cycles
  const cyclesDetected = hasCycles(nodes, edges);
  if (cyclesDetected) {
    errors.push('Workflow contains cycles, which are not allowed');
  }

  // Check for disconnected nodes
  const disconnectedNodes = findDisconnectedNodes(nodes, edges);
  if (disconnectedNodes.length > 0) {
    warnings.push(`Found ${disconnectedNodes.length} disconnected nodes`);
  }

  // Validate all connections
  edges.forEach(edge => {
    const connectionResult = validateConnection(edge, nodes);
    if (!connectionResult.valid) {
      errors.push(...connectionResult.errors);
    }
    warnings.push(...connectionResult.warnings);
  });

  // Check for nodes without required configuration
  nodes.forEach(node => {
    const nodeType = node.data.nodeType || node.type || 'unknown';
    
    if (nodeType === 'RefineImageV2' || nodeType === 'ImageRefineV2') {
      const hasImageUrl = node.data.config?.image_url;
      const hasImageInput = edges.some(edge => edge.target === node.id);

      if (!hasImageUrl && !hasImageInput) {
        warnings.push(`ImageRefineV2 node "${node.id}" requires either an image_url configuration or an image/structured_prompt input connection`);
      }
    }

    if (nodeType === 'StructuredPromptV2' || nodeType === 'StructuredPromptGenerateV2') {
      const hasPrompt = node.data.config?.prompt;
      const hasImageUrl = node.data.config?.image_url;
      const hasImageInput = edges.some(edge => edge.target === node.id);

      if (!hasPrompt && !hasImageUrl && !hasImageInput) {
        warnings.push(`StructuredPromptGenerateV2 node "${node.id}" requires either a prompt, image_url configuration, or an image input connection`);
      }
    }

    if (nodeType === 'GenerateImageV2' || nodeType === 'ImageGenerateV2') {
      const hasPrompt = node.data.config?.prompt;
      const hasImages = node.data.config?.images;
      const hasStructuredPrompt = node.data.config?.structured_prompt;
      const hasInput = edges.some(edge => edge.target === node.id);

      if (!hasPrompt && !hasImages && !hasStructuredPrompt && !hasInput) {
        warnings.push(`ImageGenerateV2 node "${node.id}" requires either a prompt, images, structured_prompt configuration, or an input connection`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasCycles: cyclesDetected,
    disconnectedNodes
  };
};