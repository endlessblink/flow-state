#!/usr/bin/env node

/**
 * Comprehensive System Analyzer - Implementation
 *
 * Deep, honest, no-holds-barred system health analysis for Pomo-Flow Vue.js application
 * that tells the complete truth about system status, performance, and integrity.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class ComprehensiveSystemAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcDir = path.join(this.projectRoot, 'src');
    this.publicDir = path.join(this.projectRoot, 'public');
    this.distDir = path.join(this.projectRoot, 'dist');

    this.analysisResults = {
      timestamp: new Date().toISOString(),
      mode: 'comprehensive',
      overall: {
        healthScore: 0,
        criticalIssues: 0,
        performanceGrade: 'F',
        securityPosture: 'unknown',
        deploymentReady: false
      },
      categories: {
        application: {},
        performance: {},
        data: {},
        ui: {},
        testing: {},
        security: {},
        build: {},
        compatibility: {}
      },
      evidence: [],
      recommendations: [],
      bundleAnalysis: {},
      metrics: {}
    };
  }

  async execute(mode = 'comprehensive', focus = null) {
    console.log('🔬 Comprehensive System Analyzer - Starting Deep Analysis\n');
    console.log(`🎯 Mode: ${mode}`);
    if (focus) console.log(`🎯 Focus: ${focus}`);
    console.log('⏰ This may take several minutes...\n');

    this.analysisResults.mode = mode;

    try {
      console.log('📊 Phase 1: Core Application Health Analysis...');
      await this.analyzeApplicationHealth();

      console.log('⚡ Phase 2: Performance Metrics Analysis...');
      await this.analyzePerformance();

      console.log('🗄️ Phase 3: Data Layer Analysis...');
      await this.analyzeDataLayer();

      console.log('🎨 Phase 4: UI/UX Integrity Analysis...');
      await this.analyzeUIIntegrity();

      console.log('🧪 Phase 5: Testing Coverage Analysis...');
      await this.analyzeTestingCoverage();

      console.log('🔒 Phase 6: Security Assessment...');
      await this.analyzeSecurity();

      console.log('🚀 Phase 7: Build & Deployment Health...');
      await this.analyzeBuildHealth();

      console.log('📱 Phase 8: Cross-Platform Compatibility...');
      await this.analyzeCompatibility();

      console.log('🧮 Phase 9: Calculate Overall Health Score...');
      this.calculateOverallHealth();

      console.log('📋 Phase 10: Generate Recommendations...');
      await this.generateRecommendations();

      console.log('📄 Phase 11: Generate Reports...');
      await this.generateReports();

      console.log('\n✅ Comprehensive Analysis Complete!');
      this.displayExecutiveSummary();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async analyzeApplicationHealth() {
    const category = this.analysisResults.categories.application;

    try {
      // Vue.js Configuration Analysis
      console.log('  📄 Analyzing Vue.js configuration...');
      const viteConfig = await this.readFile('vite.config.js', 'utf8').catch(() => null);
      const vueConfig = await this.readFile('vue.config.js', 'utf8').catch(() => null);

      category.vueConfig = {
        hasViteConfig: !!viteConfig,
        hasVueConfig: !!vueConfig,
        configType: viteConfig ? 'vite' : (vueConfig ? 'vue-cli' : 'none'),
        issues: []
      };

      // Component Structure Analysis
      console.log('  🧩 Analyzing component structure...');
      const componentStats = await this.analyzeComponentStructure();
      category.components = componentStats;

      // Router Configuration
      console.log('  🛣️ Analyzing router configuration...');
      const routerConfig = await this.analyzeRouterConfig();
      category.router = routerConfig;

      // State Management Analysis
      console.log('  📦 Analyzing state management...');
      const stateManagement = await this.analyzeStateManagement();
      category.stateManagement = stateManagement;

      // Dependencies Analysis
      console.log('  📦 Analyzing dependencies...');
      const dependencies = await this.analyzeDependencies();
      category.dependencies = dependencies;

      // TypeScript Coverage
      console.log('  📝 Analyzing TypeScript coverage...');
      const typescriptAnalysis = await this.analyzeTypeScriptCoverage();
      category.typescript = typescriptAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Application Health', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeComponentStructure() {
    const componentsDir = path.join(this.srcDir, 'components');

    try {
      const components = await this.getVueComponents(componentsDir);
      const analysis = {
        totalComponents: components.length,
        averageSize: 0,
        largestComponents: [],
        compositionAPIUsage: 0,
        typeScriptUsage: 0,
        propValidationUsage: 0,
        issues: []
      };

      let totalSize = 0;
      const componentSizes = [];

      for (const component of components) {
        const content = await fs.readFile(component.path, 'utf8');
        const size = content.length;
        totalSize += size;
        componentSizes.push({ path: component.path, size, name: component.name });

        // Analyze component patterns
        if (content.includes('<script setup>')) analysis.compositionAPIUsage++;
        if (component.path.endsWith('.ts') || content.includes('lang="ts"')) analysis.typeScriptUsage++;
        if (content.includes('props:') || content.includes('defineProps')) analysis.propValidationUsage++;

        // Check for common issues
        if (size > 10000) {
          analysis.issues.push({
            type: 'large_component',
            file: component.name,
            size: this.formatFileSize(size),
            recommendation: 'Consider splitting this large component into smaller ones'
          });
        }

        if (!content.includes('<script')) {
          analysis.issues.push({
            type: 'no_script',
            file: component.name,
            recommendation: 'Add script section for proper component functionality'
          });
        }
      }

      analysis.averageSize = components.length > 0 ? totalSize / components.length : 0;
      analysis.largestComponents = componentSizes
        .sort((a, b) => b.size - a.size)
        .slice(0, 5);

      // Calculate percentages
      analysis.compositionAPIUsagePercent = components.length > 0
        ? (analysis.compositionAPIUsage / components.length) * 100
        : 0;
      analysis.typeScriptUsagePercent = components.length > 0
        ? (analysis.typeScriptUsage / components.length) * 100
        : 0;
      analysis.propValidationUsagePercent = components.length > 0
        ? (analysis.propValidationUsage / components.length) * 100
        : 0;

      return analysis;

    } catch (error) {
      return { error: error.message, totalComponents: 0 };
    }
  }

  async analyzeRouterConfig() {
    try {
      const routerPath = path.join(this.srcDir, 'router', 'index.ts');
      const routerContent = await fs.readFile(routerPath, 'utf8');

      const routeMatches = routerContent.match(/path:\s*['"]([^'"]+)['"][^}]*name:\s*['"]([^'"]+)['"]/g) || [];
      const routes = routeMatches.map(match => {
        const pathMatch = match.match(/path:\s*['"]([^'"]+)['"]/);
        const nameMatch = match.match(/name:\s*['"]([^'"]+)['"]/);
        return {
          path: pathMatch ? pathMatch[1] : 'unknown',
          name: nameMatch ? nameMatch[1] : 'unknown'
        };
      });

      return {
        totalRoutes: routes.length,
        routes: routes,
        hasDynamicRoutes: routerContent.includes(':') || routerContent.includes('*'),
        hasLazyLoading: routerContent.includes('component: () => import'),
        hasGuards: routerContent.includes('beforeEach') || routerContent.includes('beforeEnter'),
        issues: []
      };

    } catch (error) {
      return { error: error.message, totalRoutes: 0 };
    }
  }

  async analyzeStateManagement() {
    try {
      const storesDir = path.join(this.srcDir, 'stores');
      const stores = await this.getFiles(storesDir, /\.(ts|js)$/);

      const analysis = {
        totalStores: stores.length,
        hasPinia: false,
        hasVuex: false,
        stores: [],
        issues: []
      };

      let totalSize = 0;

      for (const store of stores) {
        const content = await fs.readFile(store.path, 'utf8');
        totalSize += content.length;

        const storeName = path.basename(store.path, path.extname(store.path));

        analysis.stores.push({
          name: storeName,
          size: content.length,
          hasActions: content.includes('actions:'),
          hasGetters: content.includes('getters:'),
          hasMutations: content.includes('mutations:'),
          hasState: content.includes('state:'),
          isPinia: content.includes('defineStore'),
          isVuex: content.includes('new Vuex.Store')
        });

        if (content.includes('defineStore')) analysis.hasPinia = true;
        if (content.includes('new Vuex.Store')) analysis.hasVuex = true;

        // Check for store size issues
        if (content.length > 5000) {
          analysis.issues.push({
            type: 'large_store',
            store: storeName,
            size: this.formatFileSize(content.length),
            recommendation: 'Consider splitting this large store into smaller, focused stores'
          });
        }
      }

      analysis.totalSize = totalSize;
      analysis.averageSize = stores.length > 0 ? totalSize / stores.length : 0;

      // Check for mixing state management libraries
      if (analysis.hasPinia && analysis.hasVuex) {
        analysis.issues.push({
          type: 'mixed_state_management',
          recommendation: 'Use either Pinia or Vuex, not both, to avoid confusion'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message, totalStores: 0 };
    }
  }

  async analyzeDependencies() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const analysis = {
        totalDependencies: Object.keys(allDeps).length,
        productionDependencies: Object.keys(packageJson.dependencies || {}).length,
        developmentDependencies: Object.keys(packageJson.devDependencies || {}).length,
        outdatedDependencies: [],
        vulnerableDependencies: [],
        duplicateDependencies: [],
        largeDependencies: [],
        issues: []
      };

      // Check for large dependency footprints
      try {
        const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
        for (const [name, version] of Object.entries(allDeps)) {
          const depPath = path.join(nodeModulesPath, name);
          try {
            const stats = await this.getDirectorySize(depPath);
            if (stats.size > 10 * 1024 * 1024) { // > 10MB
              analysis.largeDependencies.push({
                name,
                version,
                size: this.formatFileSize(stats.size),
                recommendation: 'Consider alternatives or tree-shaking optimization'
              });
            }
          } catch (e) {
            // Directory might not exist or be inaccessible
          }
        }
      } catch (e) {
        // node_modules might not exist
      }

      // Check for potential security issues in dependencies
      const securityConcerns = [
        { pattern: /webpack/i, issue: 'Build tool should be in devDependencies' },
        { pattern: /babel/i, issue: 'Babel packages should be in devDependencies' },
        { pattern: /eslint/i, issue: 'Linting tools should be in devDependencies' },
        { pattern: /jest/i, issue: 'Testing tools should be in devDependencies' },
        { pattern: /typescript/i, issue: 'TypeScript should be in devDependencies' }
      ];

      for (const { pattern, issue } of securityConcerns) {
        for (const [name] of Object.entries(packageJson.dependencies || {})) {
          if (pattern.test(name)) {
            analysis.issues.push({
              type: 'production_build_tool',
              dependency: name,
              issue,
              recommendation: 'Move this to devDependencies as it should not be in production bundle'
            });
          }
        }
      }

      return analysis;

    } catch (error) {
      return { error: error.message, totalDependencies: 0 };
    }
  }

  async analyzeTypeScriptCoverage() {
    try {
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      const tsconfigExists = await fs.access(tsconfigPath).then(() => true).catch(() => false);

      const analysis = {
        hasTsConfig: tsconfigExists,
        strictMode: false,
        typeCheckingEnabled: false,
        vueTypeScript: false,
        issues: []
      };

      if (tsconfigExists) {
        const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'));

        analysis.strictMode = tsconfig.compilerOptions?.strict === true;
        analysis.typeCheckingEnabled = tsconfig.compilerOptions?.noImplicitAny !== false;
        analysis.vueTypeScript = tsconfig.compilerOptions?.types?.includes('@vue/runtime-core') ||
                                 tsconfig.include?.some(pattern => pattern.includes('vue'));

        if (!analysis.strictMode) {
          analysis.issues.push({
            type: 'typescript_strict_mode',
            issue: 'Strict TypeScript mode not enabled',
            recommendation: 'Enable strict mode for better type safety'
          });
        }
      } else {
        analysis.issues.push({
          type: 'no_typescript',
          issue: 'TypeScript not configured',
          recommendation: 'Add TypeScript for better type safety and developer experience'
        });
      }

      // Check .vue files for TypeScript usage
      try {
        const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
        let vueFilesWithTS = 0;

        for (const vueFile of vueFiles) {
          const content = await fs.readFile(vueFile.path, 'utf8');
          if (content.includes('lang="ts"') || content.includes("lang='ts'")) {
            vueFilesWithTS++;
          }
        }

        analysis.vueFilesWithTypeScript = vueFilesWithTS;
        analysis.totalVueFiles = vueFiles.length;
        analysis.vueTypeScriptCoverage = vueFiles.length > 0 ? (vueFilesWithTS / vueFiles.length) * 100 : 0;

      } catch (e) {
        analysis.vueTypeScriptCoverage = 0;
      }

      return analysis;

    } catch (error) {
      return { error: error.message, hasTsConfig: false };
    }
  }

  async analyzePerformance() {
    const category = this.analysisResults.categories.performance;
    console.log('  📊 Analyzing bundle size and performance...');

    try {
      // Bundle Analysis (if dist exists)
      if (await this.directoryExists(this.distDir)) {
        const bundleAnalysis = await this.analyzeBundle();
        category.bundle = bundleAnalysis;
      } else {
        category.bundle = { error: 'No dist folder found - run build first' };
      }

      // Image Optimization
      console.log('  🖼️ Analyzing image optimization...');
      const imageAnalysis = await this.analyzeImageOptimization();
      category.images = imageAnalysis;

      // Code Splitting Analysis
      console.log('  ✂️ Analyzing code splitting...');
      const codeSplittingAnalysis = await this.analyzeCodeSplitting();
      category.codeSplitting = codeSplittingAnalysis;

      // Performance Metrics (simulated)
      category.metrics = this.simulatePerformanceMetrics();

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Performance Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeBundle() {
    try {
      const distFiles = await this.getFiles(this.distDir);
      const jsFiles = distFiles.filter(f => f.name.endsWith('.js'));
      const cssFiles = distFiles.filter(f => f.name.endsWith('.css'));
      const assetFiles = distFiles.filter(f =>
        f.name.endsWith('.png') || f.name.endsWith('.jpg') ||
        f.name.endsWith('.jpeg') || f.name.endsWith('.gif') ||
        f.name.endsWith('.svg') || f.name.endsWith('.webp')
      );

      let totalSize = 0;
      let jsSize = 0;
      let cssSize = 0;
      let assetSize = 0;

      const files = [];

      for (const file of distFiles) {
        const stats = await fs.stat(file.path);
        const size = stats.size;
        totalSize += size;

        files.push({
          name: file.name,
          size: this.formatFileSize(size),
          path: file.path
        });

        if (file.name.endsWith('.js')) jsSize += size;
        else if (file.name.endsWith('.css')) cssSize += size;
        else if (assetFiles.some(f => f.name === file.name)) assetSize += size;
      }

      const analysis = {
        totalSize: this.formatFileSize(totalSize),
        jsSize: this.formatFileSize(jsSize),
        cssSize: this.formatFileSize(cssSize),
        assetSize: this.formatFileSize(assetSize),
        totalFiles: distFiles.length,
        jsFiles: jsFiles.length,
        cssFiles: cssFiles.length,
        assetFiles: assetFiles.length,
        largestFiles: files.sort((a, b) =>
          this.parseFileSize(b.size) - this.parseFileSize(a.size)
        ).slice(0, 10),
        issues: []
      };

      // Performance recommendations based on bundle size
      if (totalSize > 5 * 1024 * 1024) { // > 5MB
        analysis.issues.push({
          type: 'large_bundle',
          size: analysis.totalSize,
          impact: 'Slow initial load, poor user experience',
          recommendation: 'Implement code splitting and remove unused dependencies'
        });
      }

      if (jsSize > 2 * 1024 * 1024) { // > 2MB JS
        analysis.issues.push({
          type: 'large_js_bundle',
          size: analysis.jsSize,
          impact: 'Long JavaScript parsing and execution time',
          recommendation: 'Implement lazy loading and code splitting'
        });
      }

      // Check for large individual files
      for (const file of files.slice(0, 5)) {
        const size = this.parseFileSize(file.size);
        if (size > 1024 * 1024) { // > 1MB
          analysis.issues.push({
            type: 'large_file',
            file: file.name,
            size: file.size,
            impact: 'Blocks critical rendering path',
            recommendation: 'Split this file or implement better loading strategy'
          });
        }
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeImageOptimization() {
    try {
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      const imageFiles = [];

      // Search for images in public and src directories
      const searchDirs = [this.publicDir, this.srcDir];

      for (const dir of searchDirs) {
        if (await this.directoryExists(dir)) {
          const files = await this.getFiles(dir, new RegExp(`(${imageExtensions.join('|')})$`, 'i'));
          imageFiles.push(...files);
        }
      }

      const analysis = {
        totalImages: imageFiles.length,
        unoptimizedImages: [],
        largeImages: [],
        wrongFormatImages: [],
        totalSize: 0,
        issues: []
      };

      let totalSize = 0;

      for (const imageFile of imageFiles) {
        const stats = await fs.stat(imageFile.path);
        const size = stats.size;
        totalSize += size;

        const ext = path.extname(imageFile.name).toLowerCase();
        const sizeKB = Math.round(size / 1024);

        // Check for large images
        if (sizeKB > 500) { // > 500KB
          analysis.largeImages.push({
            file: imageFile.name,
            size: this.formatFileSize(size),
            recommendation: 'Compress this image or use a more efficient format'
          });
        }

        // Check for unoptimized formats
        if (ext === '.png' && !imageFile.name.includes('-logo') && !imageFile.name.includes('-icon')) {
          // PNG for non-transparent images
          analysis.wrongFormatImages.push({
            file: imageFile.name,
            currentFormat: 'PNG',
            recommendation: 'Consider WebP or JPEG for better compression'
          });
        }

        if (ext === '.jpg' || ext === '.jpeg') {
          analysis.unoptimizedImages.push({
            file: imageFile.name,
            size: this.formatFileSize(size),
            recommendation: 'Consider WebP format for better compression'
          });
        }
      }

      analysis.totalSize = this.formatFileSize(totalSize);

      if (analysis.largeImages.length > 0) {
        analysis.issues.push({
          type: 'large_images',
          count: analysis.largeImages.length,
          impact: 'Slow page load, especially on mobile',
          recommendation: 'Compress images and use modern formats'
        });
      }

      if (analysis.totalImages > 50) {
        analysis.issues.push({
          type: 'too_many_images',
          count: analysis.totalImages,
          impact: 'Increased bundle size and HTTP requests',
          recommendation: 'Consider image sprites or lazy loading'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message, totalImages: 0 };
    }
  }

  async analyzeCodeSplitting() {
    try {
      const viteConfig = await this.readFile('vite.config.js', 'utf8').catch(() => null);

      const analysis = {
        hasManualChunks: false,
        hasDynamicImports: false,
        hasLazyLoading: false,
        splittingStrategies: [],
        issues: []
      };

      if (viteConfig) {
        analysis.hasManualChunks = viteConfig.includes('manualChunks');
        analysis.hasDynamicImports = viteConfig.includes('import(');
        analysis.hasLazyLoading = viteConfig.includes('() => import');
      }

      // Check for dynamic imports in source code
      try {
        const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js|vue)$/);
        let dynamicImportCount = 0;

        for (const file of sourceFiles) {
          const content = await fs.readFile(file.path, 'utf8');
          if (content.includes('import(') || content.includes('() => import')) {
            dynamicImportCount++;
          }
        }

        analysis.dynamicImportsInSource = dynamicImportCount;
        analysis.hasDynamicImportsInSource = dynamicImportCount > 0;

      } catch (e) {
        analysis.dynamicImportsInSource = 0;
      }

      // Recommendations
      if (!analysis.hasManualChunks && !analysis.hasDynamicImports) {
        analysis.issues.push({
          type: 'no_code_splitting',
          issue: 'No code splitting detected',
          impact: 'Large initial bundle size',
          recommendation: 'Implement manual chunks or dynamic imports'
        });
      }

      if (!analysis.hasLazyLoading) {
        analysis.issues.push({
          type: 'no_lazy_loading',
          issue: 'No lazy loading detected',
          impact: 'Slower initial page load',
          recommendation: 'Implement lazy loading for routes and components'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  simulatePerformanceMetrics() {
    // These would normally come from Lighthouse or real performance monitoring
    // For now, we'll provide realistic estimates based on analysis

    const bundleSize = this.analysisResults.categories.performance.bundle?.totalSize || '1MB';
    const bundleSizeMB = this.parseFileSize(bundleSize) / (1024 * 1024);

    // Simulate metrics based on bundle size and other factors
    const fcp = Math.min(800 + (bundleSizeMB * 500), 3000); // 800ms - 3000ms
    const lcp = Math.min(1200 + (bundleSizeMB * 800), 5000); // 1.2s - 5s
    const tti = Math.min(1500 + (bundleSizeMB * 1000), 8000); // 1.5s - 8s
    const cls = Math.min(0.05 + (bundleSizeMB * 0.02), 0.25); // 0.05 - 0.25

    return {
      firstContentfulPaint: `${Math.round(fcp)}ms`,
      largestContentfulPaint: `${Math.round(lcp)}ms`,
      timeToInteractive: `${Math.round(tti)}ms`,
      cumulativeLayoutShift: cls.toFixed(3),
      performanceGrade: this.calculatePerformanceGrade(fcp, lcp, tti, cls)
    };
  }

  calculatePerformanceGrade(fcp, lcp, tti, cls) {
    let score = 100;

    // FCP scoring
    if (fcp > 4000) score -= 25;
    else if (fcp > 2500) score -= 15;
    else if (fcp > 1800) score -= 5;

    // LCP scoring
    if (lcp > 4000) score -= 25;
    else if (lcp > 2500) score -= 15;
    else if (lcp > 1800) score -= 5;

    // TTI scoring
    if (tti > 7300) score -= 25;
    else if (tti > 3800) score -= 15;
    else if (tti > 1900) score -= 5;

    // CLS scoring
    if (cls > 0.25) score -= 25;
    else if (cls > 0.1) score -= 15;
    else if (cls > 0.05) score -= 5;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async analyzeDataLayer() {
    const category = this.analysisResults.categories.data;
    console.log('  🗄️ Analyzing data layer integrity...');

    try {
      // IndexedDB Analysis
      const indexedDBAnalysis = await this.analyzeIndexedDB();
      category.indexedDB = indexedDBAnalysis;

      // Store Synchronization Analysis
      const syncAnalysis = await this.analyzeStoreSynchronization();
      category.synchronization = syncAnalysis;

      // Data Model Analysis
      const dataModelAnalysis = await this.analyzeDataModel();
      category.dataModel = dataModelAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Data Layer Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeIndexedDB() {
    try {
      // Look for IndexedDB usage patterns in the codebase
      const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js)$/);

      let indexedDBUsage = 0;
      let localForageUsage = 0;
      let dbOperations = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file.path, 'utf8');

        if (content.includes('indexedDB') || content.includes('IndexedDB')) {
          indexedDBUsage++;
        }

        if (content.includes('localforage') || content.includes('localForage')) {
          localForageUsage++;
        }

        // Look for database operations
        const operations = ['getItem', 'setItem', 'removeItem', 'clear'];
        for (const op of operations) {
          if (content.includes(op)) {
            dbOperations.push({
              file: file.name,
              operation: op,
              location: file.path
            });
          }
        }
      }

      const analysis = {
        usesIndexedDB: indexedDBUsage > 0,
        usesLocalForage: localForageUsage > 0,
        totalFilesWithDB: indexedDBUsage + localForageUsage,
        databaseOperations: dbOperations,
        issues: []
      };

      if (!analysis.usesIndexedDB && !analysis.usesLocalForage) {
        analysis.issues.push({
          type: 'no_persistence',
          issue: 'No data persistence mechanism found',
          recommendation: 'Implement IndexedDB or LocalForage for data persistence'
        });
      }

      if (indexedDBUsage > 0 && localForageUsage > 0) {
        analysis.issues.push({
          type: 'mixed_storage',
          issue: 'Both IndexedDB and LocalForage detected',
          recommendation: 'Standardize on one storage solution'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeStoreSynchronization() {
    try {
      const storesDir = path.join(this.srcDir, 'stores');
      const stores = await this.getFiles(storesDir, /\.(ts|js)$/);

      const analysis = {
        hasSynchronization: false,
        syncStrategies: [],
        potentialRaceConditions: [],
        issues: []
      };

      for (const store of stores) {
        const content = await fs.readFile(store.path, 'utf8');
        const storeName = path.basename(store.path, path.extname(store.path));

        // Look for sync patterns
        if (content.includes('sync') || content.includes('watch') || content.includes('subscribe')) {
          analysis.hasSynchronization = true;

          if (content.includes('watchEffect') || content.includes('watch(')) {
            analysis.syncStrategies.push({
              store: storeName,
              strategy: 'vue_reactivity',
              description: 'Uses Vue reactivity for synchronization'
            });
          }

          if (content.includes('addEventListener') || content.includes('on(')) {
            analysis.syncStrategies.push({
              store: storeName,
              strategy: 'event_listeners',
              description: 'Uses event listeners for synchronization'
            });
          }
        }

        // Look for potential race conditions
        if (content.includes('setTimeout') || content.includes('setInterval')) {
          analysis.potentialRaceConditions.push({
            store: storeName,
            issue: 'Async operations detected',
            recommendation: 'Review for potential race conditions'
          });
        }

        // Look for unhandled promises
        if (content.includes('.then(') && !content.includes('.catch(') && !content.includes('try')) {
          analysis.issues.push({
            type: 'unhandled_promises',
            store: storeName,
            issue: 'Potential unhandled promise rejections',
            recommendation: 'Add proper error handling for async operations'
          });
        }
      }

      if (!analysis.hasSynchronization && stores.length > 1) {
        analysis.issues.push({
          type: 'no_synchronization',
          issue: 'Multiple stores without synchronization strategy',
          recommendation: 'Implement store synchronization to prevent data inconsistencies'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeDataModel() {
    try {
      const typeDefinitionFiles = await this.getFiles(this.srcDir, /\.(d\.ts|types\.ts|interface\.ts)$/);
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);

      const analysis = {
        hasTypeDefinitions: typeDefinitionFiles.length > 0,
        typeDefinitionFiles: typeDefinitionFiles.map(f => f.name),
        hasConsistentModels: true,
        modelInconsistencies: [],
        totalModels: 0,
        issues: []
      };

      // Look for interface/type definitions
      let totalInterfaces = 0;
      let totalTypes = 0;

      for (const typeFile of typeDefinitionFiles) {
        const content = await fs.readFile(typeFile.path, 'utf8');

        const interfaces = content.match(/interface\s+\w+/g) || [];
        const types = content.match(/type\s+\w+/g) || [];

        totalInterfaces += interfaces.length;
        totalTypes += types.length;
      }

      analysis.totalInterfaces = totalInterfaces;
      analysis.totalTypes = totalTypes;
      analysis.totalModels = totalInterfaces + totalTypes;

      // Look for data models in stores
      const storesDir = path.join(this.srcDir, 'stores');
      const stores = await this.getFiles(storesDir, /\.(ts|js)$/);

      for (const store of stores) {
        const content = await fs.readFile(store.path, 'utf8');

        // Look for model definitions
        const modelMatches = content.match(/(interface|type)\s+\w+/g) || [];
        if (modelMatches.length > 0) {
          analysis.totalModels += modelMatches.length;
        }
      }

      if (analysis.totalModels === 0) {
        analysis.issues.push({
          type: 'no_data_models',
          issue: 'No formal data model definitions found',
          recommendation: 'Define TypeScript interfaces/types for data structures'
        });
        analysis.hasConsistentModels = false;
      }

      if (typeDefinitionFiles.length === 0 && vueFiles.length > 5) {
        analysis.issues.push({
          type: 'typeless_models',
          issue: 'Complex application without type definitions',
          recommendation: 'Add TypeScript type definitions for better type safety'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeUIIntegrity() {
    const category = this.analysisResults.categories.ui;
    console.log('  🎨 Analyzing UI/UX integrity...');

    try {
      // Component Consistency
      const consistencyAnalysis = await this.analyzeComponentConsistency();
      category.consistency = consistencyAnalysis;

      // Accessibility Analysis
      const accessibilityAnalysis = await this.analyzeAccessibility();
      category.accessibility = accessibilityAnalysis;

      // Design System Compliance
      const designSystemAnalysis = await this.analyzeDesignSystemCompliance();
      category.designSystem = designSystemAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('UI/UX Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeComponentConsistency() {
    try {
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);

      const analysis = {
        totalComponents: vueFiles.length,
        componentsWithStyles: 0,
        componentsWithScopedStyles: 0,
        componentsWithCSSClasses: 0,
        inconsistentPatterns: [],
        issues: []
      };

      const classUsagePatterns = new Map();
      const stylePatterns = new Map();

      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');

        // Check for style sections
        if (content.includes('<style')) {
          analysis.componentsWithStyles++;
        }

        if (content.includes('scoped')) {
          analysis.componentsWithScopedStyles++;
        }

        // Extract class names from template
        const classMatches = content.match(/class="([^"]+)"/g) || [];
        for (const match of classMatches) {
          const classes = match.replace(/class="([^"]+)"/, '$1').split(' ');
          for (const className of classes) {
            classUsagePatterns.set(className, (classUsagePatterns.get(className) || 0) + 1);
          }
        }

        if (classMatches.length > 0) {
          analysis.componentsWithCSSClasses++;
        }

        // Look for inconsistent patterns
        if (content.includes('style=')) {
          analysis.inconsistentPatterns.push({
            component: vueFile.name,
            issue: 'Inline styles detected',
            recommendation: 'Use CSS classes instead of inline styles'
          });
        }
      }

      // Find rarely used classes (potential inconsistencies)
      const rareClasses = Array.from(classUsagePatterns.entries())
        .filter(([count]) => count === 1)
        .map(([className]) => className);

      if (rareClasses.length > 10) {
        analysis.issues.push({
          type: 'inconsistent_classes',
          count: rareClasses.length,
          examples: rareClasses.slice(0, 5),
          recommendation: 'Review unique class names for potential inconsistencies'
        });
      }

      if (analysis.componentsWithStyles > 0 && analysis.componentsWithScopedStyles === 0) {
        analysis.issues.push({
          type: 'no_scoped_styles',
          issue: 'Components use styles but none are scoped',
          recommendation: 'Add scoped attribute to style sections to prevent style leakage'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeAccessibility() {
    try {
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);

      const analysis = {
        totalComponents: vueFiles.length,
        componentsWithARIA: 0,
        componentsWithAltText: 0,
        componentsWithSemanticHTML: 0,
        accessibilityIssues: [],
        score: 0
      };

      let accessibilityScore = 0;
      const maxScore = vueFiles.length * 4; // max 4 points per component

      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');
        let componentScore = 0;

        // Check for ARIA attributes
        if (content.includes('aria-') || content.includes('role=')) {
          analysis.componentsWithARIA++;
          componentScore++;
        }

        // Check for alt text on images
        if (content.includes('<img') && content.includes('alt=')) {
          analysis.componentsWithAltText++;
          componentScore++;
        } else if (content.includes('<img') && !content.includes('alt=')) {
          analysis.accessibilityIssues.push({
            component: vueFile.name,
            issue: 'Image without alt text',
            recommendation: 'Add descriptive alt text to all images'
          });
        }

        // Check for semantic HTML
        const semanticTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
        const hasSemanticTags = semanticTags.some(tag =>
          content.includes(`<${tag}`) || content.includes(`</${tag}>`)
        );

        if (hasSemanticTags) {
          analysis.componentsWithSemanticHTML++;
          componentScore++;
        }

        // Check for form accessibility
        if (content.includes('<input') || content.includes('<button')) {
          if (content.includes('label') || content.includes('aria-label')) {
            componentScore++;
          } else {
            analysis.accessibilityIssues.push({
              component: vueFile.name,
              issue: 'Form elements without proper labels',
              recommendation: 'Add labels or aria-label attributes to form elements'
            });
          }
        }

        accessibilityScore += componentScore;
      }

      analysis.score = maxScore > 0 ? Math.round((accessibilityScore / maxScore) * 100) : 0;

      if (analysis.score < 50) {
        analysis.issues.push({
          type: 'poor_accessibility',
          score: analysis.score,
          recommendation: 'Improve accessibility by adding ARIA attributes, semantic HTML, and proper labels'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeDesignSystemCompliance() {
    try {
      const analysis = {
        hasDesignTokens: false,
        hasCSSVariables: false,
        hasTailwind: false,
        hasCustomCSS: false,
        inconsistentColors: [],
        inconsistentSpacing: [],
        issues: []
      };

      // Check for design tokens
      const tokensFile = path.join(this.srcDir, 'assets', 'design-tokens.css');
      if (await this.fileExists(tokensFile)) {
        analysis.hasDesignTokens = true;
      }

      // Check for CSS variables
      const cssFiles = await this.getFiles(this.srcDir, /\.css$/);
      for (const cssFile of cssFiles) {
        const content = await fs.readFile(cssFile.path, 'utf8');
        if (content.includes('--')) {
          analysis.hasCSSVariables = true;
          break;
        }
      }

      // Check for Tailwind
      const tailwindConfig = await this.readFile('tailwind.config.js', 'utf8').catch(() => null);
      if (tailwindConfig) {
        analysis.hasTailwind = true;
      }

      // Check for custom CSS (potential inconsistencies)
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
      const hardcodedColors = new Set();
      const hardcodedSpacing = new Set();

      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');

        // Look for hardcoded colors
        const colorMatches = content.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g) || [];
        for (const color of colorMatches) {
          hardcodedColors.add(color);
        }

        // Look for hardcoded spacing
        const spacingMatches = content.match(/(width|height|margin|padding):\s*\d+px/g) || [];
        for (const spacing of spacingMatches) {
          hardcodedSpacing.add(spacing);
        }
      }

      analysis.inconsistentColors = Array.from(hardcodedColors);
      analysis.inconsistentSpacing = Array.from(hardcodedSpacing);
      analysis.hasCustomCSS = hardcodedColors.size > 0 || hardcodedSpacing.size > 0;

      if (hardcodedColors.size > 5) {
        analysis.issues.push({
          type: 'hardcoded_colors',
          count: hardcodedColors.size,
          examples: Array.from(hardcodedColors).slice(0, 5),
          recommendation: 'Use design tokens or CSS variables for consistent colors'
        });
      }

      if (hardcodedSpacing.size > 10) {
        analysis.issues.push({
          type: 'hardcoded_spacing',
          count: hardcodedSpacing.size,
          examples: Array.from(hardcodedSpacing).slice(0, 3),
          recommendation: 'Use spacing scale or design tokens for consistent spacing'
        });
      }

      if (!analysis.hasDesignTokens && !analysis.hasCSSVariables && !analysis.hasTailwind) {
        analysis.issues.push({
          type: 'no_design_system',
          issue: 'No design system detected',
          recommendation: 'Implement design tokens, CSS variables, or a utility-first framework'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeTestingCoverage() {
    const category = this.analysisResults.categories.testing;
    console.log('  🧪 Analyzing testing coverage...');

    try {
      // Test Files Analysis
      const testAnalysis = await this.analyzeTestFiles();
      category.testFiles = testAnalysis;

      // Test Framework Analysis
      const frameworkAnalysis = await this.analyzeTestFrameworks();
      category.frameworks = frameworkAnalysis;

      // Coverage Analysis (if coverage reports exist)
      const coverageAnalysis = await this.analyzeTestCoverage();
      category.coverage = coverageAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Testing Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeTestFiles() {
    try {
      const testDirs = ['tests', 'test', '__tests__', 'specs'];
      const testFiles = [];

      for (const testDir of testDirs) {
        const testPath = path.join(this.projectRoot, testDir);
        if (await this.directoryExists(testPath)) {
          const files = await this.getFiles(testPath);
          testFiles.push(...files.filter(f =>
            f.name.endsWith('.test.js') || f.name.endsWith('.test.ts') ||
            f.name.endsWith('.spec.js') || f.name.endsWith('.spec.ts')
          ));
        }
      }

      // Also look for test files in src directory
      const srcTestFiles = await this.getFiles(this.srcDir, /\.(test|spec)\.(js|ts)$/);
      testFiles.push(...srcTestFiles);

      const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js|vue)$/);

      const analysis = {
        totalTestFiles: testFiles.length,
        totalSourceFiles: sourceFiles.length,
        testCoverage: sourceFiles.length > 0 ? (testFiles.length / sourceFiles.length) * 100 : 0,
        testTypes: {
          unit: 0,
          integration: 0,
          e2e: 0
        },
        largestTestFiles: [],
        outdatedTestFiles: [],
        issues: []
      };

      // Analyze test file characteristics
      for (const testFile of testFiles) {
        const content = await fs.readFile(testFile.path, 'utf8');
        const stats = await fs.stat(testFile.path);

        // Classify test type
        if (testFile.path.includes('e2e') || content.includes('playwright') || content.includes('cypress')) {
          analysis.testTypes.e2e++;
        } else if (content.includes('mount') || content.includes('shallowMount') || content.includes('render')) {
          analysis.testTypes.unit++;
        } else {
          analysis.testTypes.integration++;
        }

        // Check for large test files
        if (stats.size > 10000) { // > 10KB
          analysis.largestTestFiles.push({
            name: testFile.name,
            size: this.formatFileSize(stats.size),
            lines: content.split('\n').length
          });
        }
      }

      // Coverage recommendations
      if (analysis.testCoverage < 20) {
        analysis.issues.push({
          type: 'low_test_coverage',
          coverage: `${analysis.testCoverage.toFixed(1)}%`,
          recommendation: 'Add more test files to improve coverage'
        });
      }

      if (analysis.totalTestFiles === 0) {
        analysis.issues.push({
          type: 'no_tests',
          issue: 'No test files found',
          recommendation: 'Set up a testing framework and write tests for critical functionality'
        });
      }

      if (analysis.testTypes.unit === 0) {
        analysis.issues.push({
          type: 'no_unit_tests',
          issue: 'No unit tests found',
          recommendation: 'Add unit tests for individual components and functions'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeTestFrameworks() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const frameworks = {
        vitest: allDeps.vitest || allDeps['@vitest'],
        jest: allDeps.jest || allDeps['@jest'],
        mocha: allDeps.mocha,
        jasmine: allDeps.jasmine,
        playwright: allDeps.playwright || allDeps['@playwright'],
        cypress: allDeps.cypress,
        testingLibrary: allDeps['@testing-library/vue'] || allDeps['@vue/test-utils']
      };

      const analysis = {
        hasTestFramework: false,
        primaryFramework: null,
        supportedFrameworks: [],
        hasE2EFramework: false,
        hasUnitFramework: false,
        frameworkConfiguration: {},
        issues: []
      };

      // Identify test frameworks
      for (const [framework, version] of Object.entries(frameworks)) {
        if (version) {
          analysis.supportedFrameworks.push({ framework, version });

          if (!analysis.hasTestFramework) {
            analysis.hasTestFramework = true;
            analysis.primaryFramework = framework;
          }

          if (['playwright', 'cypress'].includes(framework)) {
            analysis.hasE2EFramework = true;
          }

          if (['vitest', 'jest', 'mocha', 'jasmine'].includes(framework)) {
            analysis.hasUnitFramework = true;
          }
        }
      }

      // Check configuration files
      const configFiles = {
        vitest: 'vitest.config.js',
        jest: 'jest.config.js',
        playwright: 'playwright.config.js',
        cypress: 'cypress.config.js'
      };

      for (const [framework, configFile] of Object.entries(configFiles)) {
        if (await this.fileExists(configFile)) {
          analysis.frameworkConfiguration[framework] = configFile;
        }
      }

      if (!analysis.hasTestFramework) {
        analysis.issues.push({
          type: 'no_test_framework',
          issue: 'No testing framework installed',
          recommendation: 'Install a testing framework like Vitest for unit testing'
        });
      }

      if (analysis.hasUnitFramework && !analysis.frameworkConfiguration[analysis.primaryFramework]) {
        analysis.issues.push({
          type: 'no_test_config',
          framework: analysis.primaryFramework,
          recommendation: 'Create a configuration file for your test framework'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeTestCoverage() {
    try {
      const coverageDir = path.join(this.projectRoot, 'coverage');
      const analysis = {
        hasCoverageReport: false,
        coverageFiles: [],
        overallCoverage: 0,
        coverageByType: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0
        },
        uncoveredFiles: [],
        issues: []
      };

      if (await this.directoryExists(coverageDir)) {
        analysis.hasCoverageReport = true;
        const coverageFiles = await this.getFiles(coverageDir);

        // Look for coverage summary files
        const summaryFiles = coverageFiles.filter(f =>
          f.name.includes('summary') || f.name.includes('coverage-final')
        );

        for (const summaryFile of summaryFiles) {
          if (summaryFile.name.endsWith('.json')) {
            try {
              const coverageData = JSON.parse(await fs.readFile(summaryFile.path, 'utf8'));

              if (coverageData.total) {
                analysis.overallCoverage = coverageData.total.lines?.pct || 0;
                analysis.coverageByType = {
                  lines: coverageData.total.lines?.pct || 0,
                  functions: coverageData.total.functions?.pct || 0,
                  branches: coverageData.total.branches?.pct || 0,
                  statements: coverageData.total.statements?.pct || 0
                };

                // Find uncovered files
                for (const [filename, fileData] of Object.entries(coverageData)) {
                  if (fileData.lines?.pct === 0) {
                    analysis.uncoveredFiles.push(filename);
                  }
                }
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }

        analysis.coverageFiles = summaryFiles;
      }

      if (analysis.hasTestFramework && !analysis.hasCoverageReport) {
        analysis.issues.push({
          type: 'no_coverage_report',
          issue: 'Test framework found but no coverage reports',
          recommendation: 'Configure coverage reporting in your test framework'
        });
      }

      if (analysis.overallCoverage < 50) {
        analysis.issues.push({
          type: 'low_coverage',
          coverage: `${analysis.overallCoverage}%`,
          recommendation: 'Improve test coverage by adding tests for uncovered code paths'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeSecurity() {
    const category = this.analysisResults.categories.security;
    console.log('  🔒 Analyzing security posture...');

    try {
      // Dependency Vulnerability Scan
      const dependencyAnalysis = await this.analyzeDependencyVulnerabilities();
      category.dependencies = dependencyAnalysis;

      // Code Security Analysis
      const codeAnalysis = await this.analyzeCodeSecurity();
      category.code = codeAnalysis;

      // Data Exposure Analysis
      const dataExposureAnalysis = await this.analyzeDataExposure();
      category.dataExposure = dataExposureAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Security Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeDependencyVulnerabilities() {
    try {
      // This would normally run `npm audit` or a similar security audit
      // For now, we'll analyze based on known patterns

      const analysis = {
        totalDependencies: 0,
        vulnerabilities: [],
        riskLevel: 'unknown',
        outdatedPackages: [],
        issues: []
      };

      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      analysis.totalDependencies = Object.keys(allDeps).length;

      // Check for known vulnerable patterns (simplified)
      const riskyPackages = [
        { name: 'axios', versions: '<1.0.0', issue: 'Potential SSRF vulnerabilities' },
        { name: 'lodash', versions: '<4.17.21', issue: 'Prototype pollution' },
        { name: 'request', versions: '*', issue: 'Deprecated, has security issues' }
      ];

      for (const dep of Object.keys(allDeps)) {
        const version = allDeps[dep];

        for (const risky of riskyPackages) {
          if (dep === risky.name) {
            analysis.vulnerabilities.push({
              package: dep,
              version,
              severity: 'high',
              issue: risky.issue,
              recommendation: `Update to latest version`
            });
          }
        }

        // Check for very old versions
        const versionMatch = version.match(/^\^?(\d+)\./);
        if (versionMatch && parseInt(versionMatch[1]) < 1) {
          analysis.outdatedPackages.push({
            package: dep,
            version,
            recommendation: 'Consider updating to a more recent version'
          });
        }
      }

      // Determine risk level
      if (analysis.vulnerabilities.length === 0) {
        analysis.riskLevel = 'low';
      } else if (analysis.vulnerabilities.some(v => v.severity === 'high')) {
        analysis.riskLevel = 'high';
      } else {
        analysis.riskLevel = 'medium';
      }

      if (analysis.vulnerabilities.length > 0) {
        analysis.issues.push({
          type: 'security_vulnerabilities',
          count: analysis.vulnerabilities.length,
          riskLevel: analysis.riskLevel,
          recommendation: 'Update vulnerable packages immediately'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeCodeSecurity() {
    try {
      const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js|vue)$/);

      const analysis = {
        totalFiles: sourceFiles.length,
        securePatterns: 0,
        insecurePatterns: [],
        sensitiveDataExposure: [],
        issues: []
      };

      const securePatterns = [
        'input validation',
        'output encoding',
        'https://',
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-XSS-Protection'
      ];

      const insecurePatterns = [
        { pattern: /eval\s*\(/, issue: 'Use of eval() function', severity: 'high' },
        { pattern: /innerHTML\s*=/, issue: 'Direct innerHTML assignment', severity: 'medium' },
        { pattern: /document\.write/, issue: 'Use of document.write()', severity: 'medium' },
        { pattern: /http:\/\//, issue: 'Non-secure HTTP URL', severity: 'low' },
        { pattern: /console\.log/, issue: 'Console logging in production', severity: 'low' }
      ];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file.path, 'utf8');

        // Check for secure patterns
        for (const pattern of securePatterns) {
          if (content.toLowerCase().includes(pattern.toLowerCase())) {
            analysis.securePatterns++;
          }
        }

        // Check for insecure patterns
        for (const { pattern, issue, severity } of insecurePatterns) {
          const matches = content.match(pattern);
          if (matches) {
            analysis.insecurePatterns.push({
              file: file.name,
              pattern: issue,
              matches: matches.length,
              severity,
              lineNumbers: this.findLineNumbers(content, pattern)
            });
          }
        }

        // Check for sensitive data exposure
        const sensitivePatterns = [
          /password\s*=\s*['"][^'"]+['"]/,
          /api[_-]?key\s*=\s*['"][^'"]+['"]/,
          /secret\s*=\s*['"][^'"]+['"]/,
          /token\s*=\s*['"][^'"]+['"]/
        ];

        for (const pattern of sensitivePatterns) {
          const matches = content.match(pattern);
          if (matches) {
            analysis.sensitiveDataExposure.push({
              file: file.name,
              issue: 'Potential sensitive data hardcoding',
              matches: matches.length,
              recommendation: 'Move sensitive data to environment variables'
            });
          }
        }
      }

      // High severity issues are critical
      const highSeverityIssues = analysis.insecurePatterns.filter(p => p.severity === 'high');
      if (highSeverityIssues.length > 0) {
        analysis.issues.push({
          type: 'high_severity_security',
          count: highSeverityIssues.length,
          recommendation: 'Fix high-severity security issues immediately'
        });
      }

      if (analysis.sensitiveDataExposure.length > 0) {
        analysis.issues.push({
          type: 'sensitive_data_exposure',
          count: analysis.sensitiveDataExposure.length,
          recommendation: 'Remove hardcoded sensitive data and use environment variables'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeDataExposure() {
    try {
      const analysis = {
        hasEnvFiles: false,
        hasGitignore: false,
        exposedAPIKeys: [],
        exposedCredentials: [],
        publicDataFiles: [],
        issues: []
      };

      // Check for environment files
      const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
      for (const envFile of envFiles) {
        if (await this.fileExists(envFile)) {
          analysis.hasEnvFiles = true;

          // Check if .env files are properly ignored
          const gitignoreContent = await this.readFile('.gitignore', 'utf8').catch(() => '');
          if (!gitignoreContent.includes('.env')) {
            analysis.issues.push({
              type: 'env_not_gitignored',
              file: envFile,
              recommendation: 'Add .env files to .gitignore to prevent credential exposure'
            });
          }
        }
      }

      // Check for .gitignore
      analysis.hasGitignore = await this.fileExists('.gitignore');

      // Check public directory for sensitive data
      if (await this.directoryExists(this.publicDir)) {
        const publicFiles = await this.getFiles(this.publicDir);

        for (const file of publicFiles) {
          if (file.name.includes('config') || file.name.includes('api') || file.name.includes('key')) {
            analysis.publicDataFiles.push({
              file: file.name,
              risk: 'Potentially sensitive data in public directory',
              recommendation: 'Review if this file should be public'
            });
          }
        }
      }

      // Check for hardcoded credentials in source code
      const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js|vue)$/);

      for (const file of sourceFiles) {
        const content = await fs.readFile(file.path, 'utf8');

        // Look for credential patterns
        const credentialPatterns = [
          /sk_[a-zA-Z0-9]+/, // Stripe keys
          /ghp_[a-zA-Z0-9]+/, // GitHub personal access tokens
          /gho_[a-zA-Z0-9]+/, // GitHub OAuth tokens
          /ghu_[a-zA-Z0-9]+/, // GitHub user tokens
          /ghs_[a-zA-Z0-9]+/, // GitHub server tokens
          /ghr_[a-zA-Z0-9]+/, // GitHub refresh tokens
          /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Slack bot tokens
          /xoxp-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Slack user tokens
        ];

        for (const pattern of credentialPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            analysis.exposedCredentials.push({
              file: file.name,
              type: 'API token or key detected',
              count: matches.length,
              severity: 'critical',
              recommendation: 'Remove hardcoded credentials immediately'
            });
          }
        }
      }

      if (analysis.exposedCredentials.length > 0) {
        this.addCriticalIssue('Security', `Exposed credentials found in ${analysis.exposedCredentials.length} files`);
      }

      if (!analysis.hasGitignore) {
        analysis.issues.push({
          type: 'no_gitignore',
          recommendation: 'Create a .gitignore file to prevent sensitive data exposure'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeBuildHealth() {
    const category = this.analysisResults.categories.build;
    console.log('  🚀 Analyzing build and deployment health...');

    try {
      // Build Configuration Analysis
      const buildConfigAnalysis = await this.analyzeBuildConfiguration();
      category.configuration = buildConfigAnalysis;

      // Build Process Analysis
      const buildProcessAnalysis = await this.analyzeBuildProcess();
      category.process = buildProcessAnalysis;

      // Deployment Readiness
      const deploymentAnalysis = await this.analyzeDeploymentReadiness();
      category.deployment = deploymentAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Build Health Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeBuildConfiguration() {
    try {
      const viteConfig = await this.readFile('vite.config.js', 'utf8').catch(() => null);
      const vueConfig = await this.readFile('vue.config.js', 'utf8').catch(() => null);

      const analysis = {
        buildTool: viteConfig ? 'vite' : (vueConfig ? 'vue-cli' : 'none'),
        hasProductionConfig: false,
        hasOptimizationConfig: false,
        hasSourceMapsConfigured: false,
        hasBundleAnalysis: false,
        configurationIssues: [],
        optimizationScore: 0
      };

      const config = viteConfig || vueConfig;
      if (config) {
        // Check for production-specific configuration
        if (config.includes('mode:') || config.includes('NODE_ENV')) {
          analysis.hasProductionConfig = true;
        }

        // Check for optimization configuration
        if (config.includes('optimization') || config.includes('minify') || config.includes('terser')) {
          analysis.hasOptimizationConfig = true;
        }

        // Check for source maps configuration
        if (config.includes('sourcemap') || config.includes('sourceMap')) {
          analysis.hasSourceMapsConfigured = true;
        }

        // Check for bundle analysis tools
        if (config.includes('rollup-plugin-visualizer') || config.includes('bundle-analyzer')) {
          analysis.hasBundleAnalysis = true;
        }

        // Calculate optimization score
        let score = 0;
        if (analysis.hasProductionConfig) score += 25;
        if (analysis.hasOptimizationConfig) score += 25;
        if (analysis.hasSourceMapsConfigured) score += 15;
        if (analysis.hasBundleAnalysis) score += 15;

        // Bonus points for advanced optimizations
        if (config.includes('chunk') || config.includes('split')) score += 10;
        if (config.includes('treeShaking') || config.includes('treeshake')) score += 10;

        analysis.optimizationScore = score;

        if (score < 50) {
          analysis.configurationIssues.push({
            type: 'poor_optimization',
            score: `${score}%`,
            recommendation: 'Improve build configuration for better performance'
          });
        }

        if (!analysis.hasProductionConfig) {
          analysis.configurationIssues.push({
            type: 'no_production_config',
            recommendation: 'Add production-specific build configuration'
          });
        }

        if (!analysis.hasOptimizationConfig) {
          analysis.configurationIssues.push({
            type: 'no_optimization',
            recommendation: 'Configure minification and optimization settings'
          });
        }

      } else {
        analysis.configurationIssues.push({
          type: 'no_build_config',
          recommendation: 'Create a build configuration file'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeBuildProcess() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};

      const analysis = {
        hasBuildScript: !!scripts.build,
        hasDevScript: !!scripts.dev || !!scripts.serve,
        hasLintScript: !!scripts.lint,
        hasTestScript: !!scripts.test,
        buildTimeOptimizations: [],
        deploymentScripts: [],
        issues: []
      };

      // Analyze build script
      if (scripts.build) {
        analysis.buildTimeOptimizations = this.analyzeBuildScript(scripts.build);
      }

      // Check for deployment-related scripts
      const deploymentKeywords = ['deploy', 'build:prod', 'build:staging', 'preview'];
      for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
        if (deploymentKeywords.some(keyword => scriptName.includes(keyword))) {
          analysis.deploymentScripts.push({
            name: scriptName,
            command: scriptCommand
          });
        }
      }

      // Essential script recommendations
      if (!analysis.hasBuildScript) {
        analysis.issues.push({
          type: 'no_build_script',
          recommendation: 'Add a build script to package.json'
        });
      }

      if (!analysis.hasDevScript) {
        analysis.issues.push({
          type: 'no_dev_script',
          recommendation: 'Add a development server script'
        });
      }

      if (!analysis.hasTestScript) {
        analysis.issues.push({
          type: 'no_test_script',
          recommendation: 'Add a test script for quality assurance'
        });
      }

      if (!analysis.hasLintScript) {
        analysis.issues.push({
          type: 'no_lint_script',
          recommendation: 'Add a lint script for code quality'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  analyzeBuildScript(buildScript) {
    const optimizations = [];

    if (buildScript.includes('--mode production')) {
      optimizations.push('Production mode specified');
    }

    if (buildScript.includes('--minify') || buildScript.includes('terser')) {
      optimizations.push('Minification enabled');
    }

    if (buildScript.includes('--sourcemap')) {
      optimizations.push('Source maps configured');
    }

    return optimizations;
  }

  async analyzeDeploymentReadiness() {
    try {
      const analysis = {
        hasEnvironmentConfig: false,
        hasDockerConfig: false,
        hasCIConfig: false,
        hasDeploymentDocs: false,
        productionReady: false,
        readinessScore: 0,
        blockers: [],
        warnings: []
      };

      // Check for environment configuration
      const envFiles = ['.env.example', '.env.production'];
      for (const envFile of envFiles) {
        if (await this.fileExists(envFile)) {
          analysis.hasEnvironmentConfig = true;
          break;
        }
      }

      // Check for Docker configuration
      const dockerFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
      for (const dockerFile of dockerFiles) {
        if (await this.fileExists(dockerFile)) {
          analysis.hasDockerConfig = true;
          break;
        }
      }

      // Check for CI/CD configuration
      const ciFiles = [
        '.github/workflows/',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        'azure-pipelines.yml',
        'bitbucket-pipelines.yml'
      ];

      for (const ciFile of ciFiles) {
        if (ciFile.endsWith('/')) {
          if (await this.directoryExists(ciFile)) {
            analysis.hasCIConfig = true;
            break;
          }
        } else {
          if (await this.fileExists(ciFile)) {
            analysis.hasCIConfig = true;
            break;
          }
        }
      }

      // Check for deployment documentation
      const docsFiles = ['DEPLOYMENT.md', 'README.md', 'CONTRIBUTING.md'];
      for (const docFile of docsFiles) {
        if (await this.fileExists(docFile)) {
          const content = await fs.readFile(docFile, 'utf8');
          if (content.toLowerCase().includes('deploy') || content.toLowerCase().includes('production')) {
            analysis.hasDeploymentDocs = true;
            break;
          }
        }
      }

      // Calculate readiness score
      let score = 0;
      if (analysis.hasEnvironmentConfig) score += 25;
      if (analysis.hasDockerConfig) score += 20;
      if (analysis.hasCIConfig) score += 25;
      if (analysis.hasDeploymentDocs) score += 15;

      // Bonus points for advanced deployment features
      if (await this.fileExists('package.json')) {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        if (packageJson.scripts?.deploy) {
          score += 15;
        }
      }

      analysis.readinessScore = score;
      analysis.productionReady = score >= 70;

      // Critical blockers
      if (!analysis.hasEnvironmentConfig) {
        analysis.blockers.push({
          type: 'no_env_config',
          issue: 'No environment configuration found',
          recommendation: 'Create .env.example and environment-specific configurations'
        });
      }

      // Warnings
      if (!analysis.hasDockerConfig) {
        analysis.warnings.push({
          type: 'no_docker',
          recommendation: 'Consider adding Docker configuration for consistent deployments'
        });
      }

      if (!analysis.hasCIConfig) {
        analysis.warnings.push({
          type: 'no_ci_cd',
          recommendation: 'Set up CI/CD pipeline for automated testing and deployment'
        });
      }

      if (!analysis.hasDeploymentDocs) {
        analysis.warnings.push({
          type: 'no_deployment_docs',
          recommendation: 'Create deployment documentation for team reference'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeCompatibility() {
    const category = this.analysisResults.categories.compatibility;
    console.log('  📱 Analyzing cross-platform compatibility...');

    try {
      // Browser Compatibility
      const browserAnalysis = await this.analyzeBrowserCompatibility();
      category.browser = browserAnalysis;

      // Mobile Compatibility
      const mobileAnalysis = await this.analyzeMobileCompatibility();
      category.mobile = mobileAnalysis;

      // Responsive Design
      const responsiveAnalysis = await this.analyzeResponsiveDesign();
      category.responsive = responsiveAnalysis;

    } catch (error) {
      category.error = error.message;
      this.addCriticalIssue('Compatibility Analysis', `Analysis failed: ${error.message}`);
    }
  }

  async analyzeBrowserCompatibility() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const browserslistConfig = await this.readFile('.browserslistrc', 'utf8').catch(() => null);

      const analysis = {
        hasBrowserslistConfig: !!browserslistConfig,
        supportedBrowsers: [],
        polyfills: [],
        compatibilityIssues: [],
        modernJSFeatures: [],
        issues: []
      };

      if (browserslistConfig) {
        // Parse browserslist configuration
        const lines = browserslistConfig.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        analysis.supportedBrowsers = lines;

        // Check for very old browser support
        if (browserslistConfig.includes('IE') || browserslistConfig.includes('ie')) {
          analysis.compatibilityIssues.push({
            type: 'ie_support',
            issue: 'Internet Explorer support detected',
            recommendation: 'Consider dropping IE support for better modern features'
          });
        }
      }

      // Check for polyfills
      const sourceFiles = await this.getFiles(this.srcDir, /\.(ts|js)$/);
      for (const file of sourceFiles) {
        const content = await fs.readFile(file.path, 'utf8');

        if (content.includes('polyfill') || content.includes('core-js')) {
          analysis.polyfills.push({
            file: file.name,
            type: 'polyfill_usage'
          });
        }
      }

      // Check for modern JavaScript features that might need polyfills
      const modernFeatures = [
        { pattern: /async\s+await/, name: 'async/await', polyfill: 'regenerator-runtime' },
        { pattern: /Object\.assign/, name: 'Object.assign', polyfill: 'object-assign' },
        { pattern: /Promise\./, name: 'Promise API', polyfill: 'promise-polyfill' },
        { pattern: /fetch\s*\(/, name: 'fetch API', polyfill: 'whatwg-fetch' },
        { pattern: /\.\.\./, name: 'spread operator', polyfill: 'babel-plugin-transform-object-rest-spread' }
      ];

      for (const feature of modernFeatures) {
        let usageCount = 0;
        for (const file of sourceFiles) {
          const content = await fs.readFile(file.path, 'utf8');
          const matches = content.match(feature.pattern);
          if (matches) {
            usageCount += matches.length;
          }
        }

        if (usageCount > 0) {
          analysis.modernJSFeatures.push({
            name: feature.name,
            usage: usageCount,
            polyfill: feature.polyfill
          });
        }
      }

      if (!analysis.hasBrowserslistConfig) {
        analysis.issues.push({
          type: 'no_browserslist',
          recommendation: 'Add .browserslistrc configuration to define target browsers'
        });
      }

      if (analysis.modernJSFeatures.length > 0 && analysis.polyfills.length === 0) {
        analysis.issues.push({
          type: 'missing_polyfills',
          features: analysis.modernJSFeatures.map(f => f.name),
          recommendation: 'Add polyfills for modern JavaScript features to support older browsers'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeMobileCompatibility() {
    try {
      const analysis = {
        hasViewportMeta: false,
        hasTouchSupport: false,
        hasResponsiveImages: false,
        hasMobileOptimizations: [],
        mobileIssues: [],
        responsiveScore: 0
      };

      // Check HTML files for mobile optimizations
      const htmlFiles = await this.getFiles(this.publicDir, /\.html$/);

      for (const htmlFile of htmlFiles) {
        const content = await fs.readFile(htmlFile.path, 'utf8');

        if (content.includes('viewport')) {
          analysis.hasViewportMeta = true;
        }

        if (content.includes('touch-action') || content.includes('ontouch')) {
          analysis.hasTouchSupport = true;
        }
      }

      // Check for responsive images
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');

        if (content.includes('srcset') || content.includes('sizes')) {
          analysis.hasResponsiveImages = true;
        }
      }

      // Check for mobile-specific CSS
      const cssFiles = await this.getFiles(this.srcDir, /\.css$/);
      for (const cssFile of cssFiles) {
        const content = await fs.readFile(cssFile.path, 'utf8');

        if (content.includes('@media') && content.includes('max-width')) {
          analysis.hasMobileOptimizations.push({
            type: 'media_queries',
            file: cssFile.name
          });
        }
      }

      // Calculate responsive score
      let score = 0;
      if (analysis.hasViewportMeta) score += 30;
      if (analysis.hasTouchSupport) score += 20;
      if (analysis.hasResponsiveImages) score += 20;
      if (analysis.hasMobileOptimizations.length > 0) score += 30;

      analysis.responsiveScore = score;

      if (!analysis.hasViewportMeta) {
        analysis.mobileIssues.push({
          type: 'no_viewport',
          issue: 'No viewport meta tag found',
          recommendation: 'Add viewport meta tag for proper mobile rendering'
        });
      }

      if (analysis.responsiveScore < 50) {
        analysis.mobileIssues.push({
          type: 'poor_mobile_support',
          score: `${score}%`,
          recommendation: 'Improve mobile compatibility with responsive design and touch support'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeResponsiveDesign() {
    try {
      const analysis = {
        hasBreakpoints: false,
        hasFlexibleGrids: false,
        hasFlexibleImages: false,
        breakpointCount: 0,
        responsiveUnits: [],
        layoutPatterns: [],
        issues: []
      };

      // Analyze CSS for responsive patterns
      const cssFiles = await this.getFiles(this.srcDir, /\.css$/);

      let mediaQueryCount = 0;
      const flexibleUnits = new Set();
      const layoutPatternMatches = new Set();

      for (const cssFile of cssFiles) {
        const content = await fs.readFile(cssFile.path, 'utf8');

        // Count media queries
        const mediaQueries = content.match(/@media[^{]+/g) || [];
        mediaQueryCount += mediaQueries.length;

        // Look for flexible units
        const unitPatterns = [
          { pattern: /\brem\b/, name: 'rem' },
          { pattern: /\bem\b/, name: 'em' },
          { pattern: /\b%/g, name: 'percentage' },
          { pattern: /\bvw\b/, name: 'vw' },
          { pattern: /\bvh\b/, name: 'vh' },
          { pattern: /\bvmin\b/, name: 'vmin' },
          { pattern: /\bvmax\b/, name: 'vmax' }
        ];

        for (const unit of unitPatterns) {
          if (unit.pattern.test(content)) {
            flexibleUnits.add(unit.name);
          }
        }

        // Look for layout patterns
        if (content.includes('flexbox') || content.includes('display: flex')) {
          layoutPatternMatches.add('flexbox');
        }
        if (content.includes('grid') || content.includes('display: grid')) {
          layoutPatternMatches.add('grid');
        }
      }

      analysis.hasBreakpoints = mediaQueryCount > 0;
      analysis.breakpointCount = mediaQueryCount;
      analysis.hasFlexibleGrids = layoutPatternMatches.has('flexbox') || layoutPatternMatches.has('grid');
      analysis.responsiveUnits = Array.from(flexibleUnits);
      analysis.layoutPatterns = Array.from(layoutPatternMatches);

      // Check Vue files for responsive attributes
      const vueFiles = await this.getFiles(this.srcDir, /\.vue$/);
      for (const vueFile of vueFiles) {
        const content = await fs.readFile(vueFile.path, 'utf8');

        if (content.includes('responsive') || content.includes('breakpoint')) {
          // Found responsive considerations in component logic
        }
      }

      if (!analysis.hasBreakpoints) {
        analysis.issues.push({
          type: 'no_breakpoints',
          recommendation: 'Add media queries for responsive breakpoints'
        });
      }

      if (flexibleUnits.size === 0) {
        analysis.issues.push({
          type: 'fixed_units_only',
          recommendation: 'Use relative units (rem, em, %) for better responsiveness'
        });
      }

      if (!analysis.hasFlexibleGrids) {
        analysis.issues.push({
          type: 'no_modern_layout',
          recommendation: 'Consider using flexbox or grid for flexible layouts'
        });
      }

      return analysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  calculateOverallHealth() {
    let totalScore = 0;
    let categoryCount = 0;
    let criticalIssues = 0;

    // Calculate scores for each category
    for (const [categoryName, category] of Object.entries(this.analysisResults.categories)) {
      if (category.error) {
        criticalIssues++;
        continue;
      }

      let categoryScore = 50; // Base score
      const issues = category.issues || [];

      // Deduct points for issues
      for (const issue of issues) {
        if (issue.type?.includes('critical') || issue.severity === 'critical') {
          categoryScore -= 25;
          criticalIssues++;
        } else if (issue.type?.includes('high') || issue.severity === 'high') {
          categoryScore -= 15;
        } else if (issue.type?.includes('medium') || issue.severity === 'medium') {
          categoryScore -= 10;
        } else {
          categoryScore -= 5;
        }
      }

      // Add bonus points for good practices
      if (category.bundle?.totalSize && this.parseFileSize(category.bundle.totalSize) < 2 * 1024 * 1024) {
        categoryScore += 10; // Small bundle
      }

      if (category.testing?.testCoverage > 80) {
        categoryScore += 15; // High test coverage
      }

      if (category.accessibility?.score > 80) {
        categoryScore += 10; // Good accessibility
      }

      totalScore += Math.max(0, Math.min(100, categoryScore));
      categoryCount++;
    }

    const overallScore = categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;

    this.analysisResults.overall = {
      healthScore: overallScore,
      criticalIssues,
      performanceGrade: this.analysisResults.categories.performance?.metrics?.performanceGrade || 'C',
      securityPosture: this.analysisResults.categories.security?.dependencies?.riskLevel || 'unknown',
      deploymentReady: this.analysisResults.categories.build?.deployment?.productionReady || false
    };

    // Add evidence
    this.addEvidence('overall', {
      type: 'health_score',
      score: overallScore,
      categoryCount,
      criticalIssues
    });
  }

  async generateRecommendations() {
    const recommendations = [];
    const overall = this.analysisResults.overall;

    // Critical recommendations (must fix immediately)
    if (overall.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Address Critical Issues Immediately',
        description: `${overall.criticalIssues} critical issues found that could cause system failures or security breaches.`,
        actions: [
          'Fix security vulnerabilities immediately',
          'Resolve performance bottlenecks affecting users',
          'Address data integrity risks',
          'Fix broken user workflows'
        ],
        estimatedEffort: '1-3 days'
      });
    }

    // Performance recommendations
    const perfCategory = this.analysisResults.categories.performance;
    if (perfCategory.bundle?.issues?.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Optimize Bundle Size',
        description: 'Large bundle size is affecting page load performance.',
        actions: [
          'Implement code splitting',
          'Remove unused dependencies',
          'Compress and optimize assets',
          'Enable tree shaking'
        ],
        estimatedEffort: '1-2 days'
      });
    }

    // Security recommendations
    const securityCategory = this.analysisResults.categories.security;
    if (securityCategory.code?.insecurePatterns?.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address Security Vulnerabilities',
        description: 'Security issues found that could expose your application to attacks.',
        actions: [
          'Update vulnerable dependencies',
          'Remove hardcoded credentials',
          'Fix insecure code patterns',
          'Implement proper input validation'
        ],
        estimatedEffort: '1-2 days'
      });
    }

    // Testing recommendations
    const testingCategory = this.analysisResults.categories.testing;
    if (testingCategory.testFiles?.totalTestFiles === 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Implement Testing Framework',
        description: 'No tests found - this risks code quality and reliability.',
        actions: [
          'Set up a testing framework (Vitest recommended)',
          'Write unit tests for critical components',
          'Add integration tests for user workflows',
          'Configure continuous testing'
        ],
        estimatedEffort: '3-5 days'
      });
    }

    // Deployment recommendations
    const buildCategory = this.analysisResults.categories.build;
    if (!buildCategory.deployment?.productionReady) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Deployment Readiness',
        description: 'Application is not fully ready for production deployment.',
        actions: [
          'Create environment configuration files',
          'Set up CI/CD pipeline',
          'Create deployment documentation',
          'Add health checks and monitoring'
        ],
        estimatedEffort: '2-3 days'
      });
    }

    // Accessibility recommendations
    const uiCategory = this.analysisResults.categories.ui;
    if (uiCategory.accessibility?.score < 70) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Accessibility',
        description: 'Accessibility issues found that could exclude users with disabilities.',
        actions: [
          'Add ARIA attributes to interactive elements',
          'Ensure all images have alt text',
          'Use semantic HTML elements',
          'Test with screen readers'
        ],
        estimatedEffort: '1-2 days'
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    this.analysisResults.recommendations = recommendations;
  }

  async generateReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(this.projectRoot, '.claude', 'system-analysis-reports');

    await fs.mkdir(reportsDir, { recursive: true });

    // Generate JSON report
    const jsonReport = {
      ...this.analysisResults,
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeFile(
      path.join(reportsDir, `system-analysis-${timestamp}.json`),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report (simplified)
    const htmlReport = this.generateHTMLReport(jsonReport);
    await fs.writeFile(
      path.join(reportsDir, `system-analysis-${timestamp}.html`),
      htmlReport
    );

    // Generate markdown summary
    const markdownSummary = this.generateMarkdownSummary(jsonReport);
    await fs.writeFile(
      path.join(reportsDir, `system-analysis-summary-${timestamp}.md`),
      markdownSummary
    );

    console.log(`\n📄 Reports generated in ${reportsDir}:`);
    console.log(`  • system-analysis-${timestamp}.json`);
    console.log(`  • system-analysis-${timestamp}.html`);
    console.log(`  • system-analysis-summary-${timestamp}.md`);
  }

  generateHTMLReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pomo-Flow System Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .score-circle { width: 120px; height: 120px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2em; font-weight: bold; color: white; margin: 20px; }
        .score-excellent { background: #28a745; }
        .score-good { background: #5cb85c; }
        .score-fair { background: #f0ad4e; }
        .score-poor { background: #d9534f; }
        .score-critical { background: #a94442; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 6px; }
        .critical { border-left: 4px solid #d9534f; }
        .warning { border-left: 4px solid #f0ad4e; }
        .info { border-left: 4px solid #5bc0de; }
        .success { border-left: 4px solid #5cb85c; }
        .issue { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .recommendation { margin: 15px 0; padding: 15px; background: #e9ecef; border-radius: 4px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 1.5em; font-weight: bold; display: block; }
        .metric-label { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 Pomo-Flow System Analysis Report</h1>
            <p>Generated on ${new Date(data.generatedAt).toLocaleString()}</p>
            <div class="score-circle score-${this.getScoreClass(data.overall.healthScore)}">
                ${data.overall.healthScore}%
            </div>
            <h2>Overall Health Score</h2>
        </div>

        <div class="section ${data.overall.criticalIssues > 0 ? 'critical' : 'info'}">
            <h3>🚨 Executive Summary</h3>
            <div class="metric">
                <span class="metric-value">${data.overall.criticalIssues}</span>
                <span class="metric-label">Critical Issues</span>
            </div>
            <div class="metric">
                <span class="metric-value">${data.overall.performanceGrade}</span>
                <span class="metric-label">Performance Grade</span>
            </div>
            <div class="metric">
                <span class="metric-value">${data.overall.securityPosture}</span>
                <span class="metric-label">Security Posture</span>
            </div>
            <div class="metric">
                <span class="metric-value">${data.overall.deploymentReady ? '✅' : '❌'}</span>
                <span class="metric-label">Deployment Ready</span>
            </div>
        </div>

        <div class="section">
            <h3>🎯 Priority Recommendations</h3>
            ${data.recommendations.slice(0, 5).map(rec => `
                <div class="recommendation">
                    <h4>${rec.title} (${rec.priority})</h4>
                    <p>${rec.description}</p>
                    <ul>
                        ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                    <p><strong>Estimated effort:</strong> ${rec.estimatedEffort}</p>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h3>📊 Category Analysis</h3>
            ${Object.entries(data.categories).map(([name, category]) => `
                <div class="section ${category.error ? 'critical' : 'info'}">
                    <h4>${name.charAt(0).toUpperCase() + name.slice(1)}</h4>
                    ${category.error ?
                        `<p class="issue">❌ Analysis failed: ${category.error}</p>` :
                        category.issues && category.issues.length > 0 ?
                        `<p>⚠️ ${category.issues.length} issues found</p>` :
                        `<p>✅ No critical issues detected</p>`
                    }
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  generateMarkdownSummary(data) {
    return `# Pomo-Flow System Analysis Summary

**Generated:** ${new Date(data.generatedAt).toLocaleString()}
**Overall Health Score:** ${data.overall.healthScore}%
**Mode:** ${data.mode}

## 🚨 Executive Summary

- **Critical Issues:** ${data.overall.criticalIssues}
- **Performance Grade:** ${data.overall.performanceGrade}
- **Security Posture:** ${data.overall.securityPosture}
- **Deployment Ready:** ${data.overall.deploymentReady ? '✅ Yes' : '❌ No'}

## 🎯 Top Recommendations

${data.recommendations.slice(0, 3).map((rec, index) => `
${index + 1}. **${rec.title}** (${rec.priority})
   - ${rec.description}
   - **Effort:** ${rec.estimatedEffort}
   - **Actions:** ${rec.actions.slice(0, 2).join(', ')}${rec.actions.length > 2 ? '...' : ''}
`).join('')}

## 📊 Category Breakdown

${Object.entries(data.categories).map(([name, category]) => `
### ${name.charAt(0).toUpperCase() + name.slice(1)}
${category.error ?
`❌ **Error:** ${category.error}` :
category.issues && category.issues.length > 0 ?
`⚠️ **Issues:** ${category.issues.length} issues detected` :
`✅ **Status:** No critical issues`
}
`).join('')}

## 🔗 Full Report

Detailed JSON and HTML reports are available in the \`.claude/system-analysis-reports/\` directory.
`;
  }

  displayExecutiveSummary() {
    const overall = this.analysisResults.overall;

    console.log('\n' + '='.repeat(80));
    console.log('🚨 EXECUTIVE SUMMARY - BRUTAL HONESTY REPORT');
    console.log('='.repeat(80));

    // Health score with color coding
    const scoreColor = this.getScoreColor(overall.healthScore);
    const scoreClass = this.getScoreClass(overall.healthScore);

    console.log(`\n🎯 Overall Health Score: ${scoreColor}${overall.healthScore}%${this.resetColor()}`);
    console.log(`   Grade: ${this.getGradeDisplay(scoreClass)}`);

    // Critical metrics
    console.log(`\n📊 Critical Metrics:`);
    console.log(`   • Critical Issues: ${overall.criticalIssues > 0 ? `🚨 ${overall.criticalIssues}` : '✅ 0'}`);
    console.log(`   • Performance Grade: ${this.getPerformanceGradeDisplay(overall.performanceGrade)}`);
    console.log(`   • Security Posture: ${this.getSecurityPostureDisplay(overall.securityPosture)}`);
    console.log(`   • Deployment Ready: ${overall.deploymentReady ? '✅ Yes' : '❌ NO'}`);

    // Top issues
    const allIssues = [];
    for (const [categoryName, category] of Object.entries(this.analysisResults.categories)) {
      if (category.issues) {
        allIssues.push(...category.issues.map(issue => ({ ...issue, category: categoryName })));
      }
    }

    // Sort issues by severity
    const sortedIssues = allIssues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity] || 1;
      const bSeverity = severityOrder[b.severity] || 1;
      return bSeverity - aSeverity;
    });

    if (sortedIssues.length > 0) {
      console.log(`\n🚨 Top Issues (Must Fix):`);
      sortedIssues.slice(0, 5).forEach((issue, index) => {
        const icon = this.getIssueIcon(issue.severity);
        console.log(`   ${index + 1}. ${icon} ${issue.issue || issue.type} (${issue.category})`);
        if (issue.recommendation) {
          console.log(`      💡 ${issue.recommendation}`);
        }
      });

      if (sortedIssues.length > 5) {
        console.log(`   ... and ${sortedIssues.length - 5} more issues`);
      }
    }

    // Priority recommendations
    if (this.analysisResults.recommendations.length > 0) {
      console.log(`\n🎯 Priority Recommendations:`);
      this.analysisResults.recommendations.slice(0, 3).forEach((rec, index) => {
        const priorityIcon = this.getPriorityIcon(rec.priority);
        console.log(`   ${index + 1}. ${priorityIcon} ${rec.title} (${rec.priority})`);
        console.log(`      📝 ${rec.description}`);
        console.log(`      ⏱️  Estimated effort: ${rec.estimatedEffort}`);
      });
    }

    // Truth assessment
    console.log(`\n🔍 THE BRUTAL TRUTH:`);
    if (overall.criticalIssues > 0) {
      console.log(`   ❌ Your application has ${overall.criticalIssues} critical issues that could cause`);
      console.log(`      production failures or security breaches. Fix these immediately.`);
    }

    if (overall.healthScore < 70) {
      console.log(`   ⚠️  Health score of ${overall.healthScore}% indicates significant problems.`);
      console.log(`      Users are likely experiencing issues.`);
    }

    if (!overall.deploymentReady) {
      console.log(`   🚫 Application is NOT ready for production deployment.`);
      console.log(`      Deployment would likely fail or cause issues.`);
    }

    if (overall.performanceGrade === 'F' || overall.performanceGrade === 'D') {
      console.log(`   🐌 Performance grade of ${overall.performanceGrade} means your app is slow.`);
      console.log(`      Users are abandoning due to poor performance.`);
    }

    if (overall.securityPosture === 'high' || overall.securityPosture === 'critical') {
      console.log(`   🔓 Security posture indicates serious vulnerabilities.`);
      console.log(`      Your application could be compromised.`);
    }

    // Positive reinforcement if deserved
    if (overall.criticalIssues === 0 && overall.healthScore >= 80) {
      console.log(`   ✅ Excellent work! Your application is in good shape.`);
      console.log(`      Focus on the minor issues to reach perfection.`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📄 Full reports generated in .claude/system-analysis-reports/');
    console.log('='.repeat(80));
  }

  // Helper methods for display
  getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  getScoreColor(score) {
    if (score >= 90) return '\x1b[32m'; // Green
    if (score >= 80) return '\x1b[36m'; // Cyan
    if (score >= 70) return '\x1b[33m'; // Yellow
    if (score >= 60) return '\x1b[31m'; // Red
    return '\x1b[31;1m'; // Bold Red
  }

  resetColor() {
    return '\x1b[0m';
  }

  getGradeDisplay(grade) {
    const colors = {
      excellent: '\x1b[32mA\x1b[0m (Excellent)',
      good: '\x1b[36mB\x1b[0m (Good)',
      fair: '\x1b[33mC\x1b[0m (Fair)',
      poor: '\x1b[31mD\x1b[0m (Poor)',
      critical: '\x1b[31;1mF\x1b[0m (Critical)'
    };
    return colors[grade] || `${grade.toUpperCase()} (Unknown)`;
  }

  getPerformanceGradeDisplay(grade) {
    const displays = {
      'A': '\x1b[32mA\x1b[0m (Excellent)',
      'B': '\x1b[36mB\x1b[0m (Good)',
      'C': '\x1b[33mC\x1b[0m (Fair)',
      'D': '\x1b[31mD\x1b[0m (Poor)',
      'F': '\x1b[31;1mF\x1b[0m (Unacceptable)'
    };
    return displays[grade] || `${grade} (Unknown)`;
  }

  getSecurityPostureDisplay(posture) {
    const displays = {
      'low': '\x1b[32mLow\x1b[0m (Secure)',
      'medium': '\x1b[33mMedium\x1b[0m (Some risks)',
      'high': '\x1b[31mHigh\x1b[0m (Vulnerable)',
      'critical': '\x1b[31;1mCritical\x1b[0m (High risk)',
      'unknown': '\x1b[33mUnknown\x1b[0m (Not analyzed)'
    };
    return displays[posture] || `${posture} (Unknown)`;
  }

  getIssueIcon(severity) {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return icons[severity] || '🔍';
  }

  getPriorityIcon(priority) {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return icons[priority] || '📋';
  }

  // Utility methods
  async readFile(filePath, encoding = 'utf8') {
    return await fs.readFile(path.join(this.projectRoot, filePath), encoding);
  }

  async fileExists(filePath) {
    try {
      await fs.access(path.join(this.projectRoot, filePath));
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(path.join(this.projectRoot, dirPath));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getFiles(dir, pattern = null) {
    const files = [];

    if (!await this.directoryExists(dir)) {
      return files;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.getFiles(fullPath, pattern));
      } else if (!pattern || pattern.test(entry.name)) {
        files.push({
          name: entry.name,
          path: fullPath
        });
      }
    }

    return files;
  }

  async getVueComponents(dir) {
    return await this.getFiles(dir, /\.vue$/);
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subStats = await this.getDirectorySize(fullPath);
          totalSize += subStats.size;
          fileCount += subStats.fileCount;
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    } catch (error) {
      // Directory might not exist or be inaccessible
    }

    return { size: totalSize, fileCount };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  parseFileSize(sizeStr) {
    const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    const multipliers = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
  }

  findLineNumbers(content, pattern) {
    const lines = content.split('\n');
    const lineNumbers = [];

    lines.forEach((line, index) => {
      if (pattern instanceof RegExp && pattern.test(line)) {
        lineNumbers.push(index + 1);
      } else if (typeof pattern === 'string' && line.includes(pattern)) {
        lineNumbers.push(index + 1);
      }
    });

    return lineNumbers;
  }

  addCriticalIssue(category, issue) {
    this.analysisResults.overall.criticalIssues++;
    this.addEvidence(category, {
      type: 'critical_issue',
      issue,
      timestamp: new Date().toISOString()
    });
  }

  addEvidence(category, evidence) {
    this.analysisResults.evidence.push({
      category,
      ...evidence,
      timestamp: new Date().toISOString()
    });
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new ComprehensiveSystemAnalyzer();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'comprehensive';
  const focus = args.find(arg => arg.startsWith('--focus='))?.split('=')[1] || null;

  analyzer.execute(mode, focus).catch(error => {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  });
}

module.exports = ComprehensiveSystemAnalyzer;