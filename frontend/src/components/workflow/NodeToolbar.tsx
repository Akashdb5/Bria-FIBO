import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface NodeType {
  type: string;
  label: string;
  description: string;
  icon: string;
}

const nodeTypes: NodeType[] = [
  {
    type: 'ImageGenerateV2',
    label: 'Generate Image (Gemini)',
    description: 'Generate images using Gemini 2.5 Flash VLM bridge',
    icon: '🎨'
  },
  {
    type: 'ImageGenerateLiteV2',
    label: 'Generate Image (Lite)',
    description: 'Generate images using FIBO-VLM bridge (Coming Soon)',
    icon: '🎭'
  },
  {
    type: 'StructuredPromptGenerateV2',
    label: 'Structured Prompt (Gemini)',
    description: 'Generate structured prompts using Gemini 2.5 Flash VLM',
    icon: '📝'
  },
  {
    type: 'StructuredPromptGenerateLiteV2',
    label: 'Structured Prompt (Lite)',
    description: 'Generate structured prompts using FIBO-VLM (Coming Soon)',
    icon: '📋'
  },
  {
    type: 'ImageRefineV2',
    label: 'Refine Image (Gemini)',
    description: 'Refine existing images using Gemini 2.5 Flash workflow',
    icon: '✨'
  },
  {
    type: 'ImageRefineLiteV2',
    label: 'Refine Image (Lite)',
    description: 'Refine existing images using FIBO-VLM workflow (Coming Soon)',
    icon: '🔧'
  }
];

interface NodeToolbarProps {
  onAddNode: (nodeType: string) => void;
}

const NodeToolbar: React.FC<NodeToolbarProps> = ({ onAddNode }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-64 h-fit">
      <CardHeader>
        <CardTitle className="text-sm">Node Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            className="p-3 border rounded-lg cursor-grab hover:bg-gray-50 transition-colors"
            draggable
            onDragStart={(event) => onDragStart(event, nodeType.type)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{nodeType.icon}</span>
              <span className="font-medium text-sm">{nodeType.label}</span>
            </div>
            <p className="text-xs text-gray-600">{nodeType.description}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 text-xs"
              onClick={() => onAddNode(nodeType.type)}
            >
              Add Node
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default NodeToolbar;