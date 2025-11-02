// Load test tasks for completion circle testing
const { loadTestTasks } = require('./src/utils/testDataGenerator.ts');

console.log('Loading test tasks...');
loadTestTasks();
console.log('Test tasks loaded successfully!');