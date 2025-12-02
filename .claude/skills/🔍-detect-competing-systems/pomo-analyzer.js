const fs = require('fs');
const path = require('path');

class PomoFlowAnalyzer {
  constructor(sourceDir = './src') {
    this.sourceDir = sourceDir;
    this.conflicts = [];
    this.analyzed = new Map();
  }

  analyze() {
    console.log('🔍 Starting PomoFlow conflict analysis...\n');
    
    this.scanDirectory(this.sourceDir);
    this.detectConflicts();
    this.generateReport();
    
    return this.conflicts;
  }

  scanDirectory(dir, files = {}) {
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath, files);
        } else if (entry.endsWith('.ts') || entry.endsWith('.vue')) {
          files[fullPath] = fs.readFileSync(fullPath, 'utf8');
        }
      }
      
      this.analyzed = new Map(Object.entries(files));
      console.log(`✓ Scanned ${this.analyzed.size} files\n`);
    } catch (err) {
      console.error('Error scanning directory:', err.message);
    }
  }

  detectConflicts() {
    console.log('📊 Analyzing for conflicts...\n');
    this.detectMultipleDataFetches();
    this.detectDuplicateStores();
    this.detectFilteringConflicts();
    this.detectCalendarConflicts();
    this.detectDragDropConflicts();
    this.detectReactivePatternConflicts();
    this.detectErrorHandlingConflicts();
    this.detectTypeConflicts();
  }

  detectMultipleDataFetches() {
    const fetchLocations = [];
    const pattern = /onMounted|onBeforeMount|watchEffect|watch\(.*async/;
    
    for (const [file, content] of this.analyzed) {
      if (pattern.test(content) && /fetch|apiClient|axios/.test(content)) {
        fetchLocations.push({
          file: this.relativePath(file),
          lines: this.findLineNumbers(content, pattern),
        });
      }
    }

    if (fetchLocations.length > 1) {
      this.conflicts.push({
        id: 'side-effects-001',
        category: 'Side Effects & Lifecycle',
        severity: 'HIGH',
        type: 'Multiple data fetch locations',
        files: fetchLocations,
        description: `Found ${fetchLocations.length} locations with data fetching. Should consolidate to single source (store).`,
        issues: [
          'Data fetching in multiple lifecycle hooks',
          'Race conditions possible',
          'Redundant API calls',
          'Cache invalidation problems',
        ],
        recommendation: 'Centralize all data fetching in store. Call store method once from App.vue.',
        effort: '2-3 hours',
        risk: 'HIGH',
        consolidationPath: [
          '1. Create fetch method in store only',
          '2. Remove all fetch logic from components',
          '3. Call store.fetch() once in App.vue:onBeforeMount()',
          '4. Test all views for proper data loading',
        ],
      });
    }
  }

  detectDuplicateStores() {
    const stores = new Map();
    const storePattern = /defineStore\(['"](\w+)['"]\s*,\s*\(\)\s*=>\s*\{([^}]*tasks[^}]*)\}/;

    for (const [file, content] of this.analyzed) {
      if (file.includes('/stores/')) {
        const match = content.match(storePattern);
        if (match) {
          const storeName = match[1];
          const storeBody = match[2];
          
          stores.set(file, {
            name: storeName,
            body: storeBody,
            size: storeBody.length,
          });
        }
      }
    }

    const names = Array.from(stores.values()).map(s => s.name);
    const taskRelated = names.filter(n => 
      n.includes('task') || n.includes('Task') || 
      n.includes('workflow') || n.includes('Workflow')
    );

    if (taskRelated.length > 1) {
      this.conflicts.push({
        id: 'stores-001',
        category: 'State Management',
        severity: 'HIGH',
        type: 'Potential duplicate stores',
        stores: taskRelated,
        files: Array.from(stores.keys()),
        description: `Found multiple stores managing task-related state: ${taskRelated.join(', ')}`,
        issues: [
          'Duplicated state management logic',
          'Risk of data inconsistency',
          'Maintenance burden',
          'Difficulty tracking state changes',
        ],
        recommendation: 'Consolidate into single TaskStore with computed properties for different views.',
        effort: '2-3 hours',
        risk: 'MEDIUM',
        consolidationPath: [
          '1. Review all task stores',
          '2. Identify overlapping functionality',
          '3. Merge into single consolidated store',
          '4. Add computed properties for view-specific needs',
          '5. Update all imports',
        ],
      });
    }
  }

  detectFilteringConflicts() {
    const filterImplementations = [];
    const filterPatterns = [
      /filter\s*\(\s*t\s*=>\s*t\..*includes/,
      /\.filter.*\.filter.*\.sort/,
      /useTaskFilter|useSearch|useFilter/,
    ];

    for (const [file, content] of this.analyzed) {
      for (const pattern of filterPatterns) {
        if (pattern.test(content)) {
          filterImplementations.push(this.relativePath(file));
          break;
        }
      }
    }

    if (filterImplementations.length > 2) {
      this.conflicts.push({
        id: 'filters-001',
        category: 'Filtering & Search',
        severity: 'HIGH',
        type: 'Multiple filter implementations',
        files: filterImplementations,
        description: `Found ${filterImplementations.length} locations implementing filtering logic.`,
        issues: [
          'Filter logic duplicated across components',
          'Inconsistent filter behavior',
          'Maintenance nightmare',
          'Hard to add new filters',
        ],
        recommendation: 'Create single FilterStore with centralized filter logic.',
        effort: '3-4 hours',
        risk: 'MEDIUM',
        consolidationPath: [
          '1. Create FilterStore with all filter criteria',
          '2. Implement apply() method for filtering',
          '3. Replace all inline filters with store.apply()',
          '4. Add tests for all filter combinations',
        ],
      });
    }
  }

  detectCalendarConflicts() {
    const calendarImplementations = [];
    const calendarPatterns = [
      /daysInMonth|daysCount|monthDays/,
      /getDate.*getMonth|new Date.*getDay/,
      /useCalendar|CalendarLogic|calendarMatrix/,
    ];

    for (const [file, content] of this.analyzed) {
      if (file.includes('Calendar') || file.includes('calendar')) {
        for (const pattern of calendarPatterns) {
          if (pattern.test(content)) {
            calendarImplementations.push(this.relativePath(file));
            break;
          }
        }
      }
    }

    if (calendarImplementations.length > 1) {
      this.conflicts.push({
        id: 'calendar-001',
        category: 'Calendar/Scheduling',
        severity: 'HIGH',
        type: 'Multiple calendar implementations',
        files: calendarImplementations,
        description: `Found ${calendarImplementations.length} calendar-related files with date logic.`,
        issues: [
          'Calendar calculations duplicated',
          'Timezone handling inconsistent',
          'Month navigation logic repeated',
        ],
        recommendation: 'Consolidate into single useCalendar() composable.',
        effort: '4-5 hours',
        risk: 'HIGH',
        consolidationPath: [
          '1. Create useCalendar() composable',
          '2. Move all date calculations there',
          '3. Export calendarMatrix, navigation methods',
          '4. Replace all implementations with composable',
          '5. Test all calendar views',
        ],
      });
    }
  }

  detectDragDropConflicts() {
    const dragImplementations = [];
    const dragPatterns = [
      /onDragStart|onDragOver|onDrop|handleDrag/,
      /vuedraggable|SortableJS|HTML5/,
      /useDrag|useDropZone|draggedItem/,
    ];

    for (const [file, content] of this.analyzed) {
      let count = 0;
      for (const pattern of dragPatterns) {
        count += (content.match(pattern) || []).length;
      }
      if (count > 0) {
        dragImplementations.push({
          file: this.relativePath(file),
          matches: count,
        });
      }
    }

    if (dragImplementations.length > 2) {
      this.conflicts.push({
        id: 'dnd-001',
        category: 'Drag-and-Drop',
        severity: 'HIGH',
        type: 'Multiple D&D implementations',
        files: dragImplementations.map(d => d.file),
        description: `Found ${dragImplementations.length} files with drag-drop logic.`,
        issues: [
          'Different D&D libraries used',
          'Inconsistent drag behavior',
          'Drop validation duplicated',
          'Hard to add new drag targets',
        ],
        recommendation: 'Create unified useDraggable() composable wrapper.',
        effort: '5-6 hours',
        risk: 'HIGH',
        consolidationPath: [
          '1. Create useDraggable() composable',
          '2. Abstract all D&D to composable',
          '3. Use HTML5 API internally',
          '4. Replace all D&D implementations',
          '5. Test drag operations across all views',
        ],
      });
    }
  }

  detectReactivePatternConflicts() {
    const reactivePatterns = [];
    const patterns = {
      ref: /ref\s*\([^)]*\)/g,
      reactive: /reactive\s*\([^)]*\)/g,
      globalState: /export\s+const\s+.*=\s+(ref|reactive)\(/g,
    };

    for (const [file, content] of this.analyzed) {
      const refs = (content.match(patterns.ref) || []).length;
      const reactives = (content.match(patterns.reactive) || []).length;
      const globals = (content.match(patterns.globalState) || []).length;

      if (refs > 5 && reactives > 3) {
        reactivePatterns.push({
          file: this.relativePath(file),
          refs,
          reactives,
        });
      }
    }

    if (reactivePatterns.length > 1) {
      this.conflicts.push({
        id: 'reactive-001',
        category: 'Reactive State',
        severity: 'MEDIUM',
        type: 'Mixed reactive patterns',
        files: reactivePatterns.map(r => r.file),
        description: 'Mixed use of ref() and reactive() outside stores.',
        issues: [
          'Inconsistent state management',
          'Component local state vs store confusion',
          'Difficult to track reactive dependencies',
        ],
        recommendation: 'Use Pinia stores for shared state, ref() for component local state only.',
        effort: '2-3 hours',
        risk: 'MEDIUM',
        consolidationPath: [
          '1. Identify which state is shared vs local',
          '2. Move shared state to stores',
          '3. Keep only component-local state in components',
          '4. Remove global reactive exports',
        ],
      });
    }
  }

  detectErrorHandlingConflicts() {
    const errorHandlers = [];
    const patterns = [
      /try\s*{[\s\S]*?}\s*catch/g,
      /\.catch\s*\(/g,
      /console\.error/g,
      /toast\.error|notification\.error/g,
    ];

    for (const [file, content] of this.analyzed) {
      let count = 0;
      for (const pattern of patterns) {
        count += (content.match(pattern) || []).length;
      }
      if (count > 3) {
        errorHandlers.push({
          file: this.relativePath(file),
          errorPatterns: count,
        });
      }
    }

    if (errorHandlers.length > 2) {
      this.conflicts.push({
        id: 'errors-001',
        category: 'Error Handling',
        severity: 'MEDIUM',
        type: 'Inconsistent error handling',
        files: errorHandlers.map(e => e.file),
        description: `Found ${errorHandlers.length} files with different error handling patterns.`,
        issues: [
          'Error handling not centralized',
          'Inconsistent error messages',
          'No unified error state',
        ],
        recommendation: 'Create centralized ErrorHandler service.',
        effort: '2-3 hours',
        risk: 'LOW',
      });
    }
  }

  detectTypeConflicts() {
    const typeDefinitions = new Map();
    const typePattern = /(?:interface|type)\s+(\w+)\s*=\s*\{([^}]*)\}/g;

    for (const [file, content] of this.analyzed) {
      let match;
      while ((match = typePattern.exec(content)) !== null) {
        const typeName = match[1];
        const typeBody = match[2];
        
        if (!typeDefinitions.has(typeName)) {
          typeDefinitions.set(typeName, []);
        }
        
        typeDefinitions.get(typeName).push({
          file: this.relativePath(file),
          body: typeBody.substring(0, 100),
        });
      }
    }

    const duplicateTypes = Array.from(typeDefinitions.entries())
      .filter(([_, definitions]) => definitions.length > 1)
      .slice(0, 5);

    if (duplicateTypes.length > 0) {
      this.conflicts.push({
        id: 'types-001',
        category: 'Type Definitions',
        severity: 'MEDIUM',
        type: 'Duplicate type definitions',
        types: duplicateTypes.map(([name, defs]) => ({
          name,
          locations: defs.length,
          files: defs.map(d => d.file),
        })),
        description: `Found ${duplicateTypes.length} types defined in multiple files.`,
        issues: [
          'Type duplication',
          'Maintenance burden',
          'Risk of type mismatch',
        ],
        recommendation: 'Consolidate all types in types/models.ts',
        effort: '2 hours',
        risk: 'LOW',
      });
    }
  }

  findLineNumbers(content, pattern) {
    const lines = content.split('\n');
    const matches = [];
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(index + 1);
      }
    });
    return matches.slice(0, 3);
  }

  relativePath(fullPath) {
    return fullPath.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  generateReport() {
    console.log('📋 CONFLICT ANALYSIS REPORT');
    console.log('═'.repeat(60));
    console.log();

    if (this.conflicts.length === 0) {
      console.log('✅ No major conflicts detected!');
      return;
    }

    const sorted = this.conflicts.sort((a, b) => {
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    sorted.forEach((conflict, index) => {
      console.log(`\n${index + 1}. [${conflict.severity}] ${conflict.type}`);
      console.log(`   Category: ${conflict.category}`);
      console.log(`   ID: ${conflict.id}`);
      console.log(`   Description: ${conflict.description}`);
      console.log(`   Effort: ${conflict.effort}`);
      console.log(`   Risk: ${conflict.risk}`);
      console.log();
      console.log('   Consolidation Path:');
      conflict.consolidationPath.forEach(step => {
        console.log(`     ${step}`);
      });
      console.log();
    });

    console.log('═'.repeat(60));
    console.log(`\n📊 Summary: ${this.conflicts.length} conflicts found`);
    
    const bySeverity = {
      HIGH: this.conflicts.filter(c => c.severity === 'HIGH').length,
      MEDIUM: this.conflicts.filter(c => c.severity === 'MEDIUM').length,
      LOW: this.conflicts.filter(c => c.severity === 'LOW').length,
    };
    
    console.log(`   🔴 HIGH: ${bySeverity.HIGH}`);
    console.log(`   🟡 MEDIUM: ${bySeverity.MEDIUM}`);
    console.log(`   🟢 LOW: ${bySeverity.LOW}`);
    
    const totalEffort = this.conflicts
      .map(c => parseInt(c.effort.split('-')[0]))
      .reduce((a, b) => a + b, 0);
    
    console.log(`\n⏱️  Estimated total effort: ${totalEffort}+ hours`);
    console.log('\n✅ Export this report and prioritize HIGH severity conflicts first.\n');
  }
}

if (require.main === module) {
  const analyzer = new PomoFlowAnalyzer('./src');
  const conflicts = analyzer.analyze();
  
  fs.writeFileSync(
    'conflict-report.json',
    JSON.stringify(conflicts, null, 2)
  );
  console.log('📄 Detailed report saved to: conflict-report.json');
}

module.exports = PomoFlowAnalyzer;