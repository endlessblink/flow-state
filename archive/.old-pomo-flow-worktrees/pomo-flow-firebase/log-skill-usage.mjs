import { SkillLogger } from './.claude/skill-logger.js';

async function logRecentSkillUsage() {
  const logger = new SkillLogger();
  await logger.init();

  // Log the comprehensive-testing skill that was just used
  await logger.logSkillUsage(
    'comprehensive-testing',
    {
      invokedBy: 'Claude Code',
      context: 'Testing skill logging system',
      timestamp: new Date().toISOString()
    },
    'success',
    500 // Estimated duration
  );

  console.log('✅ Recent comprehensive-testing skill usage logged!');

  // Show recent logs
  const recentLogs = await logger.getRecentLogs(3);
  console.log('\n📋 Recent skill usage:');
  recentLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log.skillName} - ${log.outcome} (${log.timestamp})`);
  });
}

logRecentSkillUsage().catch(console.error);