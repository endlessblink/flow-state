import localforage from 'localforage';

// Configure localforage for Pomo-Flow
const db = localforage.createInstance({
  name: 'pomo-flow',
  version: 1.0,
  storeName: 'pomo_flow_data',
  description: 'Pomo-Flow productivity data storage'
});

// Test tasks to create
const testTasks = [
  {
    id: 'test-1',
    title: 'Test Focus Mode Task',
    description: 'This is a test task for verifying focus mode functionality works correctly',
    status: 'planned',
    priority: 'high',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: new Date().toLocaleDateString(),
    projectId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: true,
    canvasPosition: undefined,
    instances: []
  },
  {
    id: 'test-2',
    title: 'Test Context Menu Positioning',
    description: 'Task for testing context menu smart positioning near screen edges',
    status: 'in_progress',
    priority: 'medium',
    progress: 25,
    completedPomodoros: 1,
    subtasks: [],
    dueDate: new Date().toLocaleDateString(),
    projectId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: true,
    canvasPosition: undefined,
    instances: []
  },
  {
    id: 'test-3',
    title: 'Test Low Priority Task',
    description: 'Low priority task for testing context menu priority changes',
    status: 'planned',
    priority: 'low',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: new Date().toLocaleDateString(),
    projectId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: true,
    canvasPosition: undefined,
    instances: []
  }
];

async function addTestTasks() {
  try {
    console.log('🔧 Adding test tasks to IndexedDB...');

    // Save tasks to database
    await db.setItem('tasks', JSON.stringify(testTasks));

    console.log('✅ Successfully added 3 test tasks');
    console.log('Tasks added:');
    testTasks.forEach(task => {
      console.log(`  - ${task.title} (ID: ${task.id}, Priority: ${task.priority})`);
    });

    // Verify they were saved
    const saved = await db.getItem('tasks');
    const parsed = JSON.parse(saved);
    console.log(`✅ Verification: ${parsed.length} tasks in database`);

  } catch (error) {
    console.error('❌ Failed to add test tasks:', error);
  }
}

// Run the function
addTestTasks().then(() => {
  console.log('🎉 Test data setup complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Setup failed:', error);
  process.exit(1);
});