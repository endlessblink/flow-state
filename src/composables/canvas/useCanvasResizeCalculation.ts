
/**
 * Pure mathematical calculations for canvas resizing logic.
 * Segregated for testability and clarity.
 */



interface Constraints {
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
}

export function useCanvasResizeCalculation() {

    /**
     * Validates and constrains resize dimensions
     */
    const validateDimensions = (width: number, height: number, constraints: Constraints = { minWidth: 200, maxWidth: 50000, minHeight: 80, maxHeight: 50000 }) => {
        return {
            width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, Math.abs(width))),
            height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, Math.abs(height)))
        }
    }

    /**
     * Calculates the relative position of a child node during a parent resize operation.
     * Implements "Inverse Delta Compensation" which keeps the child visually stationary
     * by moving it in the opposite direction of the parent's top-left origin shift.
     */
    const calculateChildInverseDelta = (
        childStartPos: { x: number; y: number },
        deltaX: number,
        deltaY: number
    ) => {
        return {
            x: childStartPos.x - deltaX,
            y: childStartPos.y - deltaY
        }
    }

    /**
     * Calculates the absolute position of a child when its parent moves to a new absolute position.
     * Used when persisting changes to the backend.
     */
    const calculateChildAbsolutePosition = (
        parentNewAbsPos: { x: number; y: number },
        childNewRelPos: { x: number; y: number }
    ) => {
        return {
            x: parentNewAbsPos.x + childNewRelPos.x,
            y: parentNewAbsPos.y + childNewRelPos.y
        }
    }

    return {
        validateDimensions,
        calculateChildInverseDelta,
        calculateChildAbsolutePosition
    }
}
