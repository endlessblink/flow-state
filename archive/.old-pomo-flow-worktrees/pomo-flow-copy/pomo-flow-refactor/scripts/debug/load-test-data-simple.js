// Simple script to load test data directly in browser console
// Run this script in the browser console when the app is open

const loadTestTasksDirectly = () => {
  console.log('🚀 Loading test tasks for completion circle testing...');

  // Create test tasks with different priorities and progress levels
  const testTasks = [
    {
      id: 'test-high-1',
      title: 'High Priority Task - 0% Progress',
      description: 'High priority task with no progress',
      status: 'planned',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: new Date().toISOString().split('T')[0],
      projectId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances: [],
      isInInbox: true
    },
    {
      id: 'test-medium-1',
      title: 'Medium Priority Task - 0% Progress',
      description: 'Medium priority task with no progress',
      status: 'planned',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: new Date().toISOString().split('T')[0],
      projectId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances: [],
      isInInbox: true
    },
    {
      id: 'test-low-1',
      title: 'Low Priority Task - 0% Progress',
      description: 'Low priority task with no progress',
      status: 'planned',
      priority: 'low',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: new Date().toISOString().split('T')[0],
      projectId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances: [],
      isInInbox: true
    },
    {
      id: 'test-none-1',
      title: 'No Priority Task - 0% Progress',
      description: 'Task with no priority and no progress',
      status: 'planned',
      priority: null,
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: new Date().toISOString().split('T')[0],
      projectId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances: [],
      isInInbox: true
    },
    {
      id: 'test-high-2',
      title: 'High Priority Task - 100% Complete',
      description: 'High priority task that is completed',
      status: 'done',
      priority: 'high',
      progress: 100,
      completedPomodoros: 3,
      subtasks: [],
      dueDate: new Date().toISOString().split('T')[0],
      projectId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      instances: [],
      isInInbox: true
    }
  ];

  // Get the task store and add the tasks
  if (typeof window !== 'undefined' && window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('Vue devtools detected, trying to access task store...');

    // Try to find the task store through the Vue app
    const app = document.querySelector('#app').__vue_app__;
    if (app && app.config.globalProperties.$taskStore) {
      const taskStore = app.config.globalProperties.$taskStore;

      testTasks.forEach(task => {
        taskStore.createTask(task);
        console.log(`✅ Created task: ${task.title} (${task.priority || 'no priority'}, ${task.progress}% complete)`);
      });

      console.log('✅ All test tasks loaded successfully!');
      console.log(`Total tasks in store: ${taskStore.tasks.length}`);

      // Log task distribution
      const plannedCount = taskStore.tasks.filter(t => t.status === 'planned').length;
      const doneCount = taskStore.tasks.filter(t => t.status === 'done').length;

      console.log(`📊 Task distribution:`);
      console.log(`  - Planned: ${plannedCount}`);
      console.log(`  - Done: ${doneCount}`);

    } else {
      console.error('❌ Could not access task store');
    }
  } else {
    console.error('❌ Vue devtools not detected');
  }
};

// Auto-execute the function
loadTestTasksDirectly();

console.log('🎯 Test data script loaded. Execute loadTestTasksDirectly() in console to run manually.');