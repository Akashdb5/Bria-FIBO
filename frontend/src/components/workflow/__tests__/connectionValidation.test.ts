import { describe, it, expect } from 'vitest'
import { validateConnection } from '../connectionValidation'
import { Node } from 'reactflow'
import { CustomNodeData } from '../CustomNode'

describe('connectionValidation', () => {
  const mockNodes: Node<CustomNodeData>[] = [
    {
      id: 'structured_prompt_node',
      type: 'customNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Generate Ad Concept',
        nodeType: 'StructuredPromptGenerateV2',
        config: { prompt: 'Test prompt' }
      }
    },
    {
      id: 'image_generation_node',
      type: 'customNode',
      position: { x: 100, y: 0 },
      data: {
        label: 'Generate iPhone Ad',
        nodeType: 'ImageGenerateV2',
        config: { aspect_ratio: '16:9' }
      }
    },
    {
      id: 'refinement_node',
      type: 'customNode',
      position: { x: 200, y: 0 },
      data: {
        label: 'Enhance Advertisement',
        nodeType: 'ImageRefineV2',
        config: { refinement_prompt: 'Enhance the image' }
      }
    }
  ]

  it('should allow StructuredPromptGenerateV2 to connect to ImageGenerateV2', () => {
    const connection = {
      source: 'structured_prompt_node',
      target: 'image_generation_node',
      sourceHandle: 'output',
      targetHandle: 'input'
    }

    const result = validateConnection(connection, mockNodes)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should allow ImageGenerateV2 to connect to ImageRefineV2', () => {
    const connection = {
      source: 'image_generation_node',
      target: 'refinement_node',
      sourceHandle: 'output',
      targetHandle: 'input'
    }

    const result = validateConnection(connection, mockNodes)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should not allow ImageRefineV2 to connect to StructuredPromptGenerateV2', () => {
    const connection = {
      source: 'refinement_node',
      target: 'structured_prompt_node',
      sourceHandle: 'output',
      targetHandle: 'input'
    }

    const result = validateConnection(connection, mockNodes)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should handle missing nodes gracefully', () => {
    const connection = {
      source: 'nonexistent_node',
      target: 'image_generation_node',
      sourceHandle: 'output',
      targetHandle: 'input'
    }

    const result = validateConnection(connection, mockNodes)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Source or target node not found')
  })
})