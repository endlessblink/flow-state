type Point = { x: number; y: number }

type RectElement = {
  getBoundingClientRect: () => Pick<DOMRect, 'left' | 'top'>
}

type QueryRoot = {
  querySelector: (selector: string) => RectElement | null
}

export type VisualPositionNode = {
  position?: Point
  parentNode?: string
  computedPosition?: Point
}

export function getRenderedFlowPosition(
  nodeId: string,
  screenToFlowCoordinate: (point: Point) => Point,
  root: QueryRoot = document,
): Point | undefined {
  const escapedId = CSS.escape(nodeId)
  const element = root.querySelector(`[data-task-id="${escapedId}"]`)
    ?? root.querySelector(`[data-id="${escapedId}"]`)
  if (!element) return undefined

  const { left, top } = element.getBoundingClientRect()
  if (!Number.isFinite(left) || !Number.isFinite(top)) return undefined
  return screenToFlowCoordinate({ x: left, y: top })
}

export function resolveVisualNodePosition(
  nodeId: string,
  findNode: (id: string) => VisualPositionNode | undefined,
  screenToFlowCoordinate: (point: Point) => Point,
  root: QueryRoot = document,
): Point | undefined {
  const renderedPosition = getRenderedFlowPosition(nodeId, screenToFlowCoordinate, root)
  if (renderedPosition) return renderedPosition

  const node = findNode(nodeId)
  if (!node?.position) return undefined
  const computedPosition = node.computedPosition
  if (computedPosition && Number.isFinite(computedPosition.x) && Number.isFinite(computedPosition.y)) {
    return { x: computedPosition.x, y: computedPosition.y }
  }
  if (node.parentNode) {
    const parentNode = findNode(node.parentNode)
    if (parentNode?.position) {
      return {
        x: parentNode.position.x + node.position.x,
        y: parentNode.position.y + node.position.y,
      }
    }
  }
  return { x: node.position.x, y: node.position.y }
}
