#!/usr/bin/env python3
"""
Phase 1: Component Discovery & Inventory
Scans codebase for components and generates comprehensive inventory
"""

import os
import sys
import json
import csv
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import yaml
import git

@dataclass
class ComponentInfo:
    """Represents a discovered UI component"""
    name: str
    path: str
    framework: str
    file_type: str
    has_story: bool
    story_path: Optional[str]
    last_modified: datetime
    file_size: int
    props_count: int
    events_count: int
    complexity_score: float
    usage_count: int
    code_owner: Optional[str]
    priority: str
    atomic_type: Optional[str]  # atom, molecule, organism, template, page
    design_link: Optional[str]
    metadata: Dict[str, Any]

class ComponentDiscovery:
    def __init__(self, config_path: str = None):
        self.project_root = Path.cwd()
        self.config = self._load_config(config_path)
        self.components = []
        self.framework_handlers = {
            'react': ReactComponentHandler(),
            'vue': VueComponentHandler(),
            'svelte': SvelteComponentHandler(),
            'web-components': WebComponentHandler()
        }

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from file"""
        default_config = {
            'discovery': {
                'component_paths': [
                    'src/components/**/*',
                    'lib/components/**/*',
                    'components/**/*'
                ],
                'story_paths': [
                    'src/**/*.stories.*',
                    'stories/**/*',
                    '*.stories.*'
                ],
                'ignore_patterns': [
                    '*.test.*',
                    '*.spec.*',
                    'node_modules/**',
                    '.git/**',
                    'dist/**',
                    'build/**'
                ],
                'framework_detection': True
            },
            'classification': {
                'atomic_design': True,
                'folder_based_classification': True,
                'naming_convention_detection': True
            },
            'priority_rules': {
                'high_usage_threshold': 10,
                'complex_components': ['Modal', 'Form', 'DataTable', 'DatePicker'],
                'essential_patterns': ['Button', 'Input', 'Card', 'Layout']
            }
        }

        if config_path and Path(config_path).exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Warning: Could not load config file {config_path}: {e}")

        return default_config

    def discover_components(self) -> List[ComponentInfo]:
        """Main discovery method"""
        print("🔍 Discovering components...")
        print(f"Project root: {self.project_root}")

        # Discover component files
        component_files = self._find_component_files()
        print(f"Found {len(component_files)} potential component files")

        # Process each component file
        for file_path in component_files:
            try:
                component = self._analyze_component_file(file_path)
                if component:
                    self.components.append(component)
            except Exception as e:
                print(f"  Error analyzing {file_path}: {e}")

        # Analyze usage and update metadata
        self._analyze_component_usage()
        self._assign_priorities()
        self._classify_atomic_types()

        print(f"✅ Discovered {len(self.components)} components")
        return self.components

    def _find_component_files(self) -> List[Path]:
        """Find all potential component files"""
        component_files = []

        for pattern in self.config['discovery']['component_paths']:
            try:
                files = self.project_root.glob(pattern)
                for file_path in files:
                    if file_path.is_file() and self._is_component_file(file_path):
                        if not self._should_ignore_file(file_path):
                            component_files.append(file_path)
            except Exception as e:
                print(f"  Error processing pattern {pattern}: {e}")

        return list(set(component_files))  # Remove duplicates

    def _is_component_file(self, file_path: Path) -> bool:
        """Determine if a file is likely a UI component"""
        extensions = ['.tsx', '.jsx', '.vue', '.svelte', '.ts', '.js']

        if file_path.suffix not in extensions:
            return False

        # Check if it's likely a UI component vs utility file
        ui_indicators = [
            'Component', 'component',
            'Button', 'Input', 'Modal', 'Card', 'Layout', 'Header', 'Footer',
            'Nav', 'Sidebar', 'Form', 'Table', 'List', 'Grid', 'Container',
            'Popup', 'Dialog', 'Tooltip', 'Dropdown', 'Menu', 'Tabs', 'Accordion'
        ]

        filename = file_path.stem
        filename_lower = filename.lower()

        # Check filename for UI indicators
        if any(indicator.lower() in filename_lower for indicator in ui_indicators):
            return True

        # Check directory structure
        parent_dirs = [part.lower() for part in file_path.parts]
        if 'components' in parent_dirs or 'ui' in parent_dirs:
            return True

        # Check file content for React/Vue exports
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read(2000)  # Read first 2KB

            # Look for component exports
            if file_path.suffix in ['.tsx', '.jsx', '.ts', '.js']:
                return (
                    'export default' in content and
                    ('React' in content or 'Component' in content or '<' in content and '>' in content)
                )
            elif file_path.suffix == '.vue':
                return '<template>' in content and '<script>' in content
            elif file_path.suffix == '.svelte':
                return '<script>' in content and ('<' in content and '>' in content)

        except Exception:
            pass

        return False

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored based on patterns"""
        ignore_patterns = self.config['discovery']['ignore_patterns']
        file_str = str(file_path)

        for pattern in ignore_patterns:
            if pattern in file_str or file_path.match(pattern):
                return True

        # Ignore files with test indicators in name
        test_indicators = ['test', 'spec', 'mock', 'fixture', 'example']
        if any(indicator in file_path.name.lower() for indicator in test_indicators):
            return True

        return False

    def _analyze_component_file(self, file_path: Path) -> Optional[ComponentInfo]:
        """Analyze a component file and extract metadata"""
        try:
            # Determine framework
            framework = self._detect_framework(file_path)

            # Get framework handler
            handler = self.framework_handlers.get(framework)
            if not handler:
                return None

            # Extract component information
            metadata = handler.extract_metadata(file_path, self.project_root)

            # Check for existing story
            story_info = self._find_story_file(file_path)

            # Get file metadata
            stat = file_path.stat()

            # Determine atomic type
            atomic_type = self._classify_atomic_type(file_path)

            return ComponentInfo(
                name=metadata.get('name', file_path.stem),
                path=str(file_path.relative_to(self.project_root)),
                framework=framework,
                file_type=file_path.suffix,
                has_story=story_info['exists'],
                story_path=story_info['path'] if story_info['exists'] else None,
                last_modified=datetime.fromtimestamp(stat.st_mtime),
                file_size=stat.st_size,
                props_count=len(metadata.get('props', [])),
                events_count=len(metadata.get('events', [])),
                complexity_score=self._calculate_complexity(metadata),
                usage_count=0,  # Will be calculated later
                code_owner=self._get_code_owner(file_path),
                priority='medium',  # Will be assigned later
                atomic_type=atomic_type,
                design_link=metadata.get('design_link'),
                metadata=metadata
            )

        except Exception as e:
            print(f"  Error analyzing {file_path}: {e}")
            return None

    def _detect_framework(self, file_path: Path) -> str:
        """Detect which framework a component uses"""
        extension = file_path.suffix

        if extension in ['.tsx', '.jsx']:
            return 'react'
        elif extension == '.vue':
            return 'vue'
        elif extension == '.svelte':
            return 'svelte'
        elif extension in ['.ts', '.js']:
            # Check content for framework indicators
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read(1000)  # Read first 1KB

                if 'Vue' in content or '@vue' in content:
                    return 'vue'
                elif 'React' in content or 'ReactComponent' in content:
                    return 'react'
                elif 'customElements' in content or 'HTMLElement' in content:
                    return 'web-components'
                else:
                    return 'react'  # Default assumption
            except Exception:
                return 'react'  # Default assumption

        return 'unknown'

    def _find_story_file(self, component_path: Path) -> Dict[str, Any]:
        """Find corresponding story file for a component"""
        component_name = component_path.stem
        component_dir = component_path.parent

        # Story file patterns to check
        story_patterns = [
            component_dir / f"{component_name}.stories.tsx",
            component_dir / f"{component_name}.stories.jsx",
            component_dir / f"{component_name}.stories.ts",
            component_dir / f"{component_name}.stories.js",
            component_dir / f"{component_name}.stories.mdx",
            component_dir / f"{component_name}.story.tsx",
            component_dir / f"{component_name}.story.jsx",
            self.project_root / "stories" / f"{component_name}.stories.tsx",
            self.project_root / "stories" / f"{component_name}.stories.jsx",
        ]

        for story_path in story_patterns:
            if story_path.exists():
                return {
                    'exists': True,
                    'path': str(story_path.relative_to(self.project_root))
                }

        return {'exists': False, 'path': None}

    def _classify_atomic_type(self, file_path: Path) -> Optional[str]:
        """Classify component according to atomic design"""
        path_parts = [part.lower() for part in file_path.parts]
        filename = file_path.stem.lower()

        # Atoms (smallest indivisible elements)
        atom_patterns = ['atoms', 'atom', 'elements', 'base']
        atom_components = ['button', 'input', 'label', 'icon', 'avatar', 'badge']

        if any(pattern in path_parts for pattern in atom_patterns):
            return 'atom'
        if any(comp in filename for comp in atom_components):
            return 'atom'

        # Molecules (simple groups of atoms)
        molecule_patterns = ['molecules', 'molecule']
        molecule_components = ['form', 'card', 'modal', 'tooltip', 'dropdown', 'search']

        if any(pattern in path_parts for pattern in molecule_patterns):
            return 'molecule'
        if any(comp in filename for comp in molecule_components):
            return 'molecule'

        # Organisms (complex UI sections)
        organism_patterns = ['organisms', 'organism']
        organism_components = ['header', 'footer', 'sidebar', 'navbar', 'layout', 'table']

        if any(pattern in path_parts for pattern in organism_patterns):
            return 'organism'
        if any(comp in filename for comp in organism_components):
            return 'organism'

        # Templates (page layouts)
        template_patterns = ['templates', 'template', 'layouts', 'layout']
        template_components = ['page', 'template', 'layout']

        if any(pattern in path_parts for pattern in template_patterns):
            return 'template'
        if any(comp in filename for comp in template_components):
            return 'template'

        # Pages (specific instances)
        page_patterns = ['pages', 'page', 'views', 'view']

        if any(pattern in path_parts for pattern in page_patterns):
            return 'page'

        return None  # Could not classify

    def _calculate_complexity(self, metadata: Dict[str, Any]) -> float:
        """Calculate complexity score for a component"""
        complexity = 0.0

        # Props complexity
        props = metadata.get('props', [])
        props_complexity = min(len(props) * 0.1, 1.0)
        complexity += props_complexity * 0.3

        # Events complexity
        events = metadata.get('events', [])
        events_complexity = min(len(events) * 0.2, 1.0)
        complexity += events_complexity * 0.2

        # Methods complexity
        methods = metadata.get('methods', [])
        methods_complexity = min(len(methods) * 0.1, 1.0)
        complexity += methods_complexity * 0.2

        # JSX/Template complexity
        template_lines = metadata.get('template_lines', 0)
        template_complexity = min(template_lines / 100, 1.0)
        complexity += template_complexity * 0.2

        # Dependencies complexity
        imports = metadata.get('imports', [])
        deps_complexity = min(len(imports) * 0.05, 1.0)
        complexity += deps_complexity * 0.1

        return min(complexity, 1.0)

    def _get_code_owner(self, file_path: Path) -> Optional[str]:
        """Get code owner from git blame or file headers"""
        try:
            # Try git blame to find main contributor
            repo = git.Repo(self.project_root)
            blame_output = repo.git.blame(str(file_path), line_range='1,1')

            # Extract author from blame output
            if '(' in blame_output:
                author_part = blame_output.split('(')[1].split(')')[0]
                author = author_part.strip().split()[-1]
                return author if author and author != 'Not' else None
        except Exception:
            pass

        # Try to extract from file header
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_lines = [f.readline().strip() for _ in range(5)]

            for line in first_lines:
                if '@author' in line or 'Author:' in line:
                    # Extract author name
                    author_match = re.search(r'@author\s+(.+)|Author:\s+(.+)', line)
                    if author_match:
                        return author_match.group(1) or author_match.group(2)
        except Exception:
            pass

        return None

    def _analyze_component_usage(self):
        """Analyze how often components are used in the codebase"""
        print("📊 Analyzing component usage...")

        # Build usage map
        for component in self.components:
            component_name = component.name
            component.import_names = self._get_component_import_names(component)
            component.usage_count = self._count_component_usages(component)

    def _get_component_import_names(self, component: ComponentInfo) -> Set[str]:
        """Get all possible import names for a component"""
        names = set()

        # Primary name
        names.add(component.name)

        # Common variations
        if component.name.endswith('Component'):
            names.add(component.name[:-9])  # Remove 'Component'

        # Case variations
        names.update([name.lower() for name in names])
        names.update([name.upper() for name in names])

        return names

    def _count_component_usages(self, component: ComponentInfo) -> int:
        """Count how many times a component is used"""
        if not hasattr(component, 'import_names'):
            component.import_names = set([component.name])

        usage_count = 0

        try:
            # Search through source files
            source_extensions = ['.tsx', '.jsx', '.vue', '.ts', '.js']

            for ext in source_extensions:
                for file_path in self.project_root.rglob(f"*{ext}"):
                    if self._should_ignore_file(file_path):
                        continue

                    if file_path.samefile(Path(component.path)):
                        continue  # Skip the component file itself

                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # Check for component usage patterns
                        for import_name in component.import_names:
                            # JSX usage
                            if f"<{import_name}" in content:
                                usage_count += content.count(f"<{import_name}")

                            # Import usage
                            if f"import.*{import_name}" in content:
                                usage_count += 1

                            # React.createElement usage
                            if f"React.createElement.*{import_name}" in content:
                                usage_count += content.count(f"React.createElement.*{import_name}")

                    except Exception:
                        continue

        except Exception:
            pass

        return usage_count

    def _assign_priorities(self):
        """Assign priorities to components based on usage and complexity"""
        high_threshold = self.config['priority_rules']['high_usage_threshold']
        complex_components = set(self.config['priority_rules']['complex_components'])
        essential_patterns = self.config['priority_rules']['essential_patterns']

        for component in self.components:
            if component.name in complex_components:
                component.priority = 'high'
            elif any(pattern in component.name for pattern in essential_patterns):
                component.priority = 'high'
            elif component.usage_count > high_threshold:
                component.priority = 'high'
            elif component.usage_count > high_threshold // 2:
                component.priority = 'medium'
            else:
                component.priority = 'low'

    def generate_inventory_csv(self, output_path: str = 'storybook-inventory.csv'):
        """Generate CSV inventory of all components"""
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Component', 'Path', 'Framework', 'HasStory', 'StoryPath',
                'LastModified', 'FileSize', 'PropsCount', 'EventsCount',
                'ComplexityScore', 'UsageCount', 'CodeOwner', 'Priority',
                'AtomicType', 'DesignLink'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for component in sorted(self.components, key=lambda x: x.priority, reverse=True):
                writer.writerow({
                    'Component': component.name,
                    'Path': component.path,
                    'Framework': component.framework,
                    'HasStory': component.has_story,
                    'StoryPath': component.story_path or '',
                    'LastModified': component.last_modified.strftime('%Y-%m-%d %H:%M:%S'),
                    'FileSize': component.file_size,
                    'PropsCount': component.props_count,
                    'EventsCount': component.events_count,
                    'ComplexityScore': f"{component.complexity_score:.2f}",
                    'UsageCount': component.usage_count,
                    'CodeOwner': component.code_owner or '',
                    'Priority': component.priority,
                    'AtomicType': component.atomic_type or '',
                    'DesignLink': component.design_link or ''
                })

        print(f"📄 Inventory saved to: {output_path}")

    def generate_missing_stories_report(self, output_path: str = 'missing-stories-report.md'):
        """Generate report of components missing stories"""
        missing_components = [c for c in self.components if not c.has_story]
        outdated_components = [c for c in self.components if self._is_story_outdated(c)]

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Missing Stories Report\n\n")
            f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            # Summary
            total_components = len(self.components)
            documented_components = total_components - len(missing_components)
            coverage = (documented_components / total_components * 100) if total_components > 0 else 0

            f.write("## Summary\n\n")
            f.write(f"- **Total Components**: {total_components}\n")
            f.write(f"- **Documented Components**: {documented_components}\n")
            f.write(f"- **Missing Stories**: {len(missing_components)}\n")
            f.write(f"- **Coverage**: {coverage:.1f}%\n\n")

            if missing_components:
                f.write("## High Priority (Essential Components)\n\n")
                high_priority = [c for c in missing_components if c.priority == 'high']
                for component in sorted(high_priority, key=lambda x: x.usage_count, reverse=True):
                    f.write(f"- **{component.name}** (`{component.path}`)\n")
                    f.write(f"  - Framework: {component.framework}\n")
                    f.write(f"  - Usage: {component.usage_count} times\n")
                    f.write(f"  - Complexity: {component.complexity_score:.2f}\n")
                    f.write(f"  - Code Owner: {component.code_owner or 'Unknown'}\n\n")

                f.write("## Medium Priority\n\n")
                medium_priority = [c for c in missing_components if c.priority == 'medium']
                for component in sorted(medium_priority, key=lambda x: x.usage_count, reverse=True):
                    f.write(f"- **{component.name}** (`{component.path}`)\n")
                    f.write(f"  - Framework: {component.framework}\n")
                    f.write(f"  - Usage: {component.usage_count} times\n\n")

                f.write("## Low Priority\n\n")
                low_priority = [c for c in missing_components if c.priority == 'low']
                for component in sorted(low_priority, key=lambda x: x.usage_count, reverse=True):
                    f.write(f"- **{component.name}** (`{component.path}`)\n")

            if outdated_components:
                f.write("\n## Outdated Stories\n\n")
                for component in outdated_components:
                    f.write(f"- **{component.name}** - Story older than component\n")
                    f.write(f"  - Component: `{component.path}`\n")
                    f.write(f"  - Story: `{component.story_path}`\n\n")

        print(f"📋 Missing stories report saved to: {output_path}")

    def _is_story_outdated(self, component: ComponentInfo) -> bool:
        """Check if story is older than component"""
        if not component.has_story or not component.story_path:
            return False

        try:
            story_path = Path(component.story_path)
            if not story_path.exists():
                return True

            story_mtime = story_path.stat().st_mtime
            component_mtime = component.last_modified.timestamp()

            return story_mtime < component_mtime
        except Exception:
            return False

    def generate_component_update_map(self, output_path: str = 'component-update-map.json'):
        """Generate JSON mapping of components to their update status"""
        update_map = {
            'generated_at': datetime.now().isoformat(),
            'total_components': len(self.components),
            'frameworks': {},
            'atomic_types': {},
            'priority_distribution': {},
            'components': []
        }

        for component in self.components:
            component_data = {
                'name': component.name,
                'path': component.path,
                'framework': component.framework,
                'has_story': component.has_story,
                'story_path': component.story_path,
                'needs_story': not component.has_story,
                'story_outdated': self._is_story_outdated(component) if component.has_story else False,
                'priority': component.priority,
                'atomic_type': component.atomic_type,
                'complexity_score': component.complexity_score,
                'usage_count': component.usage_count,
                'last_modified': component.last_modified.isoformat(),
                'props_count': component.props_count,
                'events_count': component.events_count
            }

            update_map['components'].append(component_data)

            # Update statistics
            framework = component.framework
            update_map['frameworks'][framework] = update_map['frameworks'].get(framework, 0) + 1

            atomic_type = component.atomic_type or 'unclassified'
            update_map['atomic_types'][atomic_type] = update_map['atomic_types'].get(atomic_type, 0) + 1

            priority = component.priority
            update_map['priority_distribution'][priority] = update_map['priority_distribution'].get(priority, 0) + 1

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(update_map, f, indent=2)

        print(f"🗺️ Component update map saved to: {output_path}")

    def run_discovery(self) -> Dict[str, Any]:
        """Run complete discovery process"""
        print("🚀 Starting component discovery...")

        # Discover components
        self.discover_components()

        # Generate reports
        output_dir = Path('.')
        self.generate_inventory_csv(output_dir / 'storybook-inventory.csv')
        self.generate_missing_stories_report(output_dir / 'missing-stories-report.md')
        self.generate_component_update_map(output_dir / 'component-update-map.json')

        # Summary statistics
        total = len(self.components)
        with_stories = len([c for c in self.components if c.has_story])
        missing_stories = total - with_stories

        summary = {
            'total_components': total,
            'components_with_stories': with_stories,
            'missing_stories': missing_stories,
            'coverage_percentage': (with_stories / total * 100) if total > 0 else 0,
            'frameworks': list(set(c.framework for c in self.components)),
            'high_priority_components': len([c for c in self.components if c.priority == 'high'])
        }

        print(f"\n📊 Discovery Summary:")
        print(f"   Total components: {total}")
        print(f"   With stories: {with_stories}")
        print(f"   Missing stories: {missing_stories}")
        print(f"   Coverage: {summary['coverage_percentage']:.1f}%")
        print(f"   High priority components: {summary['high_priority_components']}")

        return summary


# Framework Handlers

class ReactComponentHandler:
    """Handler for React components"""

    def extract_metadata(self, file_path: Path, project_root: Path) -> Dict[str, Any]:
        """Extract metadata from React component"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            metadata = {
                'name': self._extract_component_name(content, file_path),
                'props': self._extract_props(content),
                'events': self._extract_events(content),
                'methods': self._extract_methods(content),
                'imports': self._extract_imports(content),
                'template_lines': self._count_jsx_lines(content),
                'design_link': self._extract_design_link(content)
            }

            return metadata

        except Exception as e:
            print(f"Error extracting React metadata: {e}")
            return {}

    def _extract_component_name(self, content: str, file_path: Path) -> str:
        """Extract component name from content"""
        # Try export default name
        export_match = re.search(r'export default\s+(?:function\s+)?(\w+)', content)
        if export_match:
            return export_match.group(1)

        # Try function name
        func_match = re.search(r'function\s+(\w+)', content)
        if func_match:
            return func_match.group(1)

        # Try class name
        class_match = re.search(r'class\s+(\w+).*extends.*Component', content)
        if class_match:
            return class_match.group(1)

        # Fallback to filename
        return file_path.stem

    def _extract_props(self, content: str) -> List[Dict[str, str]]:
        """Extract props from TypeScript interface or PropTypes"""
        props = []

        # TypeScript interface
        interface_match = re.search(r'interface\s+\w+Props\s*{([^}]+)}', content, re.DOTALL)
        if interface_match:
            interface_content = interface_match.group(1)
            prop_lines = [line.strip() for line in interface_content.split('\n') if line.strip()]

            for line in prop_lines:
                if ':' in line and not line.strip().startswith('//'):
                    prop_parts = line.split(':')
                    if len(prop_parts) >= 2:
                        prop_name = prop_parts[0].strip().replace('?', '')
                        prop_type = prop_parts[1].split(';')[0].strip()
                        props.append({'name': prop_name, 'type': prop_type})

        # PropTypes
        proptypes_match = re.search(r'\.propTypes\s*=\s*{([^}]+)}', content, re.DOTALL)
        if proptypes_match:
            proptypes_content = proptypes_match.group(1)
            prop_lines = [line.strip() for line in proptypes_content.split('\n') if line.strip()]

            for line in prop_lines:
                if ':' in line and not line.strip().startswith('//'):
                    prop_parts = line.split(':')
                    if len(prop_parts) >= 2:
                        prop_name = prop_parts[0].strip()
                        prop_type = prop_parts[1].split(',')[0].strip()
                        props.append({'name': prop_name, 'type': prop_type})

        return props

    def _extract_events(self, content: str) -> List[Dict[str, str]]:
        """Extract event handlers"""
        events = []

        # Look for on* props
        event_match = re.findall(r'(\w+):\s*\((.*?)\)\s*=>', content)
        for event_name, params in event_match:
            if event_name.startswith('on') or event_name.startswith('handle'):
                events.append({'name': event_name, 'params': params})

        return events

    def _extract_methods(self, content: str) -> List[str]:
        """Extract component methods"""
        methods = []

        # Arrow function methods
        method_match = re.findall(r'(\w+)\s*=\s*\([^)]*\)\s*=>', content)
        methods.extend(method_match)

        # Regular methods
        method_match = re.findall(r'^\s*(\w+)\s*\([^)]*\)\s*{', content, re.MULTILINE)
        methods.extend(method_match)

        return methods

    def _extract_imports(self, content: str) -> List[str]:
        """Extract imports"""
        imports = []

        # ES6 imports
        import_match = re.findall(r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]', content)
        imports.extend(import_match)

        # Dynamic imports
        dynamic_match = re.findall(r'import\s*\([\'"]([^\'"]+)[\'"]\)', content)
        imports.extend(dynamic_match)

        return imports

    def _count_jsx_lines(self, content: str) -> int:
        """Count lines containing JSX"""
        jsx_lines = 0
        for line in content.split('\n'):
            if '<' in line and '>' in line and not line.strip().startswith('//'):
                jsx_lines += 1
        return jsx_lines

    def _extract_design_link(self, content: str) -> Optional[str]:
        """Extract Figma or design link"""
        # Look for common design link patterns
        figma_patterns = [
            r'figmaUrl[:\s]*[\'"]([^\'"]+)[\'"]',
            r'figma[:\s]*[\'"]([^\'"]+)[\'"]',
            r'designUrl[:\s]*[\'"]([^\'"]+)[\'"]',
            r'https?://figma\.com/[^\s\'"]+'
        ]

        for pattern in figma_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                return match.group(1)

        return None


class VueComponentHandler:
    """Handler for Vue components"""

    def extract_metadata(self, file_path: Path, project_root: Path) -> Dict[str, Any]:
        """Extract metadata from Vue component"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            metadata = {
                'name': self._extract_component_name(content, file_path),
                'props': self._extract_vue_props(content),
                'events': self._extract_vue_events(content),
                'methods': self._extract_vue_methods(content),
                'imports': self._extract_vue_imports(content),
                'template_lines': self._count_template_lines(content),
                'design_link': self._extract_design_link(content)
            }

            return metadata

        except Exception as e:
            print(f"Error extracting Vue metadata: {e}")
            return {}

    def _extract_component_name(self, content: str, file_path: Path) -> str:
        """Extract component name from Vue file"""
        # Look for name in script section
        name_match = re.search(r'name:\s*[\'"]([^\'"]+)[\'"]', content)
        if name_match:
            return name_match.group(1)

        # Fallback to filename
        return file_path.stem

    def _extract_vue_props(self, content: str) -> List[Dict[str, str]]:
        """Extract props from Vue component"""
        props = []

        # Props object
        props_match = re.search(r'props:\s*{([^}]+)}', content, re.DOTALL)
        if props_match:
            props_content = props_match.group(1)
            prop_lines = [line.strip() for line in props_content.split('\n') if line.strip()]

            for line in prop_lines:
                if ':' in line and not line.strip().startswith('//'):
                    prop_parts = line.split(':')
                    if len(prop_parts) >= 2:
                        prop_name = prop_parts[0].strip()
                        prop_type = prop_parts[1].split(',')[0].strip()
                        props.append({'name': prop_name, 'type': prop_type})

        return props

    def _extract_vue_events(self, content: str) -> List[Dict[str, str]]:
        """Extract events from Vue component"""
        events = []

        # Emit calls
        emit_match = re.findall(r'this\.\$emit\s*\([\'"]([^\'"]+)[\'"]', content)
        for event_name in emit_match:
            events.append({'name': event_name, 'params': 'event'})

        return events

    def _extract_vue_methods(self, content: str) -> List[str]:
        """Extract methods from Vue component"""
        methods = []

        # Methods object
        methods_match = re.search(r'methods:\s*{([^}]+)}', content, re.DOTALL)
        if methods_match:
            methods_content = methods_match.group(1)
            method_lines = [line.strip() for line in methods_content.split('\n') if line.strip()]

            for line in method_lines:
                if '(' in line and ')' in line and '{' in line:
                    method_name = line.split('(')[0].strip()
                    if method_name and not method_name.startswith('//'):
                        methods.append(method_name)

        return methods

    def _extract_vue_imports(self, content: str) -> List[str]:
        """Extract imports from Vue component"""
        imports = []

        # Script section imports
        script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
        if script_match:
            script_content = script_match.group(1)

            # ES6 imports
            import_match = re.findall(r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]', script_content)
            imports.extend(import_match)

        return imports

    def _count_template_lines(self, content: str) -> int:
        """Count template lines"""
        template_match = re.search(r'<template[^>]*>(.*?)</template>', content, re.DOTALL)
        if template_match:
            template_content = template_match.group(1)
            return len([line for line in template_content.split('\n') if line.strip()])
        return 0

    def _extract_design_link(self, content: str) -> Optional[str]:
        """Extract Figma or design link"""
        # Similar to React handler
        figma_patterns = [
            r'figmaUrl[:\s]*[\'"]([^\'"]+)[\'"]',
            r'figma[:\s]*[\'"]([^\'"]+)[\'"]',
            r'https?://figma\.com/[^\s\'"]+'
        ]

        for pattern in figma_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                return match.group(1)

        return None


class SvelteComponentHandler:
    """Handler for Svelte components"""

    def extract_metadata(self, file_path: Path, project_root: Path) -> Dict[str, Any]:
        """Extract metadata from Svelte component"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            metadata = {
                'name': self._extract_component_name(content, file_path),
                'props': self._extract_svelte_props(content),
                'events': self._extract_svelte_events(content),
                'methods': [],  # Svelte doesn't have traditional methods
                'imports': self._extract_svelte_imports(content),
                'template_lines': self._count_template_lines(content),
                'design_link': self._extract_design_link(content)
            }

            return metadata

        except Exception as e:
            print(f"Error extracting Svelte metadata: {e}")
            return {}

    def _extract_component_name(self, content: str, file_path: Path) -> str:
        """Extract component name from Svelte file"""
        # Look for export let name
        name_match = re.search(r'export\s+let\s+name\s*=\s*[\'"]([^\'"]+)[\'"]', content)
        if name_match:
            return name_match.group(1)

        # Fallback to filename
        return file_path.stem

    def _extract_svelte_props(self, content: str) -> List[Dict[str, str]]:
        """Extract props from Svelte component"""
        props = []

        # Export let statements
        export_match = re.findall(r'export\s+let\s+(\w+)(?::\s*([^=]+))?(?=\s*=|;|$)', content)
        for prop_name, prop_type in export_match:
            props.append({'name': prop_name, 'type': prop_type.strip() if prop_type else 'any'})

        return props

    def _extract_svelte_events(self, content: str) -> List[Dict[str, str]]:
        """Extract events from Svelte component"""
        events = []

        # CreateEventDispatcher calls
        dispatch_match = re.findall(r'createEventDispatcher\(\)', content)
        if dispatch_match:
            # Look for dispatch calls
            dispatch_usage_match = re.findall(r'dispatch\s*\([\'"]([^\'"]+)[\'"]', content)
            for event_name in dispatch_usage_match:
                events.append({'name': event_name, 'params': 'detail'})

        return events

    def _extract_svelte_imports(self, content: str) -> List[str]:
        """Extract imports from Svelte component"""
        imports = []

        # Script section imports
        script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
        if script_match:
            script_content = script_match.group(1)

            # ES6 imports
            import_match = re.findall(r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]', script_content)
            imports.extend(import_match)

        return imports

    def _count_template_lines(self, content: str) -> int:
        """Count template lines (outside script and style tags)"""
        # Remove script and style sections
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
        content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL)

        return len([line for line in content.split('\n') if line.strip()])

    def _extract_design_link(self, content: str) -> Optional[str]:
        """Extract Figma or design link"""
        # Similar to other handlers
        figma_patterns = [
            r'figmaUrl[:\s]*[\'"]([^\'"]+)[\'"]',
            r'figma[:\s]*[\'"]([^\'"]+)[\'"]',
            r'https?://figma\.com/[^\s\'"]+'
        ]

        for pattern in figma_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                return match.group(1)

        return None


class WebComponentHandler:
    """Handler for Web Components"""

    def extract_metadata(self, file_path: Path, project_root: Path) -> Dict[str, Any]:
        """Extract metadata from Web Component"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            metadata = {
                'name': self._extract_component_name(content, file_path),
                'props': self._extract_web_component_props(content),
                'events': self._extract_web_component_events(content),
                'methods': self._extract_web_component_methods(content),
                'imports': self._extract_imports(content),
                'template_lines': self._count_template_lines(content),
                'design_link': self._extract_design_link(content)
            }

            return metadata

        except Exception as e:
            print(f"Error extracting Web Component metadata: {e}")
            return {}

    def _extract_component_name(self, content: str, file_path: Path) -> str:
        """Extract component name from Web Component"""
        # Look for customElements.define
        define_match = re.search(r'customElements\.define\s*\([\'"]([^\'"]+)[\'"]', content)
        if define_match:
            return define_match.group(1)

        # Fallback to filename
        return file_path.stem

    def _extract_web_component_props(self, content: str) -> List[Dict[str, str]]:
        """Extract properties from Web Component"""
        props = []

        # Observed properties
        observed_match = re.search(r'static\s+observedAttributes\s*=\s*\[([^\]]+)\]', content)
        if observed_match:
            attr_list = observed_match.group(1)
            attr_names = [attr.strip().strip('\'"') for attr in attr_list.split(',')]
            for attr_name in attr_names:
                props.append({'name': attr_name, 'type': 'string'})

        return props

    def _extract_web_component_events(self, content: str) -> List[Dict[str, str]]:
        """Extract events from Web Component"""
        events = []

        # Custom event dispatches
        dispatch_match = re.findall(r'dispatchEvent\s*\(\s*new\s+CustomEvent\s*\([\'"]([^\'"]+)[\'"]', content)
        for event_name in dispatch_match:
            events.append({'name': event_name, 'params': 'detail'})

        return events

    def _extract_web_component_methods(self, content: str) -> List[str]:
        """Extract methods from Web Component"""
        methods = []

        # Class methods
        method_match = re.findall(r'^\s*(\w+)\s*\([^)]*\)\s*{', content, re.MULTILINE)
        methods.extend(method_match)

        return methods

    def _extract_imports(self, content: str) -> List[str]:
        """Extract imports from Web Component"""
        imports = []

        # ES6 imports
        import_match = re.findall(r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]', content)
        imports.extend(import_match)

        return imports

    def _count_template_lines(self, content: str) -> int:
        """Count template lines"""
        # Look for template literals or render methods
        template_match = re.search(r'render\s*\(\s*\)\s*{([^}]+)}', content, re.DOTALL)
        if template_match:
            return len([line for line in template_match.group(1).split('\n') if line.strip()])

        return 0

    def _extract_design_link(self, content: str) -> Optional[str]:
        """Extract Figma or design link"""
        # Similar to other handlers
        figma_patterns = [
            r'figmaUrl[:\s]*[\'"]([^\'"]+)[\'"]',
            r'figma[:\s]*[\'"]([^\'"]+)[\'"]',
            r'https?://figma\.com/[^\s\'"]+'
        ]

        for pattern in figma_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                return match.group(1)

        return None


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Discover UI components for Storybook")
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--output-dir', default='.', help='Output directory for reports')
    parser.add_argument('--component-paths', help='Custom component paths (comma-separated)')

    args = parser.parse_args()

    # Initialize discovery
    discovery = ComponentDiscovery(args.config)

    # Override component paths if specified
    if args.component_paths:
        discovery.config['discovery']['component_paths'] = args.component_paths.split(',')

    # Run discovery
    summary = discovery.run_discovery()

    print(f"\n📊 Final Summary:")
    print(f"   Components discovered: {summary['total_components']}")
    print(f"   Coverage: {summary['coverage_percentage']:.1f}%")
    print(f"   Frameworks: {', '.join(summary['frameworks'])}")
    print(f"   High priority components: {summary['high_priority_components']}")

if __name__ == '__main__':
    main()