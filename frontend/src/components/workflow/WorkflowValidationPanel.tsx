import React from 'react';
import { Node, Edge } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CustomNodeData } from './CustomNode';
import { validateWorkflow } from './connectionValidation';

interface WorkflowValidationPanelProps {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
}

const WorkflowValidationPanel: React.FC<WorkflowValidationPanelProps> = ({
  nodes,
  edges,
}) => {
  const validation = validateWorkflow(nodes, edges);

  if (validation.valid && validation.warnings.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Workflow Valid
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Your workflow is valid and ready for execution.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {validation.valid ? (
            <span className="text-yellow-500">⚠</span>
          ) : (
            <span className="text-red-500">✗</span>
          )}
          Workflow Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {validation.errors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="destructive" className="text-xs">
                {validation.errors.length} Error{validation.errors.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <ul className="space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-xs text-red-600 flex items-start gap-1">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                {validation.warnings.length} Warning{validation.warnings.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <ul className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index} className="text-xs text-yellow-600 flex items-start gap-1">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {validation.hasCycles && (
          <div className="p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-xs text-red-700">
              <strong>Cycle Detected:</strong> Workflows cannot contain cycles.
            </p>
          </div>
        )}

        {validation.disconnectedNodes.length > 0 && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-700">
              <strong>Disconnected Nodes:</strong> {validation.disconnectedNodes.length} node{validation.disconnectedNodes.length > 1 ? 's' : ''} not connected to the workflow.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowValidationPanel;