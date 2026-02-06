#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Show usage information
function showHelp() {
  console.log(`
Tauri Update Manifest Generator

Usage:
  node scripts/generate-update-manifest.cjs [options]
  npm run tauri:update-manifest -- [options]

Options:
  --notes <text>        Release notes (default: "FlowState vX.X.X")
  --base-url <url>      Base URL for downloads (default: https://in-theflow.com/updates/)
  --output <path>       Output file path (default: ./latest.json)
  --dry-run             Preview manifest without writing file
  --help, -h            Show this help message

Examples:
  # Basic usage
  npm run tauri:update-manifest

  # With release notes
  npm run tauri:update-manifest -- --notes "Bug fixes and performance improvements"

  # Custom base URL
  node scripts/generate-update-manifest.cjs --base-url "https://example.com/releases/"

Prerequisites:
  1. Signing keys configured (see docs/sop/SOP-011-tauri-distribution.md)
  2. Set "createUpdaterArtifacts": true in tauri.conf.json
  3. Run "npm run tauri build" with signing enabled

Documentation:
  scripts/README-update-manifest.md
`);
  process.exit(0);
}

// Parse CLI arguments
function parseArgs() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
  }

  const args = {
    notes: '',
    baseUrl: 'https://in-theflow.com/updates/',
    output: path.join(__dirname, '../latest.json'),
    dryRun: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--notes' && process.argv[i + 1]) {
      args.notes = process.argv[i + 1];
      i++;
    } else if (arg === '--base-url' && process.argv[i + 1]) {
      args.baseUrl = process.argv[i + 1];
      // Ensure trailing slash
      if (!args.baseUrl.endsWith('/')) {
        args.baseUrl += '/';
      }
      i++;
    } else if (arg === '--output' && process.argv[i + 1]) {
      args.output = path.resolve(process.argv[i + 1]);
      i++;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

// Read version from tauri.conf.json
function getVersion() {
  const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.version;
  } catch (err) {
    console.error('❌ Error reading tauri.conf.json:', err.message);
    process.exit(1);
  }
}

// Platform mapping for Tauri updater
// Order matters: first match wins per platform, so prefer AppImage over .deb
const PLATFORM_MAPPING = {
  'linux-x86_64': {
    patterns: [
      /FlowState_.*_amd64\.AppImage$/,
    ],
  },
  'windows-x86_64': {
    patterns: [
      /FlowState_.*_x64-setup\.nsis\.zip$/,
      /FlowState_.*_x64.*\.msi\.zip$/,
    ],
  },
  'darwin-x86_64': {
    patterns: [
      /FlowState_.*_x64\.app\.tar\.gz$/,
    ],
  },
  'darwin-aarch64': {
    patterns: [
      /FlowState_.*_aarch64\.app\.tar\.gz$/,
    ],
  },
};

// Find updater artifacts (binaries with .sig signature files)
function findUpdaterArtifacts() {
  const bundleDir = path.join(__dirname, '../src-tauri/target/release/bundle');

  if (!fs.existsSync(bundleDir)) {
    console.error('❌ Bundle directory not found:', bundleDir);
    console.error('   Run "npm run tauri build" first to create build artifacts.');
    process.exit(1);
  }

  const artifacts = {};
  const foundFiles = [];

  // Search for .tar.gz and .zip files with corresponding .sig files
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.tar.gz') || entry.name.endsWith('.zip') || entry.name.endsWith('.AppImage') || entry.name.endsWith('.deb'))) {
        const sigPath = fullPath + '.sig';
        if (fs.existsSync(sigPath)) {
          foundFiles.push({
            archivePath: fullPath,
            sigPath: sigPath,
            filename: entry.name,
          });
        }
      }
    }
  }

  scanDirectory(bundleDir);

  if (foundFiles.length === 0) {
    console.error('❌ No signed updater artifacts found (.sig files)');
    console.error('');
    console.error('   Updater artifacts are created when you:');
    console.error('   1. Have signing keys configured');
    console.error('   2. Set "createUpdaterArtifacts": true in tauri.conf.json');
    console.error('   3. Run "npm run tauri build"');
    console.error('');
    console.error('   If you just built without signing, this is expected.');
    console.error('   See docs/sop/SOP-011-tauri-distribution.md for signing setup.');
    process.exit(1);
  }

  // Map files to platforms (only match current version)
  const currentVersion = getVersion();
  const versionEscaped = currentVersion.replace(/\./g, '\\.');

  for (const file of foundFiles) {
    let matched = false;

    // Skip files that don't match the current version
    const versionPattern = new RegExp(`FlowState[_-]${versionEscaped}[_-]`);
    if (!versionPattern.test(file.filename)) {
      continue;
    }

    for (const [platform, { patterns }] of Object.entries(PLATFORM_MAPPING)) {
      if (matched) break;

      for (const pattern of patterns) {
        if (pattern.test(file.filename)) {
          // Read signature file
          const signature = fs.readFileSync(file.sigPath, 'utf8').trim();

          artifacts[platform] = {
            signature: signature,
            url: `${file.filename}`, // Will be prefixed with baseUrl later
            localPath: file.archivePath,
          };
          matched = true;
          break;
        }
      }
    }

    // Fallback: macOS universal binary (no arch in filename)
    if (!matched && file.filename.match(/\.app\.tar\.gz$/)) {
      const signature = fs.readFileSync(file.sigPath, 'utf8').trim();

      // Check if we already have darwin platforms
      const hasDarwinX64 = !!artifacts['darwin-x86_64'];
      const hasDarwinArm = !!artifacts['darwin-aarch64'];

      // If no specific Darwin artifacts found, use for both architectures
      if (!hasDarwinX64 && !hasDarwinArm) {
        artifacts['darwin-x86_64'] = {
          signature: signature,
          url: `${file.filename}`,
          localPath: file.archivePath,
        };
        artifacts['darwin-aarch64'] = {
          signature: signature,
          url: `${file.filename}`,
          localPath: file.archivePath,
        };
      }
    }
  }

  return { artifacts, foundFiles };
}

// Generate the manifest
function generateManifest(args) {
  console.log('🔍 Scanning for Tauri updater artifacts...\n');

  const version = getVersion();
  const { artifacts, foundFiles } = findUpdaterArtifacts();

  console.log(`📦 Found ${foundFiles.length} signed artifact(s):\n`);
  foundFiles.forEach(file => {
    console.log(`   ✓ ${path.basename(file.filename)}`);
    console.log(`     ${path.basename(file.sigPath)}`);
  });
  console.log('');

  // Build platforms object with full URLs
  const platforms = {};
  for (const [platform, data] of Object.entries(artifacts)) {
    platforms[platform] = {
      signature: data.signature,
      url: args.baseUrl + data.url,
    };
  }

  // Create manifest
  const manifest = {
    version: version,
    notes: args.notes || `FlowState v${version}`,
    pub_date: new Date().toISOString(),
    platforms: platforms,
  };

  // Write to output file (or just preview)
  if (args.dryRun) {
    console.log('🔍 DRY RUN - Manifest preview (not written):\n');
    console.log(JSON.stringify(manifest, null, 2));
    console.log('');
  } else {
    fs.writeFileSync(args.output, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  console.log('✅ ' + (args.dryRun ? 'Generated' : 'Wrote') + ' update manifest:\n');
  console.log(`   Version:    ${manifest.version}`);
  console.log(`   Date:       ${manifest.pub_date}`);
  console.log(`   Platforms:  ${Object.keys(platforms).join(', ')}`);
  if (!args.dryRun) {
    console.log(`   Output:     ${args.output}`);
  }
  console.log('');

  if (args.notes) {
    console.log(`   Notes:      ${args.notes}\n`);
  }

  if (!args.dryRun) {
    console.log('📋 Next steps:\n');
    console.log(`   1. Upload the following files to ${args.baseUrl}:`);
    foundFiles.forEach(file => {
      console.log(`      - ${path.basename(file.filename)}`);
      console.log(`      - ${path.basename(file.sigPath)}`);
    });
    console.log(`   2. Upload latest.json to ${args.baseUrl}latest.json`);
    console.log(`   3. Verify the updater endpoint is accessible:\n`);
    console.log(`      curl ${args.baseUrl}latest.json\n`);
  }
}

// Main
function main() {
  try {
    const args = parseArgs();
    generateManifest(args);
  } catch (err) {
    console.error('❌ Error generating manifest:', err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
