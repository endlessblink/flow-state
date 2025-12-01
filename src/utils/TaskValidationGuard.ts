/**
 * TASK VALIDATION GUARD
 * Multi-layer protection system to prevent invalid task data assignment
 *
 * This prevents:
 * - Invalid project IDs (reserved keywords)
 * - Data corruption during task creation
 * - Undefined/null data issues
 *
 * Note: projectId: '1' is treated as legacy uncategorized (backward compatible)
 */

import type { Task } from '@/types/tasks'

export class TaskValidationGuard {
  // Reserved keywords that shouldn't be used as project IDs (legacy '1' is allowed for backward compat)
  private static readonly FORBIDDEN_PROJECT_IDS = new Set(['default', 'my-tasks', 'My Tasks']);
  private static readonly VALIDATION_KEY = 'task-validation-failures';

  /**
   * Main validation function - called before any task creation/modification
   */
  static validateAndCleanTaskData(taskData: Partial<Task>): Partial<Task> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create a clean copy to avoid mutation
    const cleanedData = { ...taskData };

    // PRIMARY VALIDATION: Prevent forbidden project IDs
    if (cleanedData.projectId && this.FORBIDDEN_PROJECT_IDS.has(cleanedData.projectId)) {
      const error = `Forbidden projectId detected and blocked: "${cleanedData.projectId}"`;
      console.error('🚨 SECURITY:', error);
      errors.push(error);

      // Force to null and mark as uncategorized
      cleanedData.projectId = undefined;
      cleanedData.isUncategorized = true;
    }

    // SECONDARY VALIDATION: Handle undefined vs null
    if (cleanedData.projectId === undefined) {
      const warning = 'Converting undefined projectId to null';
      console.warn('⚠️ Validation:', warning);
      warnings.push(warning);

      cleanedData.projectId = undefined;
      cleanedData.isUncategorized = true;
    }

    // TERTIARY VALIDATION: Type safety
    if (cleanedData.projectId !== null && typeof cleanedData.projectId !== 'string') {
      const error = `Invalid projectId type: ${typeof cleanedData.projectId}`;
      console.error('❌ Type Validation:', error);
      errors.push(error);

      cleanedData.projectId = undefined;
      cleanedData.isUncategorized = true;
    }

    // QUATERNARY VALIDATION: Empty string project IDs
    if (cleanedData.projectId === '') {
      const warning = 'Empty string projectId converted to null';
      warnings.push(warning);

      cleanedData.projectId = undefined;
      cleanedData.isUncategorized = true;
    }

    // QUINARY VALIDATION: Ensure isUncategorized flag consistency
    if (cleanedData.projectId === null && cleanedData.isUncategorized !== true) {
      cleanedData.isUncategorized = true;
    } else if (cleanedData.projectId && cleanedData.isUncategorized === true) {
      // If has a projectId, shouldn't be marked as uncategorized
      cleanedData.isUncategorized = false;
    }

    // SEXTARY VALIDATION: Title validation
    if (!cleanedData.title || cleanedData.title.trim() === '') {
      warnings.push('Task title is empty or missing');
      cleanedData.title = cleanedData.title || '';
    }

    // FINAL CHECK: Double-check we didn't miss anything
    if (cleanedData.projectId && this.FORBIDDEN_PROJECT_IDS.has(cleanedData.projectId)) {
      throw new Error(`EMERGENCY: Forbidden projectId ${cleanedData.projectId} passed through validation`);
    }

    // Report any issues
    if (errors.length > 0 || warnings.length > 0) {
      this.reportValidationIssue({
        errors,
        warnings,
        originalData: taskData,
        cleanedData,
        timestamp: new Date().toISOString()
      });
    }

    return cleanedData;
  }

  /**
   * Validate project ID format and content
   */
  static validateProjectId(projectId: string | null | undefined): boolean {
    // Null or undefined is valid (represents uncategorized)
    if (projectId === null || projectId === undefined) {
      return true;
    }

    // Must be a string
    if (typeof projectId !== 'string') {
      return false;
    }

    // Empty string is invalid
    if (projectId === '') {
      return false;
    }

    // Check for forbidden project IDs
    if (this.FORBIDDEN_PROJECT_IDS.has(projectId)) {
      return false;
    }

    // Basic UUID format validation (simple check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return false;
    }

    return true;
  }

  /**
   * Generate a secure project ID that won't conflict with forbidden IDs
   */
  static generateSecureProjectId(): string {
    // Generate a proper UUID v4
    const generateUUID = (): string => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    let projectId: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      projectId = generateUUID();
      attempts++;

      // Double-check we didn't generate a forbidden ID (extremely unlikely but safety first)
      if (this.FORBIDDEN_PROJECT_IDS.has(projectId)) {
        console.error('🚨 CRITICAL: Generated forbidden project ID:', projectId);
        continue;
      }

      break;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate secure project ID after multiple attempts');
    }

    return projectId;
  }

  /**
   * Validate existing task for consistency issues
   */
  static validateExistingTask(task: Task): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for forbidden project IDs
    if (task.projectId && this.FORBIDDEN_PROJECT_IDS.has(task.projectId)) {
      issues.push(`Task has forbidden projectId: ${task.projectId}`);
    }

    // Check project/uncategorized consistency
    if (task.projectId === null && task.isUncategorized !== true) {
      issues.push('Task with null projectId should be marked as uncategorized');
    }

    if (task.projectId && task.isUncategorized === true) {
      issues.push('Task with projectId should not be marked as uncategorized');
    }

    // Check for required fields
    if (!task.id || typeof task.id !== 'string') {
      issues.push('Task missing valid ID');
    }

    if (!task.title || typeof task.title !== 'string') {
      issues.push('Task missing valid title');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Create emergency validation report for debugging
   */
  static getValidationReport(): {
    totalFailures: number;
    recentFailures: any[];
    failureTypes: Record<string, number>;
    hasRecentCriticalIssues: boolean;
  } {
    try {
      const existing = localStorage.getItem(this.VALIDATION_KEY) || '[]';
      const failures = JSON.parse(existing);

      const failureTypes = failures.reduce((acc: Record<string, number>, f: any) => {
        f.errors?.forEach((error: string) => {
          acc[error] = (acc[error] || 0) + 1;
        });
        return acc;
      }, {});

      // Check for recent critical issues (last 10 failures)
      const recentFailures = failures.slice(-10);
      const hasRecentCriticalIssues = recentFailures.some((f: any) =>
        f.errors && f.errors.some((e: string) => e.includes('EMERGENCY'))
      );

      return {
        totalFailures: failures.length,
        recentFailures,
        failureTypes,
        hasRecentCriticalIssues
      };
    } catch (error) {
      console.error('Failed to generate validation report:', error);
      return {
        totalFailures: 0,
        recentFailures: [],
        failureTypes: {},
        hasRecentCriticalIssues: false
      };
    }
  }

  /**
   * Clear validation history (for maintenance)
   */
  static clearValidationHistory(): void {
    localStorage.removeItem(this.VALIDATION_KEY);
    console.log('🧹 Validation history cleared');
  }

  /**
   * Private: Report validation failures for monitoring
   */
  private static reportValidationIssue(report: {
    errors: string[];
    warnings: string[];
    originalData: any;
    cleanedData: any;
    timestamp: string;
  }): void {
    try {
      const failureReport = {
        timestamp: report.timestamp,
        errors: report.errors,
        warnings: report.warnings,
        originalProjectId: report.originalData.projectId,
        cleanedProjectId: report.cleanedData.projectId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        severity: report.errors.length > 0 ? 'ERROR' : 'WARNING'
      };

      // Store in localStorage for debugging
      const existing = localStorage.getItem(this.VALIDATION_KEY) || '[]';
      const failures = JSON.parse(existing);
      failures.push(failureReport);

      // Keep only last 100 failures to prevent localStorage overflow
      if (failures.length > 100) {
        failures.splice(0, failures.length - 100);
      }

      localStorage.setItem(this.VALIDATION_KEY, JSON.stringify(failures));

      // Log to console for immediate visibility
      if (report.errors.length > 0) {
        console.error('🛡️ TASK VALIDATION ERRORS:', failureReport);
      }
      if (report.warnings.length > 0) {
        console.warn('⚠️ TASK VALIDATION WARNINGS:', failureReport);
      }
    } catch (error) {
      console.error('Failed to report validation issue:', error);
    }
  }
}