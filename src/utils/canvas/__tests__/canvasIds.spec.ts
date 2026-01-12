import { describe, it, expect } from 'vitest'
import { CanvasIds } from '../canvasIds'

describe('CanvasIds', () => {
    describe('groupNodeId', () => {
        it('should prefix a clean ID with section-', () => {
            expect(CanvasIds.groupNodeId('123')).toBe('section-123')
        })

        it('should not double-prefix if already prefixed', () => {
            expect(CanvasIds.groupNodeId('section-123')).toBe('section-123')
        })
    })

    describe('taskNodeId', () => {
        it('should return a clean task ID as is', () => {
            expect(CanvasIds.taskNodeId('abc-def')).toBe('abc-def')
        })

        it('should strip section- if passed a group ID (for error recovery)', () => {
            expect(CanvasIds.taskNodeId('section-abc')).toBe('abc')
        })
    })

    describe('parseNodeId', () => {
        it('should parse a group node ID correctly', () => {
            const result = CanvasIds.parseNodeId('section-789')
            expect(result).toEqual({ type: 'group', id: '789' })
        })

        it('should parse a task node ID correctly', () => {
            const result = CanvasIds.parseNodeId('task-456')
            expect(result).toEqual({ type: 'task', id: 'task-456' })
        })
    })

    describe('isGroupNode', () => {
        it('should return true for section- IDs', () => {
            expect(CanvasIds.isGroupNode('section-1')).toBe(true)
        })

        it('should return false for others', () => {
            expect(CanvasIds.isGroupNode('1')).toBe(false)
        })
    })

    describe('edgeId', () => {
        it('should format an edge ID correctly', () => {
            expect(CanvasIds.edgeId('source', 'target')).toBe('e-source-target')
        })
    })
})
