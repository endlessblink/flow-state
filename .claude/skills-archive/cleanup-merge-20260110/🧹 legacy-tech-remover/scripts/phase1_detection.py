#!/usr/bin/env python3
"""
Phase 1: Legacy Detection & Inventory
Scans codebase for abandoned/dead libraries, legacy tech stacks, and deprecated patterns
"""

import os
import sys
import json
import csv
import re
import subprocess
import time
import yaml
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import git

@dataclass
class LegacyItem:
    """Represents a detected legacy item"""
    type: str  # 'library', 'directory', 'file', 'config'
    path: str
    name: str
    last_reference: str
    last_updated: str
    risk_score: float
    size_kb: float
    dependencies: List[str]
    suggested_action: str
    evidence: List[str]
    legacy_reasons: List[str]

class LegacyDetector:
    def __init__(self, config_path: str = None):
        self.project_root = Path.cwd()
        self.legacy_items = []
        self.config = self._load_config(config_path)
        self.excluded_paths = self.config.get('excluded_paths', [])
        self.protected_packages = set(self.config.get('protected_packages', []))
        self.safe_folder_patterns = [re.compile(p) for p in self.config.get('safe_folder_patterns', [])]
        self.min_years_untouched = self.config.get('min_years_untouched', 2)

        # Known deprecated technologies
        self.deprecated_libraries = self._load_deprecated_libraries()
        self.legacy_build_tools = {'grunt', 'gulp', 'travis', 'jenkins', 'circleci'}
        self.legacy_frameworks = {'angularjs', 'jquery', 'backbone', 'knockout', 'ember'}
        self.legacy_patterns = [
            r'bower_components',
            r'dist',
            r'build',
            r'node_modules.*',
            r'\.tmp',
            r'coverage.*'
        ]

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration file"""
        default_config = {
            'min_years_untouched': 2,
            'safe_folder_patterns': [r'^src/legacy/', r'^old/', r'^bak/', r'^deprecated/', r'^v[0-9]+/'],
            'protected_packages': ['core-js', 'typescript', 'react', 'vue', 'angular'],
            'excluded_paths': ['node_modules', '.git', 'dist', 'build', 'coverage'],
            'scan_file_types': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.rb'],
            'package_files': ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'Gemfile']
        }

        if config_path and Path(config_path).exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Warning: Could not load config file {config_path}: {e}")

        return default_config

    def _load_deprecated_libraries(self) -> Dict[str, Dict]:
        """Load known deprecated libraries database"""
        return {
            'javascript': {
                'request': {'deprecated': True, 'reason': 'Security vulnerabilities, unmaintained', 'replacement': 'axios'},
                'left-pad': {'deprecated': True, 'reason': 'Controversial history, unnecessary', 'replacement': 'String.prototype.padStart'},
                'moment': {'deprecated': True, 'reason': 'Large bundle size, modern alternatives available', 'replacement': 'date-fns or luxon'},
                'underscore': {'deprecated': True, 'reason': 'Modern JavaScript has built-in alternatives', 'replacement': 'Lodash or native methods'},
                'babel-preset-es2015': {'deprecated': True, 'reason': 'Replaced by @babel/preset-env', 'replacement': '@babel/preset-env'},
                'bluebird': {'deprecated': True, 'reason': 'Native Promises are widely supported', 'replacement': 'Native Promises'},
                'qs': {'deprecated': True, 'reason': 'Security concerns in older versions', 'replacement': 'URLSearchParams or modern alternatives'}
            },
            'python': {
                'requests': {'deprecated': False, 'note': 'Still actively maintained'},
                'django': {'deprecated': False, 'note': 'Actively maintained'},
                'flask': {'deprecated': False, 'note': 'Actively maintained'},
                'numpy': {'deprecated': False, 'note': 'Actively maintained'}
            }
        }

    def detect_legacy_dependencies(self) -> List[LegacyItem]:
        """Detect deprecated/unused dependencies"""
        print("🔍 Scanning for legacy dependencies...")

        legacy_deps = []

        # Scan package.json
        package_json_path = self.project_root / 'package.json'
        if package_json_path.exists():
            legacy_deps.extend(self._scan_package_json(package_json_path))

        # Scan requirements.txt
        requirements_txt_path = self.project_root / 'requirements.txt'
        if requirements_txt_path.exists():
            legacy_deps.extend(self._scan_requirements_txt(requirements_txt_path))

        # Scan other package managers
        legacy_deps.extend(self._scan_other_package_managers())

        return legacy_deps

    def _scan_package_json(self, package_json_path: Path) -> List[LegacyItem]:
        """Scan package.json for deprecated/unused libraries"""
        legacy_deps = []

        try:
            with open(package_json_path, 'r') as f:
                package_data = json.load(f)

            dependencies = {**package_data.get('dependencies', {}),
                          **package_data.get('devDependencies', {})}

            # Check for usage in codebase
            usage_map = self._map_library_usage(dependencies.keys())

            for lib_name, version in dependencies.items():
                if lib_name in self.protected_packages:
                    continue

                is_deprecated = False
                reasons = []

                # Check against deprecated libraries database
                if lib_name in self.deprecated_libraries.get('javascript', {}):
                    dep_info = self.deprecated_libraries['javascript'][lib_name]
                    if dep_info.get('deprecated', False):
                        is_deprecated = True
                        reasons.append(f"Deprecated: {dep_info['reason']}")

                # Check for legacy frameworks
                if any(framework in lib_name.lower() for framework in self.legacy_frameworks):
                    is_deprecated = True
                    reasons.append(f"Legacy framework: {lib_name}")

                # Check for usage
                usage_count = usage_map.get(lib_name, 0)
                last_used = self._get_last_usage_date(lib_name)

                # Calculate risk score
                risk_score = self._calculate_dependency_risk(
                    lib_name, is_deprecated, usage_count, last_used
                )

                if risk_score > 0.3 or is_deprecated:  # Only include items with moderate+ risk
                    action = self._suggest_dependency_action(risk_score, is_deprecated, usage_count)

                    legacy_item = LegacyItem(
                        type='library',
                        path=f"package.json:{lib_name}",
                        name=lib_name,
                        last_reference=last_used or 'unknown',
                        last_updated=self._get_package_last_updated(lib_name),
                        risk_score=risk_score,
                        size_kb=self._estimate_package_size(lib_name),
                        dependencies=[],
                        suggested_action=action,
                        evidence=[f"Version: {version}", f"Used in {usage_count} files"],
                        legacy_reasons=reasons
                    )
                    legacy_deps.append(legacy_item)

        except Exception as e:
            print(f"Error scanning package.json: {e}")

        return legacy_deps

    def _scan_requirements_txt(self, requirements_path: Path) -> List[LegacyItem]:
        """Scan requirements.txt for deprecated Python packages"""
        legacy_deps = []

        try:
            with open(requirements_path, 'r') as f:
                requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

            for req in requirements:
                lib_name = req.split('==')[0].split('>=')[0].split('<=')[0].strip()

                if lib_name in self.protected_packages:
                    continue

                is_deprecated = False
                reasons = []

                # Check against deprecated libraries database
                if lib_name in self.deprecated_libraries.get('python', {}):
                    dep_info = self.deprecated_libraries['python'][lib_name]
                    if dep_info.get('deprecated', False):
                        is_deprecated = True
                        reasons.append(f"Deprecated: {dep_info['reason']}")

                # Usage analysis
                usage_count = self._count_python_imports(lib_name)
                last_used = self._get_last_usage_date(lib_name, file_pattern=f"*.py")

                risk_score = self._calculate_dependency_risk(
                    lib_name, is_deprecated, usage_count, last_used
                )

                if risk_score > 0.3 or is_deprecated:
                    action = self._suggest_dependency_action(risk_score, is_deprecated, usage_count)

                    legacy_item = LegacyItem(
                        type='library',
                        path=f"requirements.txt:{lib_name}",
                        name=lib_name,
                        last_reference=last_used or 'unknown',
                        last_updated=self._get_package_last_updated(lib_name, 'python'),
                        risk_score=risk_score,
                        size_kb=self._estimate_package_size(lib_name, 'python'),
                        dependencies=[],
                        suggested_action=action,
                        evidence=[f"Requirement: {req}", f"Used in {usage_count} Python files"],
                        legacy_reasons=reasons
                    )
                    legacy_deps.append(legacy_item)

        except Exception as e:
            print(f"Error scanning requirements.txt: {e}")

        return legacy_deps

    def detect_legacy_directories(self) -> List[LegacyItem]:
        """Detect abandoned/orphaned directories"""
        print("📁 Scanning for legacy directories...")

        legacy_dirs = []

        try:
            repo = git.Repo(self.project_root)

            for root, dirs, files in os.walk(self.project_root):
                # Skip excluded paths
                root_path = Path(root)
                if any(excluded in str(root_path) for excluded in self.excluded_paths):
                    continue

                # Check each directory
                for dir_name in dirs[:]:  # Slice to avoid modification during iteration
                    dir_path = root_path / dir_name

                    # Skip if in excluded paths
                    if any(excluded in str(dir_path) for excluded in self.excluded_paths):
                        continue

                    # Check for safe folder patterns
                    is_legacy_pattern = any(pattern.match(str(dir_path.relative_to(self.project_root)))
                                          for pattern in self.safe_folder_patterns)

                    # Get last commit date
                    try:
                        last_commit = next(repo.iter_commits(paths=dir_path, max_count=1))
                        last_updated = last_commit.committed_datetime
                        days_since_update = (datetime.now() - last_updated.replace(tzinfo=None)).days
                    except:
                        last_updated = datetime.now() - timedelta(days=365)
                        days_since_update = 365

                    # Calculate directory size
                    dir_size = self._calculate_directory_size(dir_path)

                    # Count files in directory
                    file_count = len([f for f in dir_path.rglob('*') if f.is_file()])

                    # Risk assessment
                    reasons = []
                    if is_legacy_pattern:
                        reasons.append(f"Matches legacy pattern: {dir_path.name}")
                    if days_since_update > self.min_years_untouched * 365:
                        reasons.append(f"Untouched for {days_since_update // 365} years")
                    if file_count == 0:
                        reasons.append("Empty directory")

                    risk_score = self._calculate_directory_risk(
                        is_legacy_pattern, days_since_update, file_count, dir_size
                    )

                    if risk_score > 0.3:  # Only include moderate+ risk
                        action = self._suggest_directory_action(risk_score, file_count, days_since_update)

                        legacy_item = LegacyItem(
                            type='directory',
                            path=str(dir_path.relative_to(self.project_root)),
                            name=dir_name,
                            last_reference=last_updated.strftime('%Y-%m-%d'),
                            last_updated=last_updated.strftime('%Y-%m-%d'),
                            risk_score=risk_score,
                            size_kb=dir_size / 1024,
                            dependencies=[],
                            suggested_action=action,
                            evidence=[f"{file_count} files", f"{dir_size / 1024:.1f} KB"],
                            legacy_reasons=reasons
                        )
                        legacy_dirs.append(legacy_item)

        except Exception as e:
            print(f"Error scanning directories: {e}")

        return legacy_dirs

    def detect_legacy_files(self) -> List[LegacyItem]:
        """Detect individual legacy files"""
        print("📄 Scanning for legacy files...")

        legacy_files = []

        try:
            repo = git.Repo(self.project_root)

            for file_path in self.project_root.rglob('*'):
                if not file_path.is_file():
                    continue

                # Skip excluded paths and binary files
                if any(excluded in str(file_path) for excluded in self.excluded_paths):
                    continue

                if not any(file_path.suffix == ext for ext in self.config.get('scan_file_types', [])):
                    continue

                # Check for legacy patterns in filename
                legacy_indicators = ['legacy', 'old', 'deprecated', 'backup', 'bak', 'v1', 'v2']
                file_name = file_path.name.lower()

                is_legacy_name = any(indicator in file_name for indicator in legacy_indicators)

                # Get last commit date
                try:
                    last_commit = next(repo.iter_commits(paths=file_path, max_count=1))
                    last_updated = last_commit.committed_datetime
                    days_since_update = (datetime.now() - last_updated.replace(tzinfo=None)).days
                except:
                    days_since_update = 365

                # Scan file content for legacy markers
                content_markers = self._scan_file_for_legacy_markers(file_path)

                reasons = []
                if is_legacy_name:
                    reasons.append(f"Filename contains legacy indicator: {file_name}")
                if content_markers:
                    reasons.extend([f"Content: {marker}" for marker in content_markers])
                if days_since_update > self.min_years_untouched * 365:
                    reasons.append(f"File untouched for {days_since_update // 365} years")

                # Risk assessment
                risk_score = self._calculate_file_risk(
                    is_legacy_name, len(content_markers), days_since_update, file_path
                )

                if risk_score > 0.3:  # Only include moderate+ risk
                    action = self._suggest_file_action(risk_score, content_markers, days_since_update)

                    legacy_item = LegacyItem(
                        type='file',
                        path=str(file_path.relative_to(self.project_root)),
                        name=file_path.name,
                        last_reference=self._get_file_last_reference(file_path),
                        last_updated=last_updated.strftime('%Y-%m-%d'),
                        risk_score=risk_score,
                        size_kb=file_path.stat().st_size / 1024,
                        dependencies=self._get_file_dependencies(file_path),
                        suggested_action=action,
                        evidence=[f"Size: {file_path.stat().st_size} bytes"],
                        legacy_reasons=reasons
                    )
                    legacy_files.append(legacy_item)

        except Exception as e:
            print(f"Error scanning files: {e}")

        return legacy_files

    def detect_legacy_configs(self) -> List[LegacyItem]:
        """Detect legacy configuration files and build tools"""
        print("⚙️ Scanning for legacy configurations...")

        legacy_configs = []

        # Known legacy config files
        legacy_config_files = {
            'Gruntfile.js': 'Legacy Grunt build system',
            'gulpfile.js': 'Legacy Gulp build system',
            '.travis.yml': 'Travis CI (deprecated)',
            'bower.json': 'Bower package manager (deprecated)',
            'Jenkinsfile': 'Jenkins (consider modern alternatives)',
            '.bowerrc': 'Bower configuration (deprecated)',
            'karma.conf.js': 'Legacy Karma configuration (consider Vitest)',
            'protractor.conf.js': 'Legacy Protractor e2e tests'
        }

        for config_file, reason in legacy_config_files.items():
            config_path = self.project_root / config_file
            if config_path.exists():
                try:
                    repo = git.Repo(self.project_root)
                    last_commit = next(repo.iter_commits(paths=config_path, max_count=1))
                    last_updated = last_commit.committed_datetime

                    legacy_item = LegacyItem(
                        type='config',
                        path=config_file,
                        name=config_file,
                        last_reference=last_updated.strftime('%Y-%m-%d'),
                        last_updated=last_updated.strftime('%Y-%m-%d'),
                        risk_score=0.8,  # High risk for build tools
                        size_kb=config_path.stat().st_size / 1024,
                        dependencies=[],
                        suggested_action='Review and migrate to modern alternative',
                        evidence=[f"Legacy configuration: {reason}"],
                        legacy_reasons=[reason]
                    )
                    legacy_configs.append(legacy_item)

                except Exception as e:
                    print(f"Error processing {config_file}: {e}")

        return legacy_configs

    def _map_library_usage(self, libraries: Set[str]) -> Dict[str, int]:
        """Map how many files use each library"""
        usage_map = {lib: 0 for lib in libraries}

        try:
            for file_path in self.project_root.rglob('*'):
                if not file_path.is_file():
                    continue

                if file_path.suffix not in ['.js', '.ts', '.jsx', '.tsx']:
                    continue

                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    for lib in libraries:
                        # Check for import/require statements
                        patterns = [
                            f'import.*from.*{lib}',
                            f"require\\(['\"]{lib}",
                            f"import.*{lib}",
                            f'from ["\']{lib}',
                            f'\\b{lib}\\.'  # Global usage
                        ]

                        for pattern in patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                usage_map[lib] += 1
                                break

                except Exception:
                    continue

        except Exception as e:
            print(f"Error mapping library usage: {e}")

        return usage_map

    def _calculate_dependency_risk(self, lib_name: str, is_deprecated: bool, usage_count: int, last_used: str) -> float:
        """Calculate risk score for a dependency"""
        risk = 0.0

        # Base risk for deprecated libraries
        if is_deprecated:
            risk += 0.6

        # Usage-based risk
        if usage_count == 0:
            risk += 0.4  # High risk for unused
        elif usage_count <= 2:
            risk += 0.2  # Moderate risk for minimal usage

        # Time-based risk
        if last_used and last_used != 'unknown':
            try:
                last_date = datetime.strptime(last_used.split()[0], '%Y-%m-%d')
                days_unused = (datetime.now() - last_date).days
                if days_unused > 365:
                    risk += 0.3 * min(days_unused / 365, 3)  # Max 0.9 for 3+ years
            except:
                pass

        return min(risk, 1.0)

    def _calculate_directory_risk(self, is_legacy_pattern: bool, days_since_update: int, file_count: int, size_kb: int) -> float:
        """Calculate risk score for a directory"""
        risk = 0.0

        # Pattern-based risk
        if is_legacy_pattern:
            risk += 0.5

        # Time-based risk
        if days_since_update > 365 * 2:  # 2+ years
            risk += 0.4
        elif days_since_update > 365:  # 1+ year
            risk += 0.2

        # Content-based risk
        if file_count == 0:
            risk += 0.6  # Empty directories
        elif file_count <= 5 and size_kb < 100:
            risk += 0.3  # Small, likely dead

        return min(risk, 1.0)

    def _calculate_file_risk(self, is_legacy_name: bool, content_markers: int, days_since_update: int, file_path: Path) -> float:
        """Calculate risk score for a file"""
        risk = 0.0

        # Name-based risk
        if is_legacy_name:
            risk += 0.4

        # Content marker risk
        risk += content_markers * 0.2

        # Time-based risk
        if days_since_update > 365 * 2:  # 2+ years
            risk += 0.4
        elif days_since_update > 365:  # 1+ year
            risk += 0.2

        return min(risk, 1.0)

    def _suggest_dependency_action(self, risk_score: float, is_deprecated: bool, usage_count: int) -> str:
        """Suggest action for a dependency"""
        if is_deprecated and usage_count == 0:
            return "Remove immediately (deprecated and unused)"
        elif usage_count == 0:
            return "Remove (unused)"
        elif is_deprecated:
            return "Migrate to modern replacement"
        elif risk_score > 0.7:
            return "Review and consider removal"
        else:
            return "Monitor usage"

    def _suggest_directory_action(self, risk_score: float, file_count: int, days_since_update: int) -> str:
        """Suggest action for a directory"""
        if file_count == 0:
            return "Remove (empty directory)"
        elif risk_score > 0.7:
            return "Review for possible removal"
        elif days_since_update > 365 * 2:
            return "Archive if not needed"
        else:
            return "Monitor activity"

    def _suggest_file_action(self, risk_score: float, content_markers: List[str], days_since_update: int) -> str:
        """Suggest action for a file"""
        if days_since_update > 365 * 2 and risk_score > 0.6:
            return "Archive or remove"
        elif content_markers:
            return "Review and update"
        elif risk_score > 0.7:
            return "Consider removal"
        else:
            return "Monitor or document purpose"

    def _scan_file_for_legacy_markers(self, file_path: Path) -> List[str]:
        """Scan file content for legacy markers"""
        markers = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            legacy_patterns = [
                r'(TODO|FIXME|HACK).*remove',
                r'deprecated',
                r'legacy',
                r'old.*code',
                r'temporar(y|ily)',
                r'cleanup.*required',
                r'refactor.*needed'
            ]

            for pattern in legacy_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    markers.append(pattern)

        except Exception:
            pass

        return markers

    def _calculate_directory_size(self, dir_path: Path) -> int:
        """Calculate total size of directory in bytes"""
        total_size = 0
        try:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except Exception:
            pass
        return total_size

    def _get_package_last_updated(self, package_name: str, language: str = 'javascript') -> str:
        """Get last update date for a package (simplified)"""
        # In a real implementation, this would query npm, PyPI, etc.
        return "2023-01-01"  # Placeholder

    def _estimate_package_size(self, package_name: str, language: str = 'javascript') -> float:
        """Estimate package size in KB"""
        # In a real implementation, this would query package registries
        return 50.0  # Placeholder estimate

    def _count_python_imports(self, lib_name: str) -> int:
        """Count Python imports for a library"""
        count = 0
        try:
            for py_file in self.project_root.rglob('*.py'):
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if f'import {lib_name}' in content or f'from {lib_name}' in content:
                        count += 1
                except Exception:
                    continue
        except Exception:
            pass
        return count

    def _get_last_usage_date(self, lib_name: str, file_pattern: str = None) -> str:
        """Get last date a library was used"""
        # Simplified implementation
        try:
            repo = git.Repo(self.project_root)
            latest_commit = None

            for commit in repo.iter_commits('--all', max_count=100):
                try:
                    diff = commit.diff(commit.parents[0] if commit.parents else None, create_patch=True)
                    for change in diff:
                        if lib_name in change.diff.decode('utf-8', errors='ignore'):
                            latest_commit = commit
                            break
                except Exception:
                    continue

                if latest_commit:
                    break

            if latest_commit:
                return latest_commit.committed_datetime.strftime('%Y-%m-%d')
        except Exception:
            pass

        return 'unknown'

    def _get_file_last_reference(self, file_path: Path) -> str:
        """Get last date a file was referenced in other files"""
        try:
            repo = git.Repo(self.project_root)
            latest_commit = None

            for commit in repo.iter_commits('--all', max_count=50):
                try:
                    diff = commit.diff(commit.parents[0] if commit.parents else None, create_patch=True)
                    for change in diff:
                        if file_path.name in change.diff.decode('utf-8', errors='ignore'):
                            latest_commit = commit
                            break
                except Exception:
                    continue

                if latest_commit:
                    break

            if latest_commit:
                return latest_commit.committed_datetime.strftime('%Y-%m-%d')
        except Exception:
            pass

        return 'unknown'

    def _get_file_dependencies(self, file_path: Path) -> List[str]:
        """Get dependencies for a specific file"""
        dependencies = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract import/require statements
            if file_path.suffix in ['.js', '.ts', '.jsx', '.tsx']:
                import_pattern = r'(?:import.*from\s+["\']([^"\']+)["\']|require\(["\']([^"\']+)["\'])'
                matches = re.findall(import_pattern, content)
                for match in matches:
                    dep = match[0] or match[1]
                    dependencies.append(dep)

            elif file_path.suffix == '.py':
                import_pattern = r'(?:import\s+(\w+)|from\s+(\w+)\s+import)'
                matches = re.findall(import_pattern, content)
                for match in matches:
                    dep = match[0] or match[1]
                    dependencies.append(dep)

        except Exception:
            pass

        return dependencies

    def _scan_other_package_managers(self) -> List[LegacyItem]:
        """Scan other package manager files (Maven, Gradle, etc.)"""
        legacy_deps = []

        # Maven pom.xml
        pom_path = self.project_root / 'pom.xml'
        if pom_path.exists():
            # Implementation for Maven dependency scanning
            pass

        # Gradle build.gradle
        gradle_path = self.project_root / 'build.gradle'
        if gradle_path.exists():
            # Implementation for Gradle dependency scanning
            pass

        return legacy_deps

    def run_full_scan(self) -> List[LegacyItem]:
        """Run complete legacy detection scan"""
        print("🚀 Starting comprehensive legacy detection scan...")
        print(f"Project root: {self.project_root}")

        all_legacy_items = []

        # Run all detection methods
        all_legacy_items.extend(self.detect_legacy_dependencies())
        all_legacy_items.extend(self.detect_legacy_directories())
        all_legacy_items.extend(self.detect_legacy_files())
        all_legacy_items.extend(self.detect_legacy_configs())

        # Sort by risk score (highest first)
        all_legacy_items.sort(key=lambda x: x.risk_score, reverse=True)

        self.legacy_items = all_legacy_items
        print(f"✅ Scan complete: Found {len(all_legacy_items)} legacy items")

        return all_legacy_items

    def generate_inventory_csv(self, output_path: str = 'legacy-inventory.csv'):
        """Generate CSV inventory of all legacy items"""
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Type', 'Path', 'Name', 'Last Reference', 'Last Updated',
                'Risk Score', 'Size (KB)', 'Suggested Action', 'Legacy Reasons'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for item in self.legacy_items:
                writer.writerow({
                    'Type': item.type,
                    'Path': item.path,
                    'Name': item.name,
                    'Last Reference': item.last_reference,
                    'Last Updated': item.last_updated,
                    'Risk Score': f"{item.risk_score:.2f}",
                    'Size (KB)': f"{item.size_kb:.1f}",
                    'Suggested Action': item.suggested_action,
                    'Legacy Reasons': '; '.join(item.legacy_reasons)
                })

        print(f"📄 Inventory saved to: {output_path}")

    def generate_directory_tree(self, output_path: str = 'legacy-directories.tree'):
        """Generate hierarchical view of legacy directories"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Legacy Directories Tree\n\n")

            dir_items = [item for item in self.legacy_items if item.type == 'directory']

            for item in sorted(dir_items, key=lambda x: x.path):
                indent_level = item.path.count('/')
                indent = '  ' * indent_level
                f.write(f"{indent}📁 {item.name} (Risk: {item.risk_score:.2f}, Size: {item.size_kb:.1f}KB)\n")
                f.write(f"{indent}   └─ {item.suggested_action}\n")

        print(f"🌳 Directory tree saved to: {output_path}")

    def generate_summary_report(self, output_path: str = 'legacy-summary.json'):
        """Generate summary report with statistics"""
        summary = {
            'scan_date': datetime.now().isoformat(),
            'total_items': len(self.legacy_items),
            'by_type': {},
            'by_risk': {
                'high_risk': len([i for i in self.legacy_items if i.risk_score > 0.7]),
                'medium_risk': len([i for i in self.legacy_items if 0.3 < i.risk_score <= 0.7]),
                'low_risk': len([i for i in self.legacy_items if i.risk_score <= 0.3])
            },
            'total_size_kb': sum(item.size_kb for item in self.legacy_items),
            'recommended_actions': {
                'remove_immediately': len([i for i in self.legacy_items if 'remove immediately' in i.suggested_action.lower()]),
                'review_required': len([i for i in self.legacy_items if 'review' in i.suggested_action.lower()]),
                'migrate_required': len([i for i in self.legacy_items if 'migrate' in i.suggested_action.lower()])
            }
        }

        # Count by type
        for item in self.legacy_items:
            summary['by_type'][item.type] = summary['by_type'].get(item.type, 0) + 1

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        print(f"📊 Summary report saved to: {output_path}")

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Detect legacy code and dependencies")
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--output-dir', default='.', help='Output directory for reports')
    parser.add_argument('--focus', help='Focus on specific types: dependencies,dirs,files,configs')

    args = parser.parse_args()

    # Initialize detector
    detector = LegacyDetector(args.config)

    # Run scan
    if args.focus:
        if args.focus == 'dependencies':
            legacy_items = detector.detect_legacy_dependencies()
        elif args.focus == 'dirs':
            legacy_items = detector.detect_legacy_directories()
        elif args.focus == 'files':
            legacy_items = detector.detect_legacy_files()
        elif args.focus == 'configs':
            legacy_items = detector.detect_legacy_configs()
        else:
            print(f"Unknown focus area: {args.focus}")
            sys.exit(1)
    else:
        legacy_items = detector.run_full_scan()

    # Generate reports
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)

    if legacy_items:
        detector.legacy_items = legacy_items
        detector.generate_inventory_csv(output_dir / 'legacy-inventory.csv')
        detector.generate_directory_tree(output_dir / 'legacy-directories.tree')
        detector.generate_summary_report(output_dir / 'legacy-summary.json')

        # Print summary
        print(f"\n📋 Scan Summary:")
        print(f"   Total legacy items found: {len(legacy_items)}")
        print(f"   High risk items: {len([i for i in legacy_items if i.risk_score > 0.7])}")
        print(f"   Total size: {sum(i.size_kb for i in legacy_items):.1f} KB")
        print(f"   Reports saved to: {output_dir}")
    else:
        print("✅ No legacy items found!")

if __name__ == '__main__':
    main()