const fs = require('fs');
const path = require('path');

const REPORT_PATH = 'full-dead-code.json';
const ENTRY_POINTS = [
    'dev-maestro/server.js',
    'dev-maestro/scripts/health-scanner.js',
    'scripts/',
    '.claude/',
    'tauri/',
    'dist/',
    'coverage/',
    'src/main.ts',
    'src/App.vue',
    'index.html'
];

function deleteUnusedFiles() {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`Report not found at ${REPORT_PATH}`);
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
    const allUnused = report.files || [];

    const filteredFiles = allUnused.filter(f =>
        !ENTRY_POINTS.some(p => f.includes(p))
    );

    console.log(`Found ${allUnused.length} raw unused files.`);
    console.log(`Filtered down to ${filteredFiles.length} truly unused files.`);

    const confirmDeletion = process.argv.includes('--force');
    if (!confirmDeletion) {
        console.log('\nDRY RUN - Use --force to actually delete files.');
    }

    let deletedCount = 0;
    let errorCount = 0;

    for (const filePath of filteredFiles) {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Not found: ${filePath}`);
            continue;
        }

        if (confirmDeletion) {
            try {
                fs.unlinkSync(filePath);
                console.log(`✅ Deleted: ${filePath}`);
                deletedCount++;
            } catch (e) {
                console.error(`❌ Error: ${filePath} - ${e.message}`);
                errorCount++;
            }
        } else {
            console.log(`(dry) Would delete: ${filePath}`);
        }
    }

    console.log(`\nResults:`);
    console.log(`Planned: ${filteredFiles.length}`);
    console.log(`Deleted: ${deletedCount}`);
    console.log(`Errors:  ${errorCount}`);
}

deleteUnusedFiles();
