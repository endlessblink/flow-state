
import PouchDB from 'pouchdb-browser'
import { SyncValidator, ValidationIssueType } from '@/utils/syncValidator'
import type { ValidationIssue } from '@/utils/syncValidator'

export interface DoctorReport {
    healedCount: number
    issuesFound: number
    fixesApplied: string[]
    unfixableIssues: string[]
    duration: number
}

export class IntegrityDoctorService {
    private validator: SyncValidator

    constructor() {
        this.validator = new SyncValidator({
            strictMode: false,
            includeChecksums: true,
            validateTimestamps: true,
            validateIds: true
        })
    }

    /**
     * Diagnose and heal the database
     */
    public async checkAndHeal(db: PouchDB.Database): Promise<DoctorReport> {
        console.log(`🚑 [IntegrityDoctor] Starting rounds on ${db.name}...`)
        const startTime = Date.now()
        const report: DoctorReport = {
            healedCount: 0,
            issuesFound: 0,
            fixesApplied: [],
            unfixableIssues: [],
            duration: 0
        }

        try {
            // 1. Diagnose
            const diagnosis = await this.validator.validateDatabase(db)
            report.issuesFound = diagnosis.issues.length // Note: SyncValidator aggregates issues

            if (diagnosis.valid && diagnosis.issues.length === 0) {
                console.log('✅ [IntegrityDoctor] Patient is healthy.')
                report.duration = Date.now() - startTime
                return report
            }

            console.log(`⚠️ [IntegrityDoctor] Found ${diagnosis.issues.length} symptoms. Starting treatment...`)

            // 2. Treat (Iterate through issues? SyncValidator generic report might be hard to map back to specific docs if flattened)
            // Wait, SyncValidator.validateDatabase returns a simplified issue list in current implementation?
            // Let's re-read SyncValidator.validateDatabase implementation I saw earlier.
            // It returns SyncValidationResult. The 'issues' array there is "Simplified for database level".
            // Actually lines 104-106 of SyncValidator.ts:
            // const docErrors = result.issues.map(i => `${doc._id}: ${i.message}`)
            // It seems standard validateDatabase might accept a more detailed return or we should iterate ourselves.

            // BETTER APPROACH: Iterate docs ourselves effectively, or use validateDatabase if we improve it.
            // For now, I'll iterate allDocs myself to have full control over the "Doc -> Fix" loop.

            const allDocs = await db.allDocs({ include_docs: true })

            for (const row of allDocs.rows) {
                const doc = row.doc as any
                if (!doc) continue

                // Check specific document
                const validation = await this.validator.validateDocument(doc)

                if (!validation.isValid) {
                    const fixed = await this.attemptHeal(db, doc, validation.issues)
                    if (fixed) {
                        report.healedCount++
                        report.fixesApplied.push(`Healed ${doc._id}`)
                    } else {
                        report.unfixableIssues.push(`${doc._id}: Unable to auto-heal`)
                    }
                }
            }

        } catch (err) {
            console.error('❌ [IntegrityDoctor] Medical emergency:', err)
        }

        report.duration = Date.now() - startTime
        console.log(`👨‍⚕️ [IntegrityDoctor] Rounds complete. Healed: ${report.healedCount}/${report.issuesFound}`)
        return report
    }

    private async attemptHeal(db: PouchDB.Database, doc: any, issues: ValidationIssue[]): Promise<boolean> {
        let modified = false
        const originalRev = doc._rev

        for (const issue of issues) {
            // Apply specific cures based on issue type and field
            if (this.applyCure(doc, issue)) {
                modified = true
            }
        }

        if (modified) {
            try {
                // Determine doc type for logging
                console.log(`💊 [IntegrityDoctor] Applying fixes to ${doc._id}`)
                await db.put(doc)
                return true
            } catch (err) {
                console.warn(`❌ [IntegrityDoctor] Treatmean failed for ${doc._id}:`, err)
                return false
            }
        }

        return false
    }

    private applyCure(doc: any, issue: ValidationIssue): boolean {
        // CURE 1: Missing Timestamps
        if (issue.type === ValidationIssueType.MISSING_FIELD && (issue.field === 'updatedAt' || issue.field === 'timestamp')) {
            doc.updatedAt = new Date().toISOString()
            if (!doc.createdAt) doc.createdAt = doc.updatedAt
            return true
        }

        // CURE 2: Invalid Task Status
        if (issue.type === ValidationIssueType.INVALID_TYPE && issue.field === 'status' && doc._id.startsWith('tasks:')) {
            doc.status = 'backlog' // Default safe status
            return true
        }

        // CURE 3: Invalid Priority
        if (issue.type === ValidationIssueType.INVALID_TYPE && issue.field === 'priority' && doc._id.startsWith('tasks:')) {
            doc.priority = 'medium' // Default
            return true
        }

        // CURE 4: NaN Positions in Canvas (Task-specific, usually stored in 'position' or similar if using vue-flow data structure?)
        // Note: Canvas nodes are inside 'canvas:' documents usually? Or tasks have position meta?
        // Checking doc type. If it's a task, position might be in metadata or separate.
        // If it's a canvas doc with nodes.
        if (issue.field === 'nodes' && Array.isArray(doc.nodes)) {
            // Deep scan nodes for NaN
            let fixedNodes = false
            doc.nodes.forEach((node: any) => {
                if (node.position) {
                    if (isNaN(node.position.x)) { node.position.x = 0; fixedNodes = true }
                    if (isNaN(node.position.y)) { node.position.y = 0; fixedNodes = true }
                }
            })
            if (fixedNodes) return true
        }

        // CURE 5: Missing Title
        if (issue.type === ValidationIssueType.MISSING_FIELD && issue.field === 'title') {
            doc.title = 'Untitled (Recovered)'
            return true
        }

        return false
    }
}

export const integrityDoctor = new IntegrityDoctorService()
