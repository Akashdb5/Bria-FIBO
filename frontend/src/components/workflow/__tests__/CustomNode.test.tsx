import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomNode from '../CustomNode'
import { NodeProps } from 'reactflow'
import { CustomNodeData } from '../CustomNode'

// Mock the Handle component from reactflow
vi.mock('reactflow', () => ({
  Handle: ({ type, id, position }: any) => (
    <div data-testid={`handle-${type}-${id}`} data-position={position}>
      {type} handle
    </div>
  ),
  Position: {
    Left: 'left',
    Right: 'right',
    Top: 'top',
    Bottom: 'bottom'
  }
}))

const createMockNodeProps = (nodeType: string, config: Record<string, any> = {}): NodeProps<CustomNodeData> => ({
  id: 'test-node',
  type: 'customNode',
  data: {
    label: 'Test Node',
    nodeType,
    config
  },
  selected: false,
  isConnectable: true,
  zIndex: 1,
  xPos: 0,
  yPos: 0,
  dragging: false
})

describe('CustomNode', () => {
  it('renders ImageGenerateV2 node with input and output handles', () => {
    const props = createMockNodeProps('ImageGenerateV2')
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.getByText('ImageGenerateV2')).toBeInTheDocument()
    expect(screen.getByTestId('handle-target-input')).toBeInTheDocument() // Input handle
    expect(screen.getByTestId('handle-source-output')).toBeInTheDocument() // Output handle
  })

  it('renders StructuredPromptGenerateV2 node with input and output handles', () => {
    const props = createMockNodeProps('StructuredPromptGenerateV2')
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.getByText('StructuredPromptGenerateV2')).toBeInTheDocument()
    expect(screen.getByTestId('handle-target-input')).toBeInTheDocument() // Input handle
    expect(screen.getByTestId('handle-source-output')).toBeInTheDocument() // Output handle
  })

  it('renders ImageRefineV2 node with input and output handles', () => {
    const props = createMockNodeProps('ImageRefineV2')
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.getByText('ImageRefineV2')).toBeInTheDocument()
    expect(screen.getByTestId('handle-target-input')).toBeInTheDocument() // Input handle
    expect(screen.getByTestId('handle-source-output')).toBeInTheDocument() // Output handle
  })

  it('displays node configuration when available', () => {
    const props = createMockNodeProps('StructuredPromptGenerateV2', {
      prompt: 'Test prompt for the node'
    })
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('prompt:')).toBeInTheDocument()
    expect(screen.getByText('Test prompt for the...')).toBeInTheDocument() // Truncated
  })

  it('shows "No configuration" when config is empty', () => {
    const props = createMockNodeProps('ImageGenerateV2', {})
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('No configuration')).toBeInTheDocument()
  })

  it('displays execution status when provided', () => {
    const props = createMockNodeProps('ImageGenerateV2')
    props.data.executionStatus = {
      status: 'COMPLETED',
      hasOutput: true
    }
    
    render(<CustomNode {...props} />)
    
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('✓ Output available')).toBeInTheDocument()
  })
})