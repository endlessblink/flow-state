#!/usr/bin/env node

import IdeaIssueCreator from './index.js';

const creator = new IdeaIssueCreator();

// Get command from arguments
const command = process.argv[2] || 'help';

// Map commands to methods
const commands = {
  'process-ideas': () => creator.processIdeas(),
  'review-ideas': () => creator.reviewIdeas(),
  'ask-questions': () => creator.askQuestions(),
  'approve-all': () => creator.approveAll(),
  'status': () => creator.status(),
  'help': () => creator.help()
};

if (commands[command]) {
  commands[command]();
} else {
  console.log('❌ Unknown command:', command);
  creator.help();
}