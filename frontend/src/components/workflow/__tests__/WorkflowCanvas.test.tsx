import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from 'reactflow'
import WorkflowCanvas from '../WorkflowCanvas'

// Mock ReactFlow components
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow')
  return {
    ...actual,
    ReactFlow: ({ nodes, edges, readOnly }: any) => (
      <div data-testid="react-flow">
        <div data-testid="nodes-count">{nodes?.length || 0}</div>
        <div data-testid="edges-count">{edges?.length || 0}</div>
        <div data-testid="read-only">{readOnly ? 'true' : 'false'}</div>
      </div>
    ),
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
  }
})

// Mock NodeToolbar
vi.mock('../NodeToolbar', () => ({
  default: () => <div data-testid="node-toolbar">Node Toolbar</div>
}))

const mockNodes = [
  {
    id: 'node1',
    type: 'customNode',
    position: { x: 0, y: 0 },
    data: {
      label: 'Test Node',
      nodeType: 'StructuredPromptGenerateV2',
      config: { prompt: 'Test prompt' }
    }
  }
]

const mockEdges = [
  {
    id: 'edge1',
    source: 'node1',
    target: 'node2'
  }
]

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ReactFlowProvider>
      {component}
    </ReactFlowProvider>
  )
}

describe('WorkflowCanvas', () => {
  it('renders with initial nodes and edges', () => {
    renderWithProvider(
      <WorkflowCanvas
        initialNodes={mockNodes}
        initialEdges={mockEdges}
      />
    )

    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('1')
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1')
  })

  it('shows node toolbar in edit mode', () => {
    renderWithProvider(
      <WorkflowCanvas
        initialNodes={mockNodes}
        initialEdges={mockEdges}
        readOnly={false}
      />
    )

    expect(screen.getByTestId('node-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('read-only')).toHaveTextContent('false')
  })

  it('hides node toolbar in read-only mode', () => {
    renderWithProvider(
      <WorkflowCanvas
        initialNodes={mockNodes}
        initialEdges={mockEdges}
        readOnly={true}
      />
    )

    expect(screen.queryByTestId('node-toolbar')).not.toBeInTheDocument()
    expect(screen.getByTestId('read-only')).toHaveTextContent('true')
  })

  it('updates nodes when initialNodes prop changes', () => {
    const { rerender } = renderWithProvider(
      <WorkflowCanvas
        initialNodes={[]}
        initialEdges={[]}
      />
    )

    expect(screen.getByTestId('nodes-count')).toHaveTextContent('0')

    rerender(
      <ReactFlowProvider>
        <WorkflowCanvas
          initialNodes={mockNodes}
          initialEdges={mockEdges}
        />
      </ReactFlowProvider>
    )

    expect(screen.getByTestId('nodes-count')).toHaveTextContent('1')
  })
})