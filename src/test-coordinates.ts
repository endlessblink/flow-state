

// Mock Simulation of the Fixes

// 1. Setup
const parentGroup = { id: 'G1', position: { x: 100, y: 100 }, parentGroupId: null } // Root
const childGroup = { id: 'G2', position: { x: 10, y: 10 }, parentGroupId: 'G1' } // Nested (Relative)
const task = { id: 'T1', canvasPosition: { x: 120, y: 120 } } // Task inside G2 (Absolute)

// Helper: getAbsolutePosition (Recursive)
const getSectionAbsolutePosition = (section: any, sections: any[]) => {
    let x = section.position.x
    let y = section.position.y
    let parent = sections.find(s => s.id === section.parentGroupId)
    while (parent) {
        x += parent.position.x
        y += parent.position.y
        parent = sections.find(s => s.id === parent.parentGroupId)
    }
    return { x, y }
}

console.log('--- Initial State ---')
console.log('G1 Absolute:', getSectionAbsolutePosition(parentGroup, [parentGroup, childGroup]))
console.log('G2 Absolute:', getSectionAbsolutePosition(childGroup, [parentGroup, childGroup]))
console.log('Task Absolute:', task.canvasPosition)

// 2. Simulate Sync (Logic from useCanvasSync.ts)
const simulateSync = (t: any, s: any, allSections: any[]) => {
    const sAbs = getSectionAbsolutePosition(s, allSections)
    const relX = t.canvasPosition.x - sAbs.x
    const relY = t.canvasPosition.y - sAbs.y
    return { x: relX, y: relY }
}

const taskRel = simulateSync(task, childGroup, [parentGroup, childGroup])
console.log('Task Relative to G2 (calculated in Sync):', taskRel)
// Expected: 120 - (100+10) = 10. Correct.

// 3. Simulate Dragging Parent G1 to (200, 200)
console.log('\n--- Drag G1 to 200, 200 ---')
parentGroup.position.x = 200
parentGroup.position.y = 200

// In useCanvasDragDrop (MY FIX 2), we DO NOT update childGroup.
// So childGroup remains x: 10, y: 10, parent: G1.

console.log('G1 New Absolute:', getSectionAbsolutePosition(parentGroup, [parentGroup, childGroup]))
console.log('G2 New Absolute (Visual):', getSectionAbsolutePosition(childGroup, [parentGroup, childGroup]))
// Expected G2 Abs: 200 + 10 = 210.

// In useCanvasDragDrop (MY FIX 3), we MUST update Task Absolute Position.
task.canvasPosition.x = 200 + 10 + 10 // New Parent Abs + Child Rel + Task Rel = 220
task.canvasPosition.y = 200 + 10 + 10 // 220
console.log('Task New Absolute (Updated by DragDrop):', task.canvasPosition)

// 4. Simulate Sync after Drag
const taskRelAfter = simulateSync(task, childGroup, [parentGroup, childGroup])
console.log('Task Relative to G2 (After Drag):', taskRelAfter)
// Expected: 220 - (200+10) = 10. Correct.

// 5. Simulate Dragging Nested Group G2
console.log('\n--- Drag G2 to Absolute 250, 250 ---')
// G1 is at 200, 200.
// We drag G2 to 250, 250.
const dragAbsX = 250
const dragAbsY = 250

// Logic from useCanvasDragDrop (MY FIX 1):
// Calculate Relative: Abs - ParentAbs
const parentAbs = getSectionAbsolutePosition(parentGroup, [parentGroup, childGroup])
const newRelX = dragAbsX - parentAbs.x // 250 - 200 = 50
const newRelY = dragAbsY - parentAbs.y // 250 - 200 = 50

childGroup.position.x = newRelX
childGroup.position.y = newRelY

console.log('G2 New Stored Relative:', childGroup.position)
console.log('G2 New Absolute (Visual):', getSectionAbsolutePosition(childGroup, [parentGroup, childGroup]))
// Expected: 200 + 50 = 250. Correct.

if (taskRel.x === 10 && taskRelAfter.x === 10 && childGroup.position.x === 50) {
    console.log('\n✅ VERIFICATION PASSED: Coordinate math holds up.')
} else {
    console.error('\n❌ VERIFICATION FAILED')
}

