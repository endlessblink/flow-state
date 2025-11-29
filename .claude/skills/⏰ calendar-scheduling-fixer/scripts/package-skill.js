#!/usr/bin/env node

/**
 * Skill Packaging Script
 *
 * This script packages the calendar-scheduling-fixer skill into a distributable zip file.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const SKILL_NAME = 'calendar-scheduling-fixer';
const SKILL_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(__dirname, '../../../dist');

console.log('📦 Packaging Calendar Scheduling Fixer Skill');
console.log('==========================================\n');

// Validation functions
function validateSkillStructure() {
  console.log('🔍 Validating skill structure...');

  const requiredFiles = [
    'SKILL.md',
    'scripts/diagnose-calendar-leak.js',
    'scripts/analyze-task-state.js',
    'scripts/test-calendar-behavior.js',
    'references/vue-calendar-best-practices.md',
    'references/task-calendar-separation.md'
  ];

  const missingFiles = [];
  const foundFiles = [];

  requiredFiles.forEach(file => {
    const filePath = path.join(SKILL_DIR, file);
    if (fs.existsSync(filePath)) {
      foundFiles.push(file);
      console.log(`  ✅ ${file}`);
    } else {
      missingFiles.push(file);
      console.log(`  ❌ ${file} (missing)`);
    }
  });

  if (missingFiles.length > 0) {
    console.log(`\n❌ Validation failed: Missing ${missingFiles.length} required files`);
    return false;
  }

  console.log(`\n✅ All ${foundFiles.length} required files found`);
  return true;
}

function validateSkillMetadata() {
  console.log('\n📋 Validating skill metadata...');

  const skillMdPath = path.join(SKILL_DIR, 'SKILL.md');
  const content = fs.readFileSync(skillMdPath, 'utf8');

  // Check for required frontmatter fields
  const requiredFields = ['name', 'description'];
  const frontmatterMatch = content.match(/^---\n(.*?)\n---/s);

  if (!frontmatterMatch) {
    console.log('  ❌ No YAML frontmatter found');
    return false;
  }

  const frontmatter = frontmatterMatch[1];
  let allValid = true;

  requiredFields.forEach(field => {
    if (frontmatter.includes(`${field}:`)) {
      console.log(`  ✅ ${field} field present`);
    } else {
      console.log(`  ❌ ${field} field missing`);
      allValid = false;
    }
  });

  // Check frontmatter quality
  if (frontmatter.includes('calendar-scheduling-fixer')) {
    console.log('  ✅ Skill name in description');
  } else {
    console.log('  ⚠️  Consider including skill name in description');
  }

  if (frontmatter.includes('Playwright')) {
    console.log('  ✅ Testing requirements mentioned');
  } else {
    console.log('  ⚠️  Consider mentioning testing requirements');
  }

  return allValid;
}

function validateScriptPermissions() {
  console.log('\n🔐 Validating script permissions...');

  const scriptsDir = path.join(SKILL_DIR, 'scripts');
  const scripts = fs.readdirSync(scriptsDir).filter(file => file.endsWith('.js'));

  let allExecutable = true;

  scripts.forEach(script => {
    const scriptPath = path.join(scriptsDir, script);
    try {
      fs.accessSync(scriptPath, fs.constants.F_OK);
      console.log(`  ✅ ${script} is accessible`);
    } catch (error) {
      console.log(`  ❌ ${script} is not accessible`);
      allExecutable = false;
    }
  });

  return allExecutable;
}

function createPackage() {
  console.log('\n📦 Creating skill package...');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('  ✅ Created output directory');
  }

  const outputPath = path.join(OUTPUT_DIR, `${SKILL_NAME}.zip`);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const fileSize = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`  ✅ Package created: ${outputPath}`);
      console.log(`  📊 Package size: ${fileSize} MB`);
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files in skill directory
    archive.directory(SKILL_DIR, SKILL_NAME);

    archive.finalize();
  });
}

async function main() {
  try {
    // Run validations
    const structureValid = validateSkillStructure();
    const metadataValid = validateSkillMetadata();
    const permissionsValid = validateScriptPermissions();

    if (!structureValid || !metadataValid || !permissionsValid) {
      console.log('\n❌ Skill validation failed');
      console.log('Please fix the issues above and try again');
      process.exit(1);
    }

    console.log('\n✅ All validations passed');

    // Create package
    const packagePath = await createPackage();

    console.log('\n🎉 Skill packaged successfully!');
    console.log(`📍 Location: ${packagePath}`);
    console.log('\n📋 Usage Instructions:');
    console.log('1. Distribute the zip file to users');
    console.log('2. Users extract to their .claude/skills/ directory');
    console.log('3. Skill becomes available to Claude automatically');

  } catch (error) {
    console.error('\n❌ Packaging failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, validateSkillStructure, validateSkillMetadata, createPackage };