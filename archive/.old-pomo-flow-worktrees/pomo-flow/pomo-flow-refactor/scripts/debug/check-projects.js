const localforage = require('localforage');

const db = localforage.createInstance({
  name: 'pomo-flow',
  version: 1.0,
  storeName: 'pomo_flow_data'
});

(async () => {
  const projectsStr = await db.getItem('projects');
  if (projectsStr) {
    const projects = JSON.parse(projectsStr);
    console.log('Projects:', JSON.stringify(projects, null, 2));
  } else {
    console.log('No projects found');
  }
  
  const tasksStr = await db.getItem('tasks');
  if (tasksStr) {
    const tasks = JSON.parse(tasksStr);
    console.log('\nTasks:', JSON.stringify(tasks, null, 2));
  } else {
    console.log('No tasks found');
  }
})();
