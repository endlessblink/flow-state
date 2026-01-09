const fs = require('fs');
const path = require('path');

const REPORT_PATH = 'audit-reports/health-audit-2026-01-09.json';
const PROTECTED_FILES = [
    'src/composables/useBackupSystem.ts',
    'src/utils/offlineQueue.ts'
];

function deleteUnusedFiles() {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`Report not found at ${REPORT_PATH}`);
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
    const unusedFiles = report.findings.filter(f =>
        f.type === 'unused-file' &&
        f.riskCategory === 'SAFE'
    );

    console.log(`Found ${unusedFiles.length} SAFE unused files.`);

    let deletedCount = 0;
    let skippedCount = 0;

    for (const finding of unusedFiles) {
        const filePath = finding.path; // finding.path is relative to project root usually

        // Check if protected
        if (PROTECTED_FILES.some(protected => filePath.includes(protected))) {
            console.log(`⚠️  Skipping protected file: ${filePath}`);
            skippedCount++;
            continue;
        }

        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✅ Deleted: ${filePath}`);
                deletedCount++;
            } else {
                console.log(`⚠️  File not found (already deleted?): ${filePath}`);
                skippedCount++;
            }
        } catch (e) {
            console.error(`❌ Error deleting ${filePath}: ${e.message}`);
        }
    }

    console.log(`\nCleanup Complete:`);
    console.log(`Deleted: ${deletedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

deleteUnusedFiles();
