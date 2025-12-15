import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

export interface CustomNodeData {
  label: string;
  nodeType: string;
  config: Record<string, any>;
  isSelected?: boolean;
  executionStatus?: {
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_APPROVAL';
    hasOutput: boolean;
    error?: string;
  };
}

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const getNodeColor = (nodeType: string, executionStatus?: CustomNodeData['executionStatus']) => {
    // If there's execution status, use status-based colors
    if (executionStatus) {
      switch (executionStatus.status) {
        case 'RUNNING':
          return 'bg-blue-100 border-blue-300 animate-pulse';
        case 'COMPLETED':
          return 'bg-green-100 border-green-300';
        case 'FAILED':
          return 'bg-red-100 border-red-300';
        case 'WAITING_APPROVAL':
          return 'bg-orange-100 border-orange-300';
        case 'PENDING':
          return 'bg-yellow-100 border-yellow-300';
        default:
          break;
      }
    }
    
    // Default colors based on node type
    switch (nodeType) {
      case 'ImageGenerateV2':
        return 'bg-blue-50 border-blue-200';
      case 'ImageGenerateLiteV2':
        return 'bg-cyan-50 border-cyan-200';
      case 'StructuredPromptGenerateV2':
        return 'bg-green-50 border-green-200';
      case 'StructuredPromptGenerateLiteV2':
        return 'bg-emerald-50 border-emerald-200';
      case 'ImageRefineV2':
        return 'bg-purple-50 border-purple-200';
      case 'ImageRefineLiteV2':
        return 'bg-violet-50 border-violet-200';
      // Legacy support for old node types
      case 'GenerateImageV2':
        return 'bg-blue-50 border-blue-200';
      case 'StructuredPromptV2':
        return 'bg-green-50 border-green-200';
      case 'RefineImageV2':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'ImageGenerateV2':
        return '🎨';
      case 'ImageGenerateLiteV2':
        return '🎭';
      case 'StructuredPromptGenerateV2':
        return '📝';
      case 'StructuredPromptGenerateLiteV2':
        return '📋';
      case 'ImageRefineV2':
        return '✨';
      case 'ImageRefineLiteV2':
        return '🔧';
      // Legacy support for old node types
      case 'GenerateImageV2':
        return '🎨';
      case 'StructuredPromptV2':
        return '📝';
      case 'RefineImageV2':
        return '✨';
      default:
        return '⚙️';
    }
  };

  const hasInputs = (nodeType: string) => {
    // Define which node types can accept inputs
    switch (nodeType) {
      case 'ImageGenerateV2':
      case 'GenerateImageV2':
        return true; // Can accept structured_prompt inputs
      case 'StructuredPromptV2':
      case 'StructuredPromptGenerateV2':
        return true; // Can accept image inputs (optional)
      case 'RefineImageV2':
      case 'ImageRefineV2':
        return true; // Requires image inputs
      case 'ImageGenerateLiteV2':
      case 'StructuredPromptGenerateLiteV2':
      case 'ImageRefineLiteV2':
        return true; // Lite versions also accept inputs
      default:
        return false;
    }
  };

  const hasOutputs = () => true; // All nodes have outputs

  const getExecutionStatusIcon = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return '⏳';
      case 'COMPLETED':
        return '✅';
      case 'FAILED':
        return '❌';
      case 'WAITING_APPROVAL':
        return '⏸️';
      case 'PENDING':
        return '⏱️';
      default:
        return null;
    }
  };

  return (
    <>
      {/* Input handles */}
      {hasInputs(data.nodeType) && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />
      )}
      
      <Card className={`min-w-[200px] ${getNodeColor(data.nodeType, data.executionStatus)} ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-lg">{getNodeIcon(data.nodeType)}</span>
            {data.label || data.nodeType}
            {data.executionStatus && (
              <span className="text-sm">
                {getExecutionStatusIcon(data.executionStatus.status)}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs w-fit">
              {data.nodeType}
            </Badge>
            {data.executionStatus && (
              <Badge 
                variant={data.executionStatus.status === 'COMPLETED' ? 'default' : 'outline'} 
                className="text-xs w-fit"
              >
                {data.executionStatus.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-gray-600">
            {data.executionStatus?.error ? (
              <div className="text-red-600 mb-2">
                <span className="font-medium">Error:</span> {data.executionStatus.error}
              </div>
            ) : null}
            
            {Object.keys(data.config || {}).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(data.config || {}).slice(0, 2).map(([key, value]) => (
                  <div key={key} className="truncate">
                    <span className="font-medium">{key}:</span>{' '}
                    <span>{String(value).substring(0, 20)}{String(value).length > 20 ? '...' : ''}</span>
                  </div>
                ))}
                {Object.keys(data.config || {}).length > 2 && (
                  <div className="text-gray-400">
                    +{Object.keys(data.config || {}).length - 2} more...
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-400">No configuration</span>
            )}
            
            {data.executionStatus?.hasOutput && (
              <div className="mt-2 text-green-600">
                <span className="font-medium">✓ Output available</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Output handles */}
      {hasOutputs() && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />
      )}
    </>
  );
};

export default CustomNode;