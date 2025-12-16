/**
 * Git Restoration Analyzer Skill
 *
 * Comprehensive git restoration tool that analyzes ALL commits between start and end points,
 * asks intelligent questions about ambiguous changes, and restores features based on user preferences
 * without making assumptions about what should be restored.
 */

interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
  shortHash: string
}

interface FileChange {
  path: string
  status: 'A' | 'M' | 'D' | 'R' | 'C'  // Added, Modified, Deleted, Renamed, Copied
  linesAdded?: number
  linesDeleted?: number
  isBinary?: boolean
}

interface CommitAnalysis {
  commit: GitCommit
  changes: FileChange[]
  totalLinesAdded: number
  totalLinesDeleted: number
  fileCount: number
  description: string
  complexity: 'simple' | 'moderate' | 'complex'
  category: 'feature' | 'fix' | 'refactor' | 'cleanup' | 'breaking'
}

interface UserDecision {
  action: 'restore' | 'skip' | 'remove' | 'partial'
  files?: string[]
  reason?: string
}

interface RestorationPlan {
  commits: {
    commit: GitCommit
    analysis: CommitAnalysis
    decision: UserDecision
  }[]
  summary: {
    totalCommits: number
    toRestore: number
    toSkip: number
    toRemove: number
    toPartial: number
  }
}

class GitRestorationAnalyzer {
  private workingDir: string
  private isDevelopment = import.meta.env.DEV

  constructor() {
    this.workingDir = process.cwd()
  }

  /**
   * Analyze commits between two points
   */
  async analyzeCommitRange(startCommit: string, endCommit: string): Promise<CommitAnalysis[]> {
    console.log(`🔍 Analyzing commits from ${startCommit} to ${endCommit}`)

    // Get all commits in range
    const commits = await this.getCommitsInRange(startCommit, endCommit)

    // Analyze each commit
    const analyses: CommitAnalysis[] = []
    for (const commit of commits) {
      const analysis = await this.analyzeCommit(commit)
      analyses.push(analysis)

      if (this.isDevelopment) {
        console.log(`  ${(analysis as any).shortHash}: ${(analysis as any).description} (${(analysis as any).fileCount} files, ${(analysis as any).totalLinesAdded}+/${(analysis as any).totalLinesDeleted}-)`)
      }
    }

    return analyses
  }

  /**
   * Get all commits in a range
   */
  private async getCommitsInRange(startCommit: string, endCommit: string): Promise<GitCommit[]> {
    const { stdout } = await this.executeCommand(
      `git log ${startCommit}..${endCommit} --pretty=format:'%H|%s|%an|%ad' --reverse`
    )

    const commits: GitCommit[] = []
    for (const line of stdout.trim().split('\n')) {
      if (line.trim()) {
        const [hash, message, author, date] = line.split('|')
        commits.push({
          hash,
          message: message.trim(),
          author: author.trim(),
          date: date.trim(),
          shortHash: hash.substring(0, 8)
        })
      }
    }

    return commits
  }

  /**
   * Analyze a single commit
   */
  private async analyzeCommit(commit: GitCommit): Promise<CommitAnalysis> {
    // Get files changed in this commit
    const { stdout } = await this.executeCommand(
      `git show ${commit.hash} --name-status --format=''`
    )

    // Parse file changes
    const changes: FileChange[] = []
    for (const line of stdout.trim().split('\n')) {
      if (line.trim()) {
        const change = this.parseFileChange(line)
        if (change) changes.push(change)
      }
    }

    // Get line counts
    const { stdout: diffOutput } = await this.executeCommand(
      `git diff ${commit.hash}^ ${commit.hash} --stat`
    )

    let totalLinesAdded = 0
    let totalLinesDeleted = 0

    for (const line of diffOutput.trim().split('\n')) {
      const match = line.match(/\s+(\d+)\s+insertion(?:s)?,\s+(\d+)\s+deletion(?:s)?/)
      if (match) {
        totalLinesAdded += parseInt(match[1])
        totalLinesDeleted += parseInt(match[2])
      }
    }

    // Categorize commit
    const description = this.generateCommitDescription(commit, changes, totalLinesAdded, totalLinesDeleted)
    const complexity = this.determineComplexity(changes, totalLinesAdded + totalLinesDeleted)
    const category = this.categorizeCommit(commit.message, changes)

    return {
      commit,
      changes,
      totalLinesAdded,
      totalLinesDeleted,
      fileCount: changes.length,
      description,
      complexity,
      category
    }
  }

  /**
   * Parse file change from git show output
   */
  private parseFileChange(line: string): FileChange | null {
    const status = line[0] as FileChange['status']
    const path = line.substring(1).trim()

    return {
      path,
      status,
      isBinary: path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico') || path.endsWith('.svg')
    }
  }

  /**
   * Generate human-readable commit description
   */
  private generateCommitDescription(commit: GitCommit, changes: FileChange[], linesAdded: number, linesDeleted: number): string {
    const verb = this.getCommitVerb(changes, linesAdded, linesDeleted)
    const fileSummary = this.getFileSummary(changes)

    return `${verb} ${fileSummary}`
  }

  /**
   * Determine the main action verb for a commit
   */
  private getCommitVerb(changes: FileChange[], linesAdded: number, linesDeleted: number): string {
    if (linesDeleted > 0 && linesAdded === 0) return 'Remove'
    if (linesAdded > 0 && linesDeleted === 0) return 'Add'
    if (changes.some(c => c.status === 'A')) return 'Add'
    if (changes.some(c => c.status === 'D')) return 'Remove'
    return 'Modify'
  }

  /**
   * Get summary of files changed
   */
  private getFileSummary(changes: FileChange[]): string {
    const fileTypes = new Set<string>()

    for (const change of changes) {
      const ext = change.path.split('.').pop() || ''
      if (ext) fileTypes.add(ext)
    }

    const fileNames = changes.map(c => c.path.split('/').pop() || c.path).slice(0, 3)

    if (fileTypes.size === 1) {
      return `${Array.from(fileTypes)[0]} files (${changes.length})`
    }

    return `${changes.length} files`
  }

  /**
   * Determine commit complexity
   */
  private determineComplexity(changes: FileChange[], totalLines: number): 'simple' | 'moderate' | 'complex' {
    if (changes.length === 1 && totalLines < 50) return 'simple'
    if (changes.length <= 3 && totalLines < 200) return 'moderate'
    return 'complex'
  }

  /**
   * Categorize commit type
   */
  private categorizeCommit(message: string, changes: FileChange[]): 'feature' | 'fix' | 'refactor' | 'cleanup' | 'breaking' {
    const msg = message.toLowerCase()

    if (msg.includes('fix') || msg.includes('bug') || msg.includes('issue')) return 'fix'
    if (msg.includes('refactor') || msg.includes('restructure') || msg.includes('reorganize')) return 'refactor'
    if (msg.includes('cleanup') || msg.includes('remove') || msg.includes('delete')) return 'cleanup'
    if (msg.includes('break') || msg.includes('breaking')) return 'breaking'

    return 'feature'
  }

  /**
   * Generate questions for user clarification
   */
  generateQuestion(analysis: CommitAnalysis): string {
    const { commit, changes, description, complexity, category } = analysis

    if (complexity === 'simple') {
      return `Commit ${commit.shortHash} ${description}. This is a simple ${category}. Would you like to:`
    }

    if (complexity === 'moderate') {
      return `Commit ${commit.shortHash} ${description}. This ${category} affects ${analysis.fileCount} files with ${analysis.totalLinesAdded} lines added. The main files are: ${this.getMainFiles(changes)}. Should I:`
    }

    // Complex commits need detailed breakdown
    const fileDetails = this.getFileDetails(changes)
    return `Commit ${commit.shortHash} ${description}. This is a complex ${category} with multiple changes:\n\n${fileDetails}\n\nWhat would you like to do with this commit?`
  }

  /**
   * Get main files for moderate complexity commits
   */
  private getMainFiles(changes: FileChange[]): string {
    const mainFiles = changes.slice(0, 3).map(c => c.path.split('/').pop())
    if (changes.length > 3) {
      mainFiles.push(`and ${changes.length - 3} others`)
    }
    return mainFiles.join(', ')
  }

  /**
   * Get detailed file breakdown for complex commits
   */
  private getFileDetails(changes: FileChange[]): string {
    const details = []

    for (const change of changes) {
      const action = this.getActionText(change.status)
      const fileName = change.path.split('/').pop() || change.path
      details.push(`  • ${action} ${fileName}`)
    }

    return details.join('\n')
  }

  /**
   * Get human-readable action text
   */
  private getActionText(status: FileChange['status']): string {
    switch (status) {
      case 'A': return 'Added'
      case 'M': return 'Modified'
      case 'D': return 'Deleted'
      case 'R': return 'Renamed'
      case 'C': return 'Copied'
      default: return 'Changed'
    }
  }

  /**
   * Generate restoration options for user
   */
  generateOptions(analysis: CommitAnalysis): string[] {
    const { category, complexity, changes } = analysis

    const baseOptions = [
      '1. Restore this entire commit',
      '2. Skip this commit entirely',
      '3. Restore only specific files from this commit'
    ]

    if (category === 'fix') {
      baseOptions.push('4. Skip this fix (keep the bug)')
      baseOptions.push('5. Restore the fix')
    }

    if (complexity === 'complex') {
      baseOptions.push('6. See detailed diff before deciding')
    }

    return baseOptions
  }

  /**
   * Execute git command
   */
  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const { execSync } = await import('child_process')

    try {
      const result = execSync(command, {
        cwd: this.workingDir,
        encoding: 'utf8'
      })

      return {
        stdout: (result as any).stdout || '',
        stderr: (result as any).stderr || ''
      }
    } catch (error: any) {
      throw new Error(`Git command failed: ${command}\nError: ${error.message}`)
    }
  }

  /**
   * Show detailed diff for a commit
   */
  async showCommitDiff(commitHash: string): Promise<string> {
    const { stdout } = await this.executeCommand(`git show ${commitHash}`)
    return stdout
  }

  /**
   * Restore specific files from a commit
   */
  async restoreFiles(commitHash: string, files: string[]): Promise<void> {
    for (const file of files) {
      await this.executeCommand(`git checkout ${commitHash} -- "${file}"`)
      console.log(`✅ Restored ${file} from commit ${commitHash}`)
    }
  }

  /**
   * Cherry-pick a commit
   */
  async cherryPick(commitHash: string): Promise<void> {
    await this.executeCommand(`git cherry-pick ${commitHash}`)
    console.log(`✅ Cherry-picked commit ${commitHash}`)
  }

  /**
   * Create restoration plan based on user decisions
   */
  createRestorationPlan(analyses: CommitAnalysis[], decisions: UserDecision[]): RestorationPlan {
    const plan: RestorationPlan = {
      commits: [],
      summary: {
        totalCommits: analyses.length,
        toRestore: 0,
        toSkip: 0,
        toRemove: 0,
        toPartial: 0
      }
    }

    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i]
      const decision = decisions[i] || { action: 'skip' }

      plan.commits.push({
        commit: analysis.commit,
        analysis,
        decision
      })

      // Update summary
      switch (decision.action) {
        case 'restore':
          plan.summary.toRestore++
          break
        case 'skip':
          plan.summary.toSkip++
          break
        case 'remove':
          plan.summary.toRemove++
          break
        case 'partial':
          plan.summary.toPartial++
          break
      }
    }

    return plan
  }

  /**
   * Execute restoration plan
   */
  async executeRestorationPlan(plan: RestorationPlan): Promise<void> {
    console.log(`🚀 Executing restoration plan (${plan.summary.toRestore} commits to restore, ${plan.summary.toSkip} to skip)`)

    for (const { commit, analysis, decision } of plan.commits) {
      if (decision.action === 'restore') {
        if (decision.files && decision.files.length > 0) {
          await this.restoreFiles(commit.hash, decision.files)
        } else {
          await this.cherryPick(commit.hash)
        }
      } else if (decision.action === 'skip') {
        console.log(`⏭️ Skipping commit ${commit.shortHash}: ${analysis.description}`)
      } else if (decision.action === 'remove') {
        // This would be implemented as needed for removing fixes
        console.log(`🗑️ Would need to remove changes from commit ${commit.shortHash}: ${analysis.description}`)
      }
    }

    console.log('✅ Restoration plan executed successfully')
  }
}

// Create and export the skill
export const gitRestorationAnalyzer = new GitRestorationAnalyzer()

// Convenience exports
export const {
  analyzeCommitRange,
  // analyzeCommit, // Made private - remove from exports
  generateQuestion,
  generateOptions,
  showCommitDiff,
  restoreFiles,
  cherryPick,
  createRestorationPlan,
  executeRestorationPlan
} = gitRestorationAnalyzer

// Development-only enhancements
if (import.meta.env.DEV) {
  // Expose to window for debugging
  (window as any).gitRestorationAnalyzer = gitRestorationAnalyzer
}