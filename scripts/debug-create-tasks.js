// Simple script to create sample tasks for debugging
const sampleTasks = [
  {
    id: 'debug-task-1',
    title: 'Debug Task 1 - Test Planning',
    description: 'Test task for debugging kanban board',
    status: 'planned',
    priority: 'high',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: null,
    instances: [],
    projectId: '1', // Default project
    parentTaskId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvasPosition: null,
    isInInbox: false,
    dependsOn: []
  },
  {
    id: 'debug-task-2',
    title: 'Debug Task 2 - In Progress',
    description: 'Another test task for debugging',
    status: 'in_progress',
    priority: 'medium',
    progress: 25,
    completedPomodoros: 1,
    subtasks: [],
    dueDate: null,
    instances: [],
    projectId: '1',
    parentTaskId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvasPosition: null,
    isInInbox: false,
    dependsOn: []
  },
  {
    id: 'debug-task-3',
    title: 'Debug Task 3 - Done',
    description: 'Completed test task',
    status: 'done',
    priority: 'low',
    progress: 100,
    completedPomodoros: 2,
    subtasks: [],
    dueDate: null,
    instances: [],
    projectId: '1',
    parentTaskId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvasPosition: null,
    isInInbox: false,
    dependsOn: []
  }
];

const sampleProjects = [
  {
    id: '1',
    name: 'Default Project',
    description: 'Default project for debugging',
    color: '#3b82f6',
    parentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

console.log('Creating sample debug tasks and projects...');

// In browser console, you can run:
// localStorage.setItem('tasks', JSON.stringify(sampleTasks));
// localStorage.setItem('projects', JSON.stringify(sampleProjects));
// location.reload();

console.log('Sample tasks:', sampleTasks);
console.log('Sample projects:', sampleProjects);
console.log('Run the following in browser console:');
console.log('localStorage.setItem("tasks", JSON.stringify(sampleTasks));');
console.log('localStorage.setItem("projects", JSON.stringify(sampleProjects));');
console.log('location.reload();');