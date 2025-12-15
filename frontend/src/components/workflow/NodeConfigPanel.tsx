import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CustomNodeData } from './CustomNode';

interface NodeConfigPanelProps {
  selectedNode: Node<CustomNodeData> | null;
  onNodeUpdate: (nodeId: string, config: Record<string, any>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

interface NodeFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
}

const getNodeFieldConfigs = (nodeType: string): NodeFieldConfig[] => {
  switch (nodeType) {
    case 'ImageGenerateV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt for image generation. Can be combined with images or structured_prompt for refinement.'
        },
        {
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio for generated image'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of generation steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible generation (optional)'
        }
      ];
    case 'ImageGenerateLiteV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt for image generation using FIBO-VLM bridge. Can be combined with images or structured_prompt.'
        },
        {
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio for generated image'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of generation steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible generation (optional)'
        }
      ];
    case 'StructuredPromptGenerateV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt to convert to structured prompt. Can be combined with images for analysis.'
        }
      ];
    case 'StructuredPromptGenerateLiteV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt to convert to structured prompt using FIBO-VLM bridge. Can be combined with images.'
        }
      ];
    case 'ImageRefineV2':
      return [
        {
          key: 'image_url',
          label: 'Image URL',
          type: 'text',
          required: true,
          description: 'URL of the image to refine'
        },
        {
          key: 'refinement_prompt',
          label: 'Refinement Prompt',
          type: 'textarea',
          required: true,
          description: 'Text prompt describing the desired refinement changes'
        },
        {
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio for refined image'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of generation steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible refinement (optional)'
        }
      ];
    case 'ImageRefineLiteV2':
      return [
        {
          key: 'image_url',
          label: 'Image URL',
          type: 'text',
          required: true,
          description: 'URL of the image to refine'
        },
        {
          key: 'refinement_prompt',
          label: 'Refinement Prompt',
          type: 'textarea',
          required: true,
          description: 'Text prompt describing the desired refinement changes'
        },
        {
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio for refined image'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of generation steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible refinement (optional)'
        }
      ];
    // Legacy support for old node types
    case 'GenerateImageV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt for image generation (mutually exclusive with images/structured_prompt)'
        },
        {
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio for generated image'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of generation steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible generation (optional)'
        }
      ];
    case 'StructuredPromptV2':
      return [
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Text prompt to convert to structured prompt (mutually exclusive with image_url)'
        },
        {
          key: 'image_url',
          label: 'Image URL',
          type: 'text',
          description: 'Image URL to analyze for structured prompt (mutually exclusive with prompt)'
        }
      ];
    case 'RefineImageV2':
      return [
        {
          key: 'image_url',
          label: 'Image URL',
          type: 'text',
          required: true,
          description: 'URL of the image to refine'
        },
        {
          key: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          description: 'Optional text prompt for refinement guidance'
        },
        {
          key: 'strength',
          label: 'Strength',
          type: 'number',
          min: 0,
          max: 1,
          description: 'Refinement strength (0.0 to 1.0)'
        },
        {
          key: 'steps_num',
          label: 'Steps',
          type: 'number',
          min: 1,
          max: 100,
          description: 'Number of refinement steps (1-100)'
        },
        {
          key: 'seed',
          label: 'Seed',
          type: 'number',
          description: 'Random seed for reproducible refinement (optional)'
        }
      ];
    default:
      return [];
  }
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  selectedNode,
  onNodeUpdate,
  onClose,
  onDelete,
}) => {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data.config || {});
      setErrors({});
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <Card className="w-72 h-fit">
        <CardContent className="p-6 text-center text-gray-500">
          Select a node to configure its properties
        </CardContent>
      </Card>
    );
  }

  const fieldConfigs = getNodeFieldConfigs(selectedNode.data.nodeType);

  const validateField = (_key: string, value: any, fieldConfig: NodeFieldConfig): string | null => {
    if (fieldConfig.required && (!value || value === '')) {
      return `${fieldConfig.label} is required`;
    }

    if (fieldConfig.type === 'number' && value !== '' && value !== null && value !== undefined) {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return `${fieldConfig.label} must be a number`;
      }
      if (fieldConfig.min !== undefined && numValue < fieldConfig.min) {
        return `${fieldConfig.label} must be at least ${fieldConfig.min}`;
      }
      if (fieldConfig.max !== undefined && numValue > fieldConfig.max) {
        return `${fieldConfig.label} must be at most ${fieldConfig.max}`;
      }
    }

    return null;
  };

  const validateMutuallyExclusive = (newConfig: Record<string, any>): Record<string, string> => {
    const validationErrors: Record<string, string> = {};

    // V2 API allows more flexible input combinations
    // No strict mutual exclusivity validation needed for v2 nodes
    // The API will handle validation on the backend

    // Legacy validation for old node types
    if (selectedNode.data.nodeType === 'GenerateImageV2') {
      const hasPrompt = newConfig.prompt && newConfig.prompt.trim() !== '';
      const hasImages = newConfig.images && newConfig.images.length > 0;
      const hasStructuredPrompt = newConfig.structured_prompt && Object.keys(newConfig.structured_prompt).length > 0;

      const inputCount = [hasPrompt, hasImages, hasStructuredPrompt].filter(Boolean).length;

      if (inputCount > 1) {
        validationErrors.prompt = 'Only one of prompt, images, or structured_prompt can be provided';
        validationErrors.images = 'Only one of prompt, images, or structured_prompt can be provided';
        validationErrors.structured_prompt = 'Only one of prompt, images, or structured_prompt can be provided';
      }
    }

    if (selectedNode.data.nodeType === 'StructuredPromptV2') {
      const hasPrompt = newConfig.prompt && newConfig.prompt.trim() !== '';
      const hasImageUrl = newConfig.image_url && newConfig.image_url.trim() !== '';

      if (hasPrompt && hasImageUrl) {
        validationErrors.prompt = 'Only one of prompt or image_url should be provided';
        validationErrors.image_url = 'Only one of prompt or image_url should be provided';
      } else if (!hasPrompt && !hasImageUrl) {
        validationErrors.prompt = 'Either prompt or image_url must be provided';
        validationErrors.image_url = 'Either prompt or image_url must be provided';
      }
    }

    return validationErrors;
  };

  const handleFieldChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);

    // Validate individual field
    const fieldConfig = fieldConfigs.find(f => f.key === key);
    if (fieldConfig) {
      const fieldError = validateField(key, value, fieldConfig);
      const mutuallyExclusiveErrors = validateMutuallyExclusive(newConfig);

      setErrors(prev => ({
        ...prev,
        [key]: fieldError || '',
        ...Object.fromEntries(
          Object.entries(mutuallyExclusiveErrors).map(([k, v]) => [k, v || ''])
        )
      }));
    }

    // Auto-save configuration (real-time updates)
    onNodeUpdate(selectedNode.id, newConfig);
  };

  const renderField = (fieldConfig: NodeFieldConfig) => {
    const value = config[fieldConfig.key] || '';
    const error = errors[fieldConfig.key];

    switch (fieldConfig.type) {
      case 'textarea':
        return (
          <div key={fieldConfig.key} className="space-y-2">
            <Label htmlFor={fieldConfig.key}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <textarea
              id={fieldConfig.key}
              value={value}
              onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
              className="w-full p-2 border rounded-md resize-none h-20 text-sm"
              placeholder={fieldConfig.description}
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {fieldConfig.description && !error && (
              <p className="text-gray-500 text-xs">{fieldConfig.description}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldConfig.key} className="space-y-2">
            <Label htmlFor={fieldConfig.key}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <select
              id={fieldConfig.key}
              value={value}
              onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
              className="w-full p-2 border rounded-md text-sm"
            >
              <option value="">Select {fieldConfig.label}</option>
              {fieldConfig.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {fieldConfig.description && !error && (
              <p className="text-gray-500 text-xs">{fieldConfig.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldConfig.key} className="space-y-2">
            <Label htmlFor={fieldConfig.key}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldConfig.key}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value ? Number(e.target.value) : '')}
              min={fieldConfig.min}
              max={fieldConfig.max}
              placeholder={fieldConfig.description}
              className="text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {fieldConfig.description && !error && (
              <p className="text-gray-500 text-xs">{fieldConfig.description}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={fieldConfig.key} className="space-y-2">
            <Label htmlFor={fieldConfig.key}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldConfig.key}
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(fieldConfig.key, e.target.value)}
              placeholder={fieldConfig.description}
              className="text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {fieldConfig.description && !error && (
              <p className="text-gray-500 text-xs">{fieldConfig.description}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Card className="w-72 h-fit max-h-[80vh] overflow-y-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Configure {selectedNode.data.nodeType}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fieldConfigs.length > 0 ? (
          fieldConfigs.map(renderField)
        ) : (
          <p className="text-gray-500 text-sm">
            No configuration options available for this node type.
          </p>
        )}

        <div className="pt-4 mt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              onDelete(selectedNode.id);
              onClose();
            }}
          >
            Delete Node
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NodeConfigPanel;