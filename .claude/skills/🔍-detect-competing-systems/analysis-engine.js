#!/usr/bin/env node

/**
 * Detect Competing Systems - Analysis Engine
 *
 * Core detection logic for identifying duplicate, conflicting, and competing systems
 * in Vue 3 + TypeScript + Pinia projects.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

class CompetingSystemsAnalyzer {
  constructor(options = {}) {
    this.options = {
      rootDir: options.rootDir || process.cwd(),
      similarityThreshold: options.similarityThreshold || 0.80, // Raised from 0.75
      maxFileSize: options.maxFileSize || 100000, // 100KB
      excludePatterns: options.excludePatterns || [
        /node_modules/,
        /\.git/,
        /dist/,
        /coverage/,
        /\.vue\.js$/,
        /\.d\.ts$/
      ],
      severityWeights: {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
      },
      severityThresholds: {
        'duplicate-stores': 0.90,      // Higher for state management
        'duplicate-composables': 0.85, // High for reusable logic
        'duplicate-components': 0.80,  // Medium for UI overlap
        'naming-conflicts': 0.95,      // Highest for exact matches
        'form-handling': 0.75,         // Lower for implementation differences
        'validation-rules': 0.88,      // High for business logic
        'api-endpoints': 0.92,         // Very high for API consistency
        'utility-functions': 0.83,     // Medium-high for helpers
        'constants': 0.96,             // Highest for literal values
        'database-patterns': 0.85,     // High for data access patterns
        'test-duplication': 0.82,      // Medium-high for test overlap
        'async-patterns': 0.78,        // Lower for async style differences
        'type-definitions': 0.94       // Very high for type conflicts
      },
      defaultThreshold: 0.80,
      ...options
    };

    this.conflicts = [];
    this.patterns = this.loadPatterns();
    this.exemptions = this.loadExemptions();
  }

  /**
   * Main analysis entry point
   */
  async analyzeProject(targetDir = null) {
    const projectDir = targetDir || this.options.rootDir;
    console.log(`🔍 Analyzing project: ${projectDir}`);

    const files = await this.scanFiles(projectDir);
    console.log(`📁 Found ${files.length} source files`);

    const fileGroups = this.groupFilesByType(files);

    // Debug file groups
    console.log('File groups:', Object.keys(fileGroups));

    // Analyze each conflict category
    try { await this.analyzeStateManagement(fileGroups.stores || []); } catch (e) { console.error('Error in analyzeStateManagement:', e.message); }
    try { await this.analyzeComposables(fileGroups.composables || []); } catch (e) { console.error('Error in analyzeComposables:', e.message); }
    try { await this.analyzeComponents(fileGroups.components || []); } catch (e) { console.error('Error in analyzeComponents:', e.message); }
    try { await this.analyzeUtilities(fileGroups.utilities || []); } catch (e) { console.error('Error in analyzeUtilities:', e.message); }
    try { await this.analyzeFilters(fileGroups.filters || []); } catch (e) { console.error('Error in analyzeFilters:', e.message); }
    try { await this.analyzeCalendars(fileGroups.calendars || []); } catch (e) { console.error('Error in analyzeCalendars:', e.message); }
    try { await this.analyzeDragDrop(fileGroups.dragDrop || []); } catch (e) { console.error('Error in analyzeDragDrop:', e.message); }
    try { await this.analyzeDatabase(fileGroups.database || []); } catch (e) { console.error('Error in analyzeDatabase:', e.message); }
    try { await this.analyzeTests(fileGroups.tests || []); } catch (e) { console.error('Error in analyzeTests:', e.message); }
    try { await this.analyzeFramework(fileGroups.framework || []); } catch (e) { console.error('Error in analyzeFramework:', e.message); }
    try { await this.analyzeLegacy(fileGroups.legacy || []); } catch (e) { console.error('Error in analyzeLegacy:', e.message); }
    try { await this.analyzeReactivePatterns(fileGroups.reactive || []); } catch (e) { console.error('Error in analyzeReactivePatterns:', e.message); }
    try { await this.analyzeSideEffects(fileGroups.lifecycle || []); } catch (e) { console.error('Error in analyzeSideEffects:', e.message); }
    try { await this.analyzeErrorHandling(fileGroups.errors || []); } catch (e) { console.error('Error in analyzeErrorHandling:', e.message); }
    try { await this.analyzeStatePassing(fileGroups.stateAccess || []); } catch (e) { console.error('Error in analyzeStatePassing:', e.message); }
    try { await this.analyzeFormHandling(fileGroups.forms || []); } catch (e) { console.error('Error in analyzeFormHandling:', e.message); }
    try { await this.analyzeValidation(fileGroups.validation || []); } catch (e) { console.error('Error in analyzeValidation:', e.message); }
    try { await this.analyzeTypeDefinitions(fileGroups.types || []); } catch (e) { console.error('Error in analyzeTypeDefinitions:', e.message); }
    try { await this.analyzeAuthentication(fileGroups.auth || []); } catch (e) { console.error('Error in analyzeAuthentication:', e.message); }
    try { await this.analyzeFormatting(fileGroups.formatters || []); } catch (e) { console.error('Error in analyzeFormatting:', e.message); }
    try { await this.analyzeAsyncPatterns(fileGroups.async || []); } catch (e) { console.error('Error in analyzeAsyncPatterns:', e.message); }
    try { await this.analyzeConstants(fileGroups.constants || []); } catch (e) { console.error('Error in analyzeConstants:', e.message); }
    try { await this.analyzeNotifications(fileGroups.notifications || []); } catch (e) { console.error('Error in analyzeNotifications:', e.message); }
    try { await this.analyzeCaching(fileGroups.caching || []); } catch (e) { console.error('Error in analyzeCaching:', e.message); }
    try { await this.analyzeContentPatterns(fileGroups.content || []); } catch (e) { console.error('Error in analyzeContentPatterns:', e.message); }
    try { await this.analyzeNaming(fileGroups.naming || []); } catch (e) { console.error('Error in analyzeNaming:', e.message); }

    return this.generateReport();
  }

  /**
   * Scan and collect source files
   */
  async scanFiles(dir) {
    const files = [];

    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!this.options.excludePatterns.some(pattern => pattern.test(fullPath))) {
            scan(fullPath);
          }
        } else if (stat.isFile()) {
          const relativePath = path.relative(this.options.rootDir, fullPath);

          if (this.isSourceFile(fullPath) && !this.options.excludePatterns.some(pattern => pattern.test(relativePath))) {
            const content = this.readFileSafely(fullPath);
            if (content) {
              files.push({
                path: fullPath,
                relativePath,
                content,
                size: stat.size,
                hash: this.hashContent(content)
              });
            }
          }
        }
      }
    };

    scan(dir);
    return files;
  }

  /**
   * Group files by their likely category
   */
  groupFilesByType(files) {
    const groups = {
      stores: [],
      composables: [],
      components: [],
      utilities: [],
      filters: [],
      calendars: [],
      dragDrop: [],
      database: [],
      tests: [],
      framework: [],
      legacy: [],
      reactive: [],
      lifecycle: [],
      errors: [],
      stateAccess: [],
      forms: [],
      validation: [],
      types: [],
      auth: [],
      formatters: [],
      async: [],
      constants: [],
      notifications: [],
      caching: [],
      content: [],
      naming: []
    };

    files.forEach(file => {
      const { path, content } = file;

      // Store files
      if (path.includes('/stores/') || (content.includes('defineStore') && content.includes('Pinia'))) {
        groups.stores.push(file);
      }

      // Composables
      if (path.includes('/composables/') || path.includes('/hooks/') || (content.includes('function use') && content.includes('ref('))) {
        groups.composables.push(file);
      }

      // Components
      if (path.endsWith('.vue') || (path.includes('/components/') && path.endsWith('.ts'))) {
        groups.components.push(file);
      }

      // Utilities
      if (path.includes('/utils/') || path.includes('/helpers/') || path.includes('/lib/')) {
        groups.utilities.push(file);
      }

      // Filter logic
      if (content.includes('.filter(') || content.includes('useFilter') || content.includes('useSearch')) {
        groups.filters.push(file);
      }

      // Calendar logic
      if (content.includes('calendar') || content.includes('date') || content.includes('schedule')) {
        groups.calendars.push(file);
      }

      // Drag and Drop
      if (content.includes('drag') || content.includes('drop') || content.includes('vuedraggable')) {
        groups.dragDrop.push(file);
      }

      // Database/API
      if (content.includes('fetch') || content.includes('axios') || content.includes('apiClient') || content.includes('@tanstack')) {
        groups.database.push(file);
      }

      // Tests
      if (path.includes('.test.') || path.includes('.spec.') || path.includes('/tests/')) {
        groups.tests.push(file);
      }

      // Framework files
      if (path.includes('/router/') || path.includes('/plugins/') || path.includes('/middleware/')) {
        groups.framework.push(file);
      }

      // Legacy
      if (path.includes('/legacy/') || path.includes('/old/')) {
        groups.legacy.push(file);
      }

      // Add to multiple relevant groups for cross-category analysis
      if (content.includes('reactive(') || content.includes('ref(') || content.includes('shallowReactive(')) {
        groups.reactive.push(file);
      }

      if (content.includes('onMounted') || content.includes('onCreated') || content.includes('beforeMount')) {
        groups.lifecycle.push(file);
      }

      if (content.includes('try') && content.includes('catch') || content.includes('error')) {
        groups.errors.push(file);
      }

      if (content.includes('provide') || content.includes('inject') || content.includes('props')) {
        groups.stateAccess.push(file);
      }

      if (content.includes('form') || content.includes('v-model') || content.includes('vee-validate')) {
        groups.forms.push(file);
      }

      if (content.includes('validate') || content.includes('validation')) {
        groups.validation.push(file);
      }

      if (content.includes('interface') || content.includes('type ')) {
        groups.types.push(file);
      }

      if (content.includes('auth') || content.includes('permission') || content.includes('role')) {
        groups.auth.push(file);
      }

      if (content.includes('format') || content.includes('Intl.DateTimeFormat') || content.includes('toLocaleString')) {
        groups.formatters.push(file);
      }

      if (content.includes('await') || content.includes('async') || content.includes('Promise')) {
        groups.async.push(file);
      }

      if (content.includes('const ') && content.includes('=')) {
        groups.constants.push(file);
      }

      if (content.includes('toast') || content.includes('notification') || content.includes('alert')) {
        groups.notifications.push(file);
      }

      if (content.includes('cache') || content.includes('localStorage') || content.includes('sessionStorage')) {
        groups.caching.push(file);
      }

      if (content.includes('slot') || content.includes('template')) {
        groups.content.push(file);
      }

      // All files for naming analysis
      groups.naming.push(file);
    });

    return groups;
  }

  /**
   * Analyze Pinia store conflicts
   */
  async analyzeStateManagement(storeFiles) {
    const stores = storeFiles.map(file => this.parseStore(file));

    // Check for duplicate stores managing same domain
    for (let i = 0; i < stores.length; i++) {
      for (let j = i + 1; j < stores.length; j++) {
        const similarity = this.calculateStoreSimilarity(stores[i], stores[j]);

        if (similarity > this.options.similarityThreshold) {
          this.addConflict({
            conflictId: `duplicate-stores-${i}-${j}`,
            type: 'State Management',
            subtype: 'Duplicate Pinia Stores',
            severity: 'HIGH',
            files: [stores[i].file, stores[j].file],
            description: `Two stores managing similar data domains with ${Math.round(similarity * 100)}% similarity`,
            patternMatch: similarity,
            recommendation: 'Consolidate into single store with computed properties for different views',
            consolidationPath: [
              'Keep the more established store as primary',
              'Move unique logic from duplicate store to computed properties',
              'Update all imports to use consolidated store',
              'Delete duplicate store after verification'
            ],
            estimatedEffort: '2-4 hours',
            risk: 'Medium'
          });
        }
      }
    }
  }

  /**
   * Parse store file for analysis
   */
  parseStore(file) {
    const content = file.content;
    const store = {
      file,
      name: this.extractStoreName(content),
      state: this.extractStoreState(content),
      getters: this.extractStoreGetters(content),
      actions: this.extractStoreActions(content),
      imports: this.extractImports(content)
    };

    return store;
  }

  /**
   * Analyze composable conflicts
   */
  async analyzeComposables(composableFiles) {
    const composables = composableFiles.map(file => this.parseComposable(file));

    // Group by similar functionality
    const groups = this.groupByFunctionality(composables);

    groups.forEach(group => {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const similarity = this.calculateComposableSimilarity(group[i], group[j]);

            if (similarity > this.options.similarityThreshold) {
              this.addConflict({
                conflictId: `duplicate-composables-${group[i].name}-${group[j].name}`,
                type: 'Composables & Hooks',
                subtype: 'Duplicate Composable Logic',
                severity: 'MEDIUM',
                files: [group[i].file, group[j].file],
                description: `Two composables with similar functionality: ${Math.round(similarity * 100)}% similarity`,
                patternMatch: similarity,
                recommendation: 'Merge into single composable with configuration options',
                consolidationPath: [
                  'Identify unique functionality in each composable',
                  'Create unified composable with option parameters',
                  'Update all imports to use consolidated composable',
                  'Remove duplicate composables'
                ],
                estimatedEffort: '1-2 hours',
                risk: 'Low'
              });
            }
          }
        }
      }
    });
  }

  /**
   * Analyze component conflicts
   */
  async analyzeComponents(componentFiles) {
    const components = componentFiles.map(file => this.parseComponent(file));

    // Find components with similar names or functionality
    const nameGroups = this.groupBySimilarNames(components);
    const functionGroups = this.groupByComponentFunctionality(components);

    // Analyze name conflicts
    nameGroups.forEach(group => {
      if (group.length > 1) {
        this.addConflict({
          conflictId: `component-name-conflict-${group[0].baseName}`,
          type: 'Components',
          subtype: 'Similar Component Names',
          severity: 'LOW',
          files: group.map(c => c.file),
          description: `Multiple components with similar names: ${group.map(c => c.name).join(', ')}`,
          patternMatch: 0.8,
          recommendation: 'Rename components to be more specific or consolidate if functionality overlaps',
          consolidationPath: [
            'Review component functionality',
            'If duplicates exist, consolidate into single component',
            'If distinct, rename for clarity',
            'Update all imports and references'
          ],
          estimatedEffort: '30 minutes',
          risk: 'Low'
        });
      }
    });

    // Analyze functional duplicates
    functionGroups.forEach(group => {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const similarity = this.calculateComponentSimilarity(group[i], group[j]);

            if (similarity > this.options.similarityThreshold) {
              this.addConflict({
                conflictId: `duplicate-components-${group[i].name}-${group[j].name}`,
                type: 'Components',
                subtype: 'Duplicate Component Functionality',
                severity: 'HIGH',
                files: [group[i].file, group[j].file],
                description: `Components with similar functionality: ${Math.round(similarity * 100)}% similarity`,
                patternMatch: similarity,
                recommendation: 'Consolidate into single configurable component',
                consolidationPath: [
                  'Identify unique props and slots in each component',
                  'Create unified component with comprehensive prop interface',
                  'Migrate unique functionality through props/slots',
                  'Update all usage locations',
                  'Remove duplicate components'
                ],
                estimatedEffort: '3-5 hours',
                risk: 'Medium'
              });
            }
          }
        }
      }
    });
  }

  /**
   * Analyze utility function conflicts
   */
  async analyzeUtilities(utilityFiles) {
    const utilities = utilityFiles.map(file => this.parseUtilities(file));
    const functions = utilities.flatMap(u => u.functions);

    // Group by function signature
    const functionGroups = this.groupByFunctionSignature(functions);

    functionGroups.forEach(group => {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const similarity = this.calculateFunctionSimilarity(group[i], group[j]);

            if (similarity > this.options.similarityThreshold) {
              this.addConflict({
                conflictId: `duplicate-utility-${group[i].name}`,
                type: 'Utility Functions',
                subtype: 'Duplicate Utility Function',
                severity: 'MEDIUM',
                files: [group[i].file, group[j].file],
                description: `Duplicate utility function: ${group[i].name} (${Math.round(similarity * 100)}% similar)`,
                patternMatch: similarity,
                recommendation: 'Consolidate into single utility function with proper parameter handling',
                consolidationPath: [
                  'Compare implementations for differences',
                  'Create unified function handling all use cases',
                  'Update all imports to use consolidated function',
                  'Remove duplicate implementations'
                ],
                estimatedEffort: '1 hour',
                risk: 'Low'
              });
            }
          }
        }
      }
    });
  }

  /**
   * Analyze filtering system conflicts
   */
  async analyzeFilters(filterFiles) {
    const filters = filterFiles.map(file => this.parseFilters(file));

    // Look for multiple filter implementations
    const filterImplementations = filters.filter(f => f.hasFilterLogic);

    if (filterImplementations.length > 1) {
      this.addConflict({
        conflictId: 'multiple-filter-implementations',
        type: 'Filtering & Search Systems',
        subtype: 'Multiple Filter Implementations',
        severity: 'HIGH',
        files: filterImplementations.map(f => f.file),
        description: `Filter logic implemented in ${filterImplementations.length} different places`,
        patternMatch: 0.85,
        recommendation: 'Consolidate filtering logic into single composable or store',
        consolidationPath: [
          'Identify all filtering patterns across implementations',
          'Create unified filtering composable with flexible criteria',
          'Move all filtering logic to centralized location',
          'Update all components to use unified system'
        ],
        estimatedEffort: '4-6 hours',
        risk: 'Medium'
      });
    }
  }

  // Similar analysis methods for other categories...
  async analyzeCalendars(calendarFiles) {
    // Implementation for calendar conflict detection
    const calendars = calendarFiles.map(file => this.parseCalendar(file));

    if (calendars.length > 1) {
      this.addConflict({
        conflictId: 'multiple-calendar-implementations',
        type: 'Calendar/Scheduling Logic',
        subtype: 'Multiple Calendar Systems',
        severity: 'HIGH',
        files: calendarFiles,
        description: 'Multiple calendar implementations detected',
        patternMatch: 0.8,
        recommendation: 'Consolidate into single calendar system',
        consolidationPath: ['Analyze calendar requirements', 'Create unified calendar composable', 'Migrate all calendar usage'],
        estimatedEffort: '6-8 hours',
        risk: 'High'
      });
    }
  }

  async analyzeDragDrop(dragDropFiles) {
    const dragSystems = dragDropFiles.map(file => this.parseDragDrop(file));

    // Check for different D&D libraries
    const libraries = [...new Set(dragSystems.map(d => d.library))];
    if (libraries.length > 1) {
      this.addConflict({
        conflictId: 'competing-dnd-libraries',
        type: 'Drag-and-Drop Systems',
        subtype: 'Multiple D&D Libraries',
        severity: 'HIGH',
        files: dragDropFiles,
        description: `Multiple D&D implementations: ${libraries.join(', ')}`,
        patternMatch: 0.9,
        recommendation: 'Standardize on single D&D library',
        consolidationPath: ['Evaluate D&D libraries', 'Choose standard implementation', 'Migrate all D&D functionality'],
        estimatedEffort: '8-12 hours',
        risk: 'High'
      });
    }
  }

  async analyzeDatabase(dbFiles) {
    if (dbFiles.length < 2) return;

    console.log(`🔍 Analyzing ${dbFiles.length} database files for conflicts...`);

    try {
      const apiPatterns = dbFiles.map(file => this.parseApiPatterns(file));
      const conflicts = [];

      // Check for duplicate API endpoints and data access patterns
      for (let i = 0; i < apiPatterns.length; i++) {
        for (let j = i + 1; j < apiPatterns.length; j++) {
          const pattern1 = apiPatterns[i];
          const pattern2 = apiPatterns[j];

          // Compare API endpoints
          if (pattern1.endpoints.length > 0 && pattern2.endpoints.length > 0) {
            for (const ep1 of pattern1.endpoints) {
              for (const ep2 of pattern2.endpoints) {
                const similarity = this.calculateSimilarity(ep1.url, ep2.url, 'api-endpoints').similarity;
                if (similarity > this.options.severityThresholds['api-endpoints']) {
                  conflicts.push({
                    type: 'duplicate-api-endpoints',
                    severity: 'HIGH',
                    files: [pattern1.file, pattern2.file],
                    description: `Duplicate API endpoints: ${ep1.url} and ${ep2.url} with ${Math.round(similarity * 100)}% similarity`,
                    patternMatch: similarity,
                    recommendation: 'Consolidate API endpoints into single service module',
                    consolidationPath: [
                      'Create centralized API service',
                      'Route all requests through unified endpoint',
                      'Maintain backward compatibility during migration'
                    ],
                    estimatedEffort: '2-6 hours',
                    risk: 'Medium'
                  });
                }
              }
            }
          }

          // Compare data access patterns
          if (pattern1.dataAccess.length > 0 && pattern2.dataAccess.length > 0) {
            const dataSimilarity = this.calculateArraySimilarity(
              pattern1.dataAccess.map(d => d.type),
              pattern2.dataAccess.map(d => d.type)
            );

            if (dataSimilarity > this.options.severityThresholds['database-patterns']) {
              conflicts.push({
                type: 'duplicate-data-access',
                severity: 'MEDIUM',
                files: [pattern1.file, pattern2.file],
                description: `Similar data access patterns with ${Math.round(dataSimilarity * 100)}% overlap`,
                patternMatch: dataSimilarity,
                recommendation: 'Consolidate data access into repository pattern',
                consolidationPath: [
                  'Create repository layer for data operations',
                  'Move duplicate data access logic to shared repositories',
                  'Update components to use repository interfaces'
                ],
                estimatedEffort: '3-8 hours',
                risk: 'Low'
              });
            }
          }
        }
      }

      this.conflicts.push(...conflicts);
      console.log(`Found ${conflicts.length} database conflicts`);
    } catch (error) {
      console.error('Error analyzing database patterns:', error.message);
    }
  }

  async analyzeTests(testFiles) {
    // Check for multiple testing frameworks
    const frameworks = [];
    testFiles.forEach(file => {
      if (file.content.includes('vitest')) frameworks.push('vitest');
      if (file.content.includes('jest')) frameworks.push('jest');
      if (file.content.includes('mocha')) frameworks.push('mocha');
    });

    const uniqueFrameworks = [...new Set(frameworks)];
    if (uniqueFrameworks.length > 1) {
      this.addConflict({
        conflictId: 'multiple-testing-frameworks',
        type: 'Testing Frameworks & Patterns',
        subtype: 'Multiple Test Frameworks',
        severity: 'MEDIUM',
        files: testFiles,
        description: `Multiple testing frameworks: ${uniqueFrameworks.join(', ')}`,
        patternMatch: 0.8,
        recommendation: 'Standardize on single testing framework',
        consolidationPath: ['Choose preferred testing framework', 'Convert all tests to chosen framework', 'Update CI/CD configuration'],
        estimatedEffort: '4-6 hours',
        risk: 'Low'
      });
    }
  }

  async analyzeFramework(frameworkFiles) {
    // Implementation for framework integration conflicts
  }

  async analyzeLegacy(legacyFiles) {
    // Check for legacy vs new conflicts
    if (legacyFiles.length > 0) {
      this.addConflict({
        conflictId: 'legacy-code-present',
        type: 'Legacy vs. New Code Conflicts',
        subtype: 'Legacy Code Coexistence',
        severity: 'MEDIUM',
        files: legacyFiles,
        description: `Legacy code detected in ${legacyFiles.length} files`,
        patternMatch: 0.7,
        recommendation: 'Plan migration path for legacy code',
        consolidationPath: ['Identify legacy functionality', 'Create migration plan', 'Implement new versions', 'Remove legacy code'],
        estimatedEffort: '10-20 hours',
        risk: 'Medium'
      });
    }
  }

  // Additional analysis methods for the 15 new categories
  async analyzeReactivePatterns(reactiveFiles) {
    const patterns = reactiveFiles.map(file => this.parseReactivePatterns(file));
    const reactiveTypes = new Set();

    patterns.forEach(p => {
      if (p.usesReactive) reactiveTypes.add('reactive()');
      if (p.usesRef) reactiveTypes.add('ref()');
      if (p.usesShallowReactive) reactiveTypes.add('shallowReactive()');
    });

    if (reactiveTypes.size > 2) {
      this.addConflict({
        conflictId: 'mixed-reactive-patterns',
        type: 'Reactive State Management Conflicts',
        subtype: 'Mixed Reactive Patterns',
        severity: 'MEDIUM',
        files: reactiveFiles,
        description: `Multiple reactive patterns: ${[...reactiveTypes].join(', ')}`,
        patternMatch: 0.8,
        recommendation: 'Standardize on consistent reactive pattern',
        consolidationPath: ['Choose preferred reactive pattern', 'Update code to use consistent pattern', 'Document pattern guidelines'],
        estimatedEffort: '2-3 hours',
        risk: 'Low'
      });
    }
  }

  async analyzeSideEffects(lifecycleFiles) {
    const sideEffects = lifecycleFiles.map(file => this.parseSideEffects(file));

    // Group by similar side effect patterns
    const effectGroups = this.groupBySideEffectPattern(sideEffects);

    effectGroups.forEach(group => {
      if (group.length > 1) {
        this.addConflict({
          conflictId: 'duplicate-side-effects',
          type: 'Side Effects & Lifecycle Conflicts',
          subtype: 'Duplicate Side Effects',
          severity: 'HIGH',
          files: group.map(g => g.file),
          description: `Duplicate side effects in ${group.length} locations`,
          patternMatch: 0.85,
          recommendation: 'Consolidate side effects to single lifecycle owner',
          consolidationPath: ['Identify side effect owner', 'Move duplicate logic to appropriate location', 'Clean up redundant side effects'],
          estimatedEffort: '2-4 hours',
          risk: 'Medium'
        });
      }
    });
  }

  async analyzeErrorHandling(errorFiles) {
    const errorPatterns = errorFiles.map(file => this.parseErrorHandling(file));
    const strategies = [...new Set(errorPatterns.map(p => p.strategy))];

    if (strategies.length > 2) {
      this.addConflict({
        conflictId: 'inconsistent-error-handling',
        type: 'Error Handling Pattern Conflicts',
        subtype: 'Multiple Error Handling Strategies',
        severity: 'HIGH',
        files: errorFiles,
        description: `Multiple error handling strategies: ${strategies.join(', ')}`,
        patternMatch: 0.8,
        recommendation: 'Standardize on centralized error handling',
        consolidationPath: ['Create unified error handling service', 'Update all error handling to use centralized service', 'Document error handling patterns'],
        estimatedEffort: '3-5 hours',
        risk: 'Medium'
      });
    }
  }

  async analyzeStatePassing(stateAccessFiles) {
    const patterns = stateAccessFiles.map(file => this.parseStatePassing(file));
    const strategies = [...new Set(patterns.map(p => p.strategy))];

    if (strategies.length > 1) {
      this.addConflict({
        conflictId: 'mixed-state-passing',
        type: 'Prop Drilling vs. Provide/Inject Conflicts',
        subtype: 'Inconsistent State Access Patterns',
        severity: 'MEDIUM',
        files: stateAccessFiles,
        description: `Mixed state passing strategies: ${strategies.join(', ')}`,
        patternMatch: 0.75,
        recommendation: 'Establish clear state access strategy',
        consolidationPath: ['Define state access guidelines', 'Refactor to use consistent strategy', 'Update component hierarchies if needed'],
        estimatedEffort: '2-4 hours',
        risk: 'Medium'
      });
    }
  }

  // Continue with remaining analysis methods...
  async analyzeFormHandling(formFiles) {
    // Implementation for form handling conflicts
  }

  async analyzeValidation(validationFiles) {
    if (validationFiles.length < 2) return;

    console.log(`🔍 Analyzing ${validationFiles.length} validation files for conflicts...`);

    try {
      const validationRules = validationFiles.map(file => this.parseValidationRules(file));
      const conflicts = [];

      // Check for duplicate validation rules
      for (let i = 0; i < validationRules.length; i++) {
        for (let j = i + 1; j < validationRules.length; j++) {
          const rules1 = validationRules[i];
          const rules2 = validationRules[j];

          // Compare validation rule patterns
          if (rules1.patterns.length > 0 && rules2.patterns.length > 0) {
            const ruleSimilarity = this.calculateArraySimilarity(
              rules1.patterns.map(p => p.type),
              rules2.patterns.map(p => p.type)
            );

            if (ruleSimilarity > this.options.severityThresholds['validation-rules']) {
              conflicts.push({
                type: 'duplicate-validation-rules',
                severity: 'HIGH',
                files: [rules1.file, rules2.file],
                description: `Duplicate validation rules with ${Math.round(ruleSimilarity * 100)}% overlap`,
                patternMatch: ruleSimilarity,
                recommendation: 'Consolidate validation logic into shared schema',
                consolidationPath: [
                  'Create centralized validation schema',
                  'Move duplicate validation rules to shared validators',
                  'Use composition for complex validation scenarios',
                  'Remove duplicate validation implementations'
                ],
                estimatedEffort: '4-10 hours',
                risk: 'Medium'
              });
            }
          }

          // Check for conflicting validation patterns
          for (const rule1 of rules1.patterns) {
            for (const rule2 of rules2.patterns) {
              if (rule1.field === rule2.field && rule1.type !== rule2.type) {
                conflicts.push({
                  type: 'conflicting-validation-rules',
                  severity: 'HIGH',
                  files: [rules1.file, rules2.file],
                  description: `Conflicting validation rules for field '${rule1.field}': ${rule1.type} vs ${rule2.type}`,
                  patternMatch: 1.0,
                  recommendation: 'Standardize validation rules for each field',
                  consolidationPath: [
                    'Create field-level validation schema',
                    'Define single validation approach per field',
                    'Update all forms to use consistent validation'
                  ],
                  estimatedEffort: '2-6 hours',
                  risk: 'High'
                });
              }
            }
          }
        }
      }

      this.conflicts.push(...conflicts);
      console.log(`Found ${conflicts.length} validation conflicts`);
    } catch (error) {
      console.error('Error analyzing validation patterns:', error.message);
    }
  }

  async analyzeTypeDefinitions(typeFiles) {
    // Implementation for type definition conflicts
  }

  async analyzeAuthentication(authFiles) {
    // Implementation for auth conflicts
  }

  async analyzeFormatting(formatterFiles) {
    // Implementation for formatting conflicts
  }

  async analyzeAsyncPatterns(asyncFiles) {
    if (asyncFiles.length < 2) return;

    console.log(`🔍 Analyzing ${asyncFiles.length} async files for conflicts...`);

    try {
      const asyncPatterns = asyncFiles.map(file => this.parseAsyncPatterns(file));
      const conflicts = [];

      // Check for mixed async patterns
      for (let i = 0; i < asyncPatterns.length; i++) {
        for (let j = i + 1; j < asyncPatterns.length; j++) {
          const patterns1 = asyncPatterns[i];
          const patterns2 = asyncPatterns[j];

          // Check for inconsistent async patterns in similar contexts
          const patternSimilarity = this.calculateSimilarity(
            patterns1.context,
            patterns2.context,
            'async-patterns'
          ).similarity;

          if (patternSimilarity > this.options.severityThresholds['async-patterns']) {
            const style1 = patterns1.dominantStyle;
            const style2 = patterns2.dominantStyle;

            if (style1 !== style2) {
              conflicts.push({
                type: 'inconsistent-async-patterns',
                severity: 'MEDIUM',
                files: [patterns1.file, patterns2.file],
                description: `Mixed async patterns: ${style1} vs ${style2} in similar contexts`,
                patternMatch: patternSimilarity,
                recommendation: 'Standardize async patterns across the codebase',
                consolidationPath: [
                  `Choose ${style1} as standard pattern for async operations`,
                  'Convert inconsistent patterns to standard approach',
                  'Create async utilities for common patterns',
                  'Document async pattern guidelines'
                ],
                estimatedEffort: '6-12 hours',
                risk: 'Medium'
              });
            }
          }

          // Check for duplicate async logic
          if (patterns1.operations.length > 0 && patterns2.operations.length > 0) {
            const operationSimilarity = this.calculateArraySimilarity(
              patterns1.operations.map(op => op.type),
              patterns2.operations.map(op => op.type)
            );

            if (operationSimilarity > this.options.severityThresholds['utility-functions']) {
              conflicts.push({
                type: 'duplicate-async-logic',
                severity: 'LOW',
                files: [patterns1.file, patterns2.file],
                description: `Duplicate async operations with ${Math.round(operationSimilarity * 100)}% overlap`,
                patternMatch: operationSimilarity,
                recommendation: 'Extract common async operations to shared services',
                consolidationPath: [
                  'Create service layer for async operations',
                  'Move duplicate async logic to shared functions',
                  'Use dependency injection for async services',
                  'Remove duplicate async implementations'
                ],
                estimatedEffort: '3-8 hours',
                risk: 'Low'
              });
            }
          }
        }
      }

      this.conflicts.push(...conflicts);
      console.log(`Found ${conflicts.length} async pattern conflicts`);
    } catch (error) {
      console.error('Error analyzing async patterns:', error.message);
    }
  }

  async analyzeConstants(constantFiles) {
    if (constantFiles.length < 2) return;

    console.log(`🔍 Analyzing ${constantFiles.length} constant files for conflicts...`);

    try {
      const constants = constantFiles.map(file => this.parseConstants(file));
      const conflicts = [];

      // Check for duplicate constants
      for (let i = 0; i < constants.length; i++) {
        for (let j = i + 1; j < constants.length; j++) {
          const constants1 = constants[i];
          const constants2 = constants[j];

          // Check for exact duplicate constants
          for (const const1 of constants1.constants) {
            for (const const2 of constants2.constants) {
              // Check name similarity
              const nameSimilarity = this.calculateSimilarity(
                const1.name.toLowerCase(),
                const2.name.toLowerCase(),
                'constants'
              ).similarity;

              if (nameSimilarity > this.options.severityThresholds['constants']) {
                conflicts.push({
                  type: 'duplicate-constants',
                  severity: 'HIGH',
                  files: [constants1.file, constants2.file],
                  description: `Duplicate or very similar constants: ${const1.name} and ${const2.name}`,
                  patternMatch: nameSimilarity,
                  recommendation: 'Consolidate constants into shared configuration',
                  consolidationPath: [
                    'Create centralized constants file',
                    'Merge duplicate constants with proper naming',
                    'Update all references to use consolidated constants',
                    'Remove duplicate constant definitions'
                  ],
                  estimatedEffort: '2-4 hours',
                  risk: 'Low'
                });
              }

              // Check value similarity for same-named constants
              if (const1.name === const2.name && const1.value !== const2.value) {
                conflicts.push({
                  type: 'conflicting-constant-values',
                  severity: 'HIGH',
                  files: [constants1.file, constants2.file],
                  description: `Same constant name '${const1.name}' with different values: ${const1.value} vs ${const2.value}`,
                  patternMatch: 1.0,
                  recommendation: 'Resolve conflicting constant values',
                  consolidationPath: [
                    'Determine correct value for each constant',
                    'Update all instances to use consistent value',
                    'Add validation to prevent future conflicts',
                    'Document constant value decisions'
                  ],
                  estimatedEffort: '1-3 hours',
                  risk: 'High'
                });
              }
            }
          }

          // Check for magic numbers that should be constants
          const magicNumbers1 = constants1.content.match(/\b\d{2,}\b/g) || [];
          const magicNumbers2 = constants2.content.match(/\b\d{2,}\b/g) || [];

          if (magicNumbers1.length > 3 || magicNumbers2.length > 3) {
            conflicts.push({
              type: 'magic-numbers',
              severity: 'LOW',
              files: [constants1.file, constants2.file],
              description: `Potential magic numbers detected: ${magicNumbers1.length + magicNumbers2.length} occurrences`,
              patternMatch: 0.8,
              recommendation: 'Replace magic numbers with named constants',
              consolidationPath: [
                'Identify repeated numeric values',
                'Create descriptive constants for magic numbers',
                'Replace magic numbers with constant references',
                'Add linting rules to prevent new magic numbers'
              ],
              estimatedEffort: '2-5 hours',
              risk: 'Low'
            });
          }
        }
      }

      this.conflicts.push(...conflicts);
      console.log(`Found ${conflicts.length} constant conflicts`);
    } catch (error) {
      console.error('Error analyzing constants:', error.message);
    }
  }

  async analyzeNotifications(notificationFiles) {
    // Implementation for notification conflicts
  }

  async analyzeCaching(cacheFiles) {
    // Implementation for caching conflicts
  }

  async analyzeContentPatterns(contentFiles) {
    // Implementation for slot vs prop conflicts
  }

  async analyzeNaming(namingFiles) {
    // Implementation for naming convention conflicts
  }

  // Helper methods for parsing and analysis
  extractStoreName(content) {
    const match = content.match(/defineStore\(['"]([^'"]+)['"]/);
    return match ? match[1] : 'unknown';
  }

  extractStoreState(content) {
    const stateMatch = content.match(/\{[^}]*state[^}]*\}/s);
    return stateMatch ? stateMatch[0] : '';
  }

  extractStoreGetters(content) {
    const getterMatches = content.matchAll(/\w+\s*:\s*get\s*\([^)]*\)\s*=>/g);
    return Array.from(getterMatches).map(m => m[0]);
  }

  extractStoreActions(content) {
    const actionMatches = content.matchAll(/\w+\s*:\s*async?\s*\([^)]*\)\s*=>/g);
    return Array.from(actionMatches).map(m => m[0]);
  }

  extractImports(content) {
    const importMatches = content.matchAll(/import\s+[^;]+;/g);
    return Array.from(importMatches).map(m => m[0]);
  }

  parseComposable(file) {
    return {
      file,
      name: this.extractComposableName(file.content),
      hooks: this.extractHooks(file.content),
      returns: this.extractReturns(file.content)
    };
  }

  parseComponent(file) {
    return {
      file,
      name: this.extractComponentName(file.content),
      props: this.extractProps(file.content),
      emits: this.extractEmits(file.content),
      slots: this.extractSlots(file.content)
    };
  }

  parseUtilities(file) {
    const functions = this.extractFunctions(file.content);
    return {
      file,
      functions: functions.map(fn => ({ ...fn, file }))
    };
  }

  parseFilters(file) {
    return {
      file,
      hasFilterLogic: /filter\(|\.filter\(|useFilter|useSearch/.test(file.content),
      filterCount: (file.content.match(/filter\(/g) || []).length
    };
  }

  // Similar parsing methods for other categories...
  parseCalendar(file) {
    return {
      file,
      hasCalendarLogic: /calendar|date|schedule/.test(file.content),
      library: this.detectCalendarLibrary(file.content)
    };
  }

  parseDragDrop(file) {
    return {
      file,
      library: this.detectDragDropLibrary(file.content),
      hasDragLogic: /drag|drop|vuedraggable/.test(file.content)
    };
  }

  parseReactivePatterns(file) {
    return {
      file,
      usesReactive: /reactive\(/.test(file.content),
      usesRef: /ref\(/.test(file.content),
      usesShallowReactive: /shallowReactive\(/.test(file.content)
    };
  }

  parseSideEffects(file) {
    return {
      file,
      hasOnMounted: /onMounted/.test(file.content),
      fetchData: /fetch\(|axios\.get/.test(file.content),
      effectPattern: this.detectEffectPattern(file.content)
    };
  }

  parseErrorHandling(file) {
    const hasTryCatch = /try\s*\{[^}]*\}\s*catch/.test(file.content);
    const hasErrorHandler = /errorHandler|catchError/.test(file.content);

    return {
      file,
      strategy: hasErrorHandler ? 'centralized' : hasTryCatch ? 'local' : 'none'
    };
  }

  parseStatePassing(file) {
    const hasProvide = /provide\(/.test(file.content);
    const hasInject = /inject\(/.test(file.content);
    const hasProps = /props:/.test(file.content);

    return {
      file,
      strategy: hasProvide ? 'provide-inject' : hasProps ? 'props' : 'store'
    };
  }

  // Similarity calculation methods
  calculateSimilarity(code1, code2, category = 'default') {
    const threshold = this.options.severityThresholds[category] || this.options.defaultThreshold;

    const similarity = this.calculateStringSimilarity(code1, code2);

    return {
      similarity: similarity,
      exceedsThreshold: similarity > threshold
    };
  }

  calculateStoreSimilarity(store1, store2) {
    const stateSimilarity = this.calculateStringSimilarity(store1.state, store2.state);
    const getterSimilarity = this.calculateArraySimilarity(store1.getters, store2.getters);
    const actionSimilarity = this.calculateArraySimilarity(store1.actions, store2.actions);

    return (stateSimilarity + getterSimilarity + actionSimilarity) / 3;
  }

  calculateComposableSimilarity(comp1, comp2) {
    const hookSimilarity = this.calculateArraySimilarity(comp1.hooks, comp2.hooks);
    const nameSimilarity = this.calculateStringSimilarity(comp1.name, comp2.name);

    return (hookSimilarity + nameSimilarity) / 2;
  }

  calculateComponentSimilarity(comp1, comp2) {
    const propSimilarity = this.calculateArraySimilarity(comp1.props, comp2.props);
    const emitSimilarity = this.calculateArraySimilarity(comp1.emits, comp2.emits);
    const nameSimilarity = this.calculateStringSimilarity(comp1.name, comp2.name);

    return (propSimilarity + emitSimilarity + nameSimilarity) / 3;
  }

  calculateFunctionSimilarity(fn1, fn2) {
    return this.calculateStringSimilarity(fn1.body, fn2.body);
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  calculateArraySimilarity(arr1, arr2) {
    if (!arr1.length && !arr2.length) return 1.0;
    if (!arr1.length || !arr2.length) return 0.0;

    const intersection = arr1.filter(item => arr2.includes(item));
    const union = [...new Set([...arr1, ...arr2])];

    return intersection.length / union.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Utility methods
  isSourceFile(filePath) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
    return extensions.some(ext => filePath.endsWith(ext));
  }

  readFileSafely(filePath) {
    try {
      if (fs.statSync(filePath).size > this.options.maxFileSize) {
        return null;
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  loadPatterns() {
    try {
      // Fix: Use current skill directory path for pattern loading
      const currentDir = fileURLToPath(new URL('.', import.meta.url));
      const patternsPath = path.join(currentDir, 'conflict-patterns.json');
      console.log('Loading patterns from:', patternsPath);
      if (fs.existsSync(patternsPath)) {
        const content = fs.readFileSync(patternsPath, 'utf8');
        const parsed = JSON.parse(content);
        console.log('Patterns loaded successfully');
        return parsed;
      } else {
        console.log('Patterns file not found, using empty patterns');
      }
    } catch (error) {
      console.warn('Could not load patterns file:', error.message);
      console.warn('Stack:', error.stack);
    }
    return { categories: {} };
  }

  loadExemptions() {
    try {
      const exemptionsPath = path.join(process.cwd(), '.claude-skills/detect-competing-systems/exemptions.json');
      if (fs.existsSync(exemptionsPath)) {
        return JSON.parse(fs.readFileSync(exemptionsPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load exemptions file:', error.message);
    }
    return { exemptions: [] };
  }

  // Helper methods for parsing different file types
  parseApiPatterns(file) {
    const content = file.content;
    const endpoints = [];
    const dataAccess = [];

    // Extract API endpoints
    const urlMatches = content.match(/['"`]([^'"`]*(?:\/api\/|\/)[^'"`]*)['"`]/g);
    if (urlMatches) {
      urlMatches.forEach(url => {
        const cleanUrl = url.replace(/['"`]/g, '');
        if (cleanUrl.includes('/api/') || cleanUrl.includes('/fetch') || cleanUrl.includes('/get')) {
          endpoints.push({ url: cleanUrl, method: 'GET' });
        }
      });
    }

    // Extract data access patterns
    if (content.includes('fetch(') || content.includes('axios.') || content.includes('http.')) {
      dataAccess.push({ type: 'http-client' });
    }
    if (content.includes('db.') || content.includes('query(') || content.includes('execute(')) {
      dataAccess.push({ type: 'database' });
    }
    if (content.includes('PouchDB') || content.includes('IndexedDB') || content.includes('localStorage')) {
      dataAccess.push({ type: 'storage' });
    }

    return {
      file: file.relativePath,
      endpoints,
      dataAccess
    };
  }

  parseTestPatterns(file) {
    const content = file.content;
    const structure = [];

    // Extract test structure
    const testMatches = content.match(/(describe|it|test)\s*\(['"`]([^'"`]*)['"`]/g);
    if (testMatches) {
      testMatches.forEach(match => {
        const cleanMatch = match.replace(/['"`]/g, '');
        structure.push(cleanMatch);
      });
    }

    return {
      file: file.relativePath,
      structure
    };
  }

  parseValidationRules(file) {
    const content = file.content;
    const patterns = [];

    // Extract validation patterns
    const requiredMatches = content.match(/required:\s*true/gi);
    if (requiredMatches) {
      patterns.push({ type: 'required', count: requiredMatches.length });
    }

    const patternMatches = content.match(/pattern:\s*['"`]([^'"`]*)['"`]/g);
    if (patternMatches) {
      patterns.push({ type: 'regex', count: patternMatches.length });
    }

    // Extract field names
    const fieldMatches = content.match(/(\w+):\s*\{[^}]*required|pattern|validate/g);
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const field = match.split(':')[0];
        patterns.push({ type: 'field-validation', field });
      });
    }

    return {
      file: file.relativePath,
      patterns
    };
  }

  parseAsyncPatterns(file) {
    const content = file.content;
    let dominantStyle = 'callback';
    const operations = [];

    // Count async patterns
    const asyncAwaitCount = (content.match(/async\s+\w+|await\s+/g) || []).length;
    const promiseCount = (content.match(/Promise\.|\.then\(|\.catch\(/g) || []).length;
    const callbackCount = (content.match(/function\([^)]*\)\s*{[^}]*callback|callback\(/g) || []).length;

    if (asyncAwaitCount > promiseCount && asyncAwaitCount > callbackCount) {
      dominantStyle = 'async/await';
    } else if (promiseCount > callbackCount) {
      dominantStyle = 'promise';
    }

    // Extract async operations
    if (content.includes('fetch(')) operations.push({ type: 'fetch' });
    if (content.includes('axios.')) operations.push({ type: 'axios' });
    if (content.includes('async') || content.includes('await')) operations.push({ type: 'async/await' });
    if (content.includes('.then(') || content.includes('.catch(')) operations.push({ type: 'promise' });

    return {
      file: file.relativePath,
      context: content.substring(0, 500), // First 500 chars for context comparison
      dominantStyle,
      operations
    };
  }

  parseConstants(file) {
    const content = file.content;
    const constants = [];

    // Extract constant declarations
    const constMatches = content.match(/(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=\s*([^;]+)/g);
    if (constMatches) {
      constMatches.forEach(match => {
        const parts = match.match(/(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=\s*([^;]+)/);
        if (parts) {
          constants.push({
            name: parts[1],
            value: parts[2].trim()
          });
        }
      });
    }

    return {
      file: file.relativePath,
      content,
      constants
    };
  }

  addConflict(conflict) {
    this.conflicts.push(conflict);
  }

  groupByFunctionality(items) {
    const groups = {};
    items.forEach(item => {
      const key = this.extractFunctionalityKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.values(groups);
  }

  groupBySimilarNames(components) {
    const groups = {};
    components.forEach(comp => {
      const baseName = this.extractBaseComponentName(comp.name);
      if (!groups[baseName]) groups[baseName] = [];
      groups[baseName].push(comp);
    });
    return Object.values(groups).filter(group => group.length > 1);
  }

  groupByComponentFunctionality(components) {
    // Group by similar props, emits, and template patterns
    return this.groupByFunctionality(components);
  }

  groupByFunctionSignature(functions) {
    const groups = {};
    functions.forEach(fn => {
      const signature = `${fn.name}(${fn.parameters.map(p => p.type).join(',')})`;
      if (!groups[signature]) groups[signature] = [];
      groups[signature].push(fn);
    });
    return Object.values(groups).filter(group => group.length > 1);
  }

  groupBySideEffectPattern(sideEffects) {
    const groups = {};
    sideEffects.forEach(se => {
      if (!groups[se.effectPattern]) groups[se.effectPattern] = [];
      groups[se.effectPattern].push(se);
    });
    return Object.values(groups).filter(group => group.length > 1);
  }

  // Extraction helper methods
  extractComposableName(content) {
    const match = content.match(/(?:export\s+)?(?:function|const)\s+(\w*use\w*)/);
    return match ? match[1] : 'unknown';
  }

  extractComponentName(content) {
    const match = content.match(/name\s*:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : 'unknown';
  }

  extractHooks(content) {
    const hookMatches = content.matchAll(/(\w*use\w*)\(/g);
    return Array.from(new Set(Array.from(hookMatches).map(m => m[1])));
  }

  extractReturns(content) {
    const returnMatch = content.match(/return\s*\{([^}]+)\}/);
    return returnMatch ? returnMatch[1].split(',').map(s => s.trim()) : [];
  }

  extractProps(content) {
    const propMatches = content.matchAll(/(\w+)\s*:/g);
    return Array.from(propMatches).map(m => m[1]);
  }

  extractEmits(content) {
    const emitMatches = content.matchAll(/emit\(['"]([^'"]+)['"]/g);
    return Array.from(emitMatches).map(m => m[1]);
  }

  extractSlots(content) {
    const slotMatches = content.matchAll(/#\w+/g);
    return Array.from(slotMatches).map(m => m[0]);
  }

  extractFunctions(content) {
    const functionMatches = content.matchAll(/(?:function|const)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
    return Array.from(functionMatches).map(match => ({
      name: match[1],
      body: this.extractFunctionBody(content, match.index)
    }));
  }

  extractFunctionBody(content, startIndex) {
    const afterArrow = content.slice(startIndex);
    const braceMatch = afterArrow.match(/\{([^}]*)\}/);
    return braceMatch ? braceMatch[1] : '';
  }

  extractFunctionalityKey(item) {
    // Simple heuristic based on name and content
    return item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  extractBaseComponentName(name) {
    // Extract base name from variants like TaskCard, TaskItem, TaskList -> Task
    const match = name.match(/^(\w+)/);
    return match ? match[1].toLowerCase() : name.toLowerCase();
  }

  detectCalendarLibrary(content) {
    if (content.includes('vue-cal')) return 'vue-cal';
    if (content.includes('qalendar')) return 'qalendar';
    if (content.includes('full-calendar')) return 'full-calendar';
    return 'custom';
  }

  detectDragDropLibrary(content) {
    if (content.includes('vuedraggable')) return 'vuedraggable';
    if (content.includes('sortablejs')) return 'sortablejs';
    if (content.includes('@meili')) return 'vue-draggable-plus';
    return 'html5-api';
  }

  detectEffectPattern(content) {
    if (content.includes('fetch(') && content.includes('onMounted')) return 'fetch-on-mounted';
    if (content.includes('watch(')) return 'watch-effect';
    if (content.includes('computed(')) return 'computed-effect';
    return 'other';
  }

  /**
   * Generate final conflict report
   */
  generateReport() {
    const summary = this.generateSummary();
    const conflicts = this.conflicts.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return {
      timestamp: new Date().toISOString(),
      summary,
      conflicts,
      recommendations: this.generateRecommendations(),
      metrics: this.generateMetrics()
    };
  }

  generateSummary() {
    const total = this.conflicts.length;
    const bySeverity = {
      HIGH: this.conflicts.filter(c => c.severity === 'HIGH').length,
      MEDIUM: this.conflicts.filter(c => c.severity === 'MEDIUM').length,
      LOW: this.conflicts.filter(c => c.severity === 'LOW').length
    };

    return {
      total,
      bySeverity,
      categories: [...new Set(this.conflicts.map(c => c.type))]
    };
  }

  generateRecommendations() {
    const recommendations = [];

    // Prioritize HIGH severity conflicts
    const highSeverityConflicts = this.conflicts.filter(c => c.severity === 'HIGH');

    if (highSeverityConflicts.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Address HIGH severity conflicts immediately',
        details: `Focus on ${highSeverityConflicts.length} critical conflicts that could cause bugs or major maintenance issues`
      });
    }

    // Recommend consolidation patterns
    const commonTypes = this.conflicts.reduce((acc, conflict) => {
      acc[conflict.subtype] = (acc[conflict.subtype] || 0) + 1;
      return acc;
    }, {});

    Object.entries(commonTypes)
      .filter(([, count]) => count > 1)
      .forEach(([type, count]) => {
        recommendations.push({
          priority: 'MEDIUM',
          action: `Standardize ${type}`,
          details: `${count} instances of ${type} detected - establish consistent pattern`
        });
      });

    return recommendations;
  }

  generateMetrics() {
    return {
      totalConflicts: this.conflicts.length,
      averageSimilarity: this.conflicts.reduce((sum, c) => sum + (c.patternMatch || 0), 0) / Math.max(this.conflicts.length, 1),
      estimatedTotalEffort: this.calculateTotalEffort(),
      riskDistribution: this.calculateRiskDistribution()
    };
  }

  calculateTotalEffort() {
    return this.conflicts.reduce((total, conflict) => {
      const hours = this.parseEffort(conflict.estimatedEffort);
      return total + hours;
    }, 0);
  }

  parseEffort(effortString) {
    const match = effortString.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  }

  calculateRiskDistribution() {
    const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    this.conflicts.forEach(conflict => {
      distribution[conflict.risk] = (distribution[conflict.risk] || 0) + 1;
    });
    return distribution;
  }
}

// CLI interface - Check if this file is being run directly
if (process.argv[1] && process.argv[1].endsWith('analysis-engine.js')) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--threshold') {
      options.similarityThreshold = parseFloat(args[++i]);
    } else if (args[i] === '--output') {
      options.outputFile = args[++i];
    } else if (args[i] === '--format') {
      options.format = args[++i];
    }
  }

  const analyzer = new CompetingSystemsAnalyzer(options);

  analyzer.analyzeProject()
    .then(report => {
      if (options.outputFile) {
        fs.writeFileSync(options.outputFile, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved to: ${options.outputFile}`);
      } else {
        console.log(JSON.stringify(report, null, 2));
      }
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    });
}

export default CompetingSystemsAnalyzer;