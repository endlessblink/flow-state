#!/usr/bin/env python3
"""
Phase 2: Impact Assessment & Safe Removal Planning
Analyzes risk, builds dependency graphs, and creates safe removal plans
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
from enum import Enum
import networkx as nx
import yaml

class RiskCategory(Enum):
    SAFE = "🟢 SAFE"
    CAUTION = "🟡 CAUTION"
    RISKY = "🔴 RISKY"

class ActionType(Enum):
    REMOVE_IMMEDIATELY = "remove_immediately"
    REVIEW_REQUIRED = "review_required"
    MIGRATION_REQUIRED = "migration_required"
    ARCHIVE = "archive"
    MONITOR = "monitor"

@dataclass
class ImpactAssessment:
    """Detailed impact assessment for a legacy item"""
    item_path: str
    risk_category: RiskCategory
    impact_score: float
    direct_dependencies: List[str]
    indirect_dependencies: List[str]
    dependents: List[str]
    test_coverage: float
    build_impact: str
    rollback_complexity: str
    recommended_action: ActionType
    migration_steps: List[str]
    estimated_effort: int  # in hours
    confidence_level: float

@dataclass
class RemovalPlan:
    """Structured removal plan with phases"""
    phase: int
    action_type: ActionType
    items: List[str]
    commands: List[str]
    linked_skills: List[str]
    prerequisites: List[str]
    verification_steps: List[str]
    rollback_commands: List[str]

class ImpactAnalyzer:
    def __init__(self, legacy_items_path: str, project_root: Path = None):
        self.project_root = project_root or Path.cwd()
        self.legacy_items = self._load_legacy_items(legacy_items_path)
        self.dependency_graph = nx.DiGraph()
        self.assessments = []
        self.config = self._load_config()

        # Risk thresholds
        self.safe_threshold = self.config.get('risk_thresholds', {}).get('safe_removal', 0.2)
        self.caution_threshold = self.config.get('risk_thresholds', {}).get('caution_zone', 0.6)

    def _load_config(self) -> Dict:
        """Load assessment configuration"""
        config_path = self.project_root / '.claude' / 'legacy-remover-config.yml'
        default_config = {
            'risk_thresholds': {
                'safe_removal': 0.2,
                'caution_zone': 0.6,
                'risky_removal': 0.8
            },
            'test_commands': ['npm test', 'python -m pytest', 'cargo test'],
            'build_commands': ['npm run build', 'mvn compile', 'gradle build'],
            'protected_patterns': [
                'src/main',
                'src/app',
                'core/',
                'config/',
                'production/'
            ],
            'skill_mappings': {
                'library_removal': '/skill-remove-library',
                'folder_removal': '/skill-code-folder-remove',
                'config_cleanup': '/skill-config-cleanup',
                'code_review': '/skill-request-code-review',
                'migration_assist': '/skill-migration-assist'
            }
        }

        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Warning: Could not load config: {e}")

        return default_config

    def _load_legacy_items(self, items_path: str) -> List[Dict]:
        """Load legacy items from Phase 1 output"""
        try:
            with open(items_path, 'r') as f:
                if items_path.endswith('.csv'):
                    reader = csv.DictReader(f)
                    return list(reader)
                else:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading legacy items: {e}")
            return []

    def build_dependency_graph(self):
        """Build comprehensive dependency graph"""
        print("🔗 Building dependency graph...")

        # Add nodes for each legacy item
        for item in self.legacy_items:
            self.dependency_graph.add_node(
                item['Path'],
                type=item['Type'],
                risk_score=float(item['Risk Score']),
                size_kb=float(item.get('Size (KB)', 0))
            )

        # Build dependency relationships
        self._analyze_code_dependencies()
        self._analyze_import_dependencies()
        self._analyze_config_dependencies()

        print(f"✅ Dependency graph built: {self.dependency_graph.number_of_nodes()} nodes, {self.dependency_graph.number_of_edges()} edges")

    def _analyze_code_dependencies(self):
        """Analyze source code dependencies"""
        source_files = [item for item in self.legacy_items if item['Type'] in ['file', 'directory']]

        for item in source_files:
            item_path = self.project_root / item['Path']
            if not item_path.exists():
                continue

            try:
                # Scan for dependencies
                dependencies = self._extract_dependencies_from_file(item_path)

                for dep in dependencies:
                    # Find if dependency is also a legacy item
                    for other_item in self.legacy_items:
                        if dep in other_item['Path'] or dep in other_item['Name']:
                            self.dependency_graph.add_edge(item['Path'], other_item['Path'], type='code_dependency')

            except Exception as e:
                print(f"Error analyzing dependencies for {item_path}: {e}")

    def _analyze_import_dependencies(self):
        """Analyze import/require dependencies"""
        for item in self.legacy_items:
            if item['Type'] == 'library':
                lib_name = item['Name']

                # Find files that import this library
                try:
                    for file_path in self.project_root.rglob('*'):
                        if not file_path.is_file():
                            continue

                        if file_path.suffix not in ['.js', '.ts', '.jsx', '.tsx', '.py']:
                            continue

                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()

                            # Check for imports
                            if (f'import.*{lib_name}' in content or
                                f'require.*{lib_name}' in content or
                                f'from.*{lib_name}' in content):

                                # Add edge from file to library
                                file_path_str = str(file_path.relative_to(self.project_root))
                                if file_path_str in [i['Path'] for i in self.legacy_items]:
                                    self.dependency_graph.add_edge(file_path_str, item['Path'], type='import_dependency')

                        except Exception:
                            continue

                except Exception:
                    continue

    def _analyze_config_dependencies(self):
        """Analyze configuration file dependencies"""
        config_items = [item for item in self.legacy_items if item['Type'] == 'config']

        for item in config_items:
            # Check if other configs reference this config
            item_path = self.project_root / item['Path']
            if not item_path.exists():
                continue

            try:
                with open(item_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Look for references to other configs
                for other_item in self.legacy_items:
                    if other_item['Path'] != item['Path'] and other_item['Path'] in content:
                        self.dependency_graph.add_edge(item['Path'], other_item['Path'], type='config_dependency')

            except Exception:
                continue

    def assess_individual_impact(self, item: Dict) -> ImpactAssessment:
        """Assess impact of removing a specific legacy item"""
        item_path = item['Path']
        risk_score = float(item['Risk Score'])
        item_type = item['Type']

        # Get dependency information
        direct_deps = list(self.dependency_graph.successors(item_path))
        indirect_deps = self._get_indirect_dependencies(item_path)
        dependents = list(self.dependency_graph.predecessors(item_path))

        # Analyze test coverage
        test_coverage = self._analyze_test_coverage(item_path, item_type)

        # Analyze build impact
        build_impact = self._analyze_build_impact(item_path, item_type)

        # Determine risk category
        if risk_score <= self.safe_threshold and len(dependents) == 0:
            risk_category = RiskCategory.SAFE
        elif risk_score <= self.caution_threshold or len(dependents) <= 2:
            risk_category = RiskCategory.CAUTION
        else:
            risk_category = RiskCategory.RISKY

        # Determine recommended action
        action = self._determine_recommended_action(
            risk_category, item_type, dependents, test_coverage
        )

        # Generate migration steps if needed
        migration_steps = self._generate_migration_steps(item, action) if action == ActionType.MIGRATION_REQUIRED else []

        # Calculate estimated effort
        effort = self._estimate_effort(item_type, action, len(dependents), migration_steps)

        # Calculate confidence level
        confidence = self._calculate_confidence(item, direct_deps, test_coverage)

        # Determine rollback complexity
        rollback_complexity = self._assess_rollback_complexity(item_type, len(dependents))

        return ImpactAssessment(
            item_path=item_path,
            risk_category=risk_category,
            impact_score=self._calculate_impact_score(risk_score, dependents, test_coverage),
            direct_dependencies=direct_deps,
            indirect_dependencies=indirect_deps,
            dependents=dependents,
            test_coverage=test_coverage,
            build_impact=build_impact,
            rollback_complexity=rollback_complexity,
            recommended_action=action,
            migration_steps=migration_steps,
            estimated_effort=effort,
            confidence_level=confidence
        )

    def _extract_dependencies_from_file(self, file_path: Path) -> List[str]:
        """Extract dependencies from a source file"""
        dependencies = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract based on file type
            if file_path.suffix in ['.js', '.ts', '.jsx', '.tsx']:
                # JavaScript/TypeScript imports
                import_patterns = [
                    r'import.*from\s+["\']([^"\']+)["\']',
                    r'require\(["\']([^"\']+)["\']',
                    r'import ["\']([^"\']+)["\']'
                ]
            elif file_path.suffix == '.py':
                # Python imports
                import_patterns = [
                    r'import\s+(\w+)',
                    r'from\s+(\w+)\s+import'
                ]
            elif file_path.suffix == '.java':
                # Java imports
                import_patterns = [
                    r'import\s+([\w.]+);'
                ]
            else:
                return dependencies

            for pattern in import_patterns:
                matches = re.findall(pattern, content)
                dependencies.extend(matches)

        except Exception:
            pass

        return dependencies

    def _get_indirect_dependencies(self, item_path: str, max_depth: int = 3) -> List[str]:
        """Get indirect dependencies up to specified depth"""
        indirect_deps = set()
        visited = set()

        def _traverse_deps(node: str, depth: int):
            if depth >= max_depth or node in visited:
                return

            visited.add(node)
            for successor in self.dependency_graph.successors(node):
                if successor != item_path:  # Don't include the item itself
                    indirect_deps.add(successor)
                    _traverse_deps(successor, depth + 1)

        _traverse_deps(item_path, 0)
        return list(indirect_deps)

    def _analyze_test_coverage(self, item_path: str, item_type: str) -> float:
        """Analyze test coverage for the legacy item"""
        if item_type == 'directory':
            return self._analyze_directory_test_coverage(item_path)
        elif item_type == 'file':
            return self._analyze_file_test_coverage(item_path)
        elif item_type == 'library':
            return self._analyze_library_test_coverage(item_path)
        else:
            return 0.0

    def _analyze_directory_test_coverage(self, dir_path: str) -> float:
        """Analyze test coverage for a directory"""
        dir_abs_path = self.project_root / dir_path
        if not dir_abs_path.exists():
            return 0.0

        try:
            # Look for test files in or related to this directory
            test_files = []
            source_files = []

            for file_path in dir_abs_path.rglob('*'):
                if file_path.is_file():
                    if file_path.suffix in ['.js', '.ts', '.py', '.java']:
                        if 'test' in file_path.name.lower() or file_path.parent.name.lower() == 'test':
                            test_files.append(file_path)
                        else:
                            source_files.append(file_path)

            if not source_files:
                return 100.0  # Empty directory, no tests needed

            # Look for corresponding test files
            coverage = 0
            for source_file in source_files:
                test_patterns = [
                    str(source_file.parent / f"test_{source_file.name}"),
                    str(source_file.parent / f"{source_file.stem}_test{source_file.suffix}"),
                    str(source_file.parent / "test" / source_file.name),
                    str(self.project_root / "test" / source_file.relative_to(self.project_root))
                ]

                if any(Path(pattern).exists() for pattern in test_patterns):
                    coverage += 1

            return (coverage / len(source_files)) * 100 if source_files else 0.0

        except Exception:
            return 0.0

    def _analyze_file_test_coverage(self, file_path: str) -> float:
        """Analyze test coverage for a single file"""
        file_abs_path = self.project_root / file_path
        if not file_abs_path.exists():
            return 0.0

        try:
            # Look for test files that might test this file
            test_patterns = [
                file_abs_path.parent / f"test_{file_abs_path.name}",
                file_abs_path.parent / f"{file_abs_path.stem}_test{file_abs_path.suffix}",
                self.project_root / "test" / file_abs_path.relative_to(self.project_root),
                self.project_root / "__tests__" / file_abs_path.relative_to(self.project_root)
            ]

            return 100.0 if any(Path(pattern).exists() for pattern in test_patterns) else 0.0

        except Exception:
            return 0.0

    def _analyze_library_test_coverage(self, lib_name: str) -> float:
        """Analyze test coverage for a library"""
        # Check if tests import this library
        try:
            test_imports = 0
            total_test_files = 0

            for test_file in self.project_root.rglob('*test*'):
                if not test_file.is_file() or test_file.suffix not in ['.js', '.ts', '.py']:
                    continue

                total_test_files += 1
                try:
                    with open(test_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if lib_name in content:
                        test_imports += 1
                except Exception:
                    continue

            return (test_imports / total_test_files) * 100 if total_test_files > 0 else 0.0

        except Exception:
            return 0.0

    def _analyze_build_impact(self, item_path: str, item_type: str) -> str:
        """Analyze impact on build process"""
        if item_type == 'config':
            return "HIGH - Build configuration file"
        elif item_type == 'library':
            return "MEDIUM - May affect dependency resolution"
        elif item_type == 'directory':
            return self._check_directory_build_impact(item_path)
        else:
            return "LOW - Minimal build impact expected"

    def _check_directory_build_impact(self, dir_path: str) -> str:
        """Check if directory is referenced in build files"""
        build_files = ['package.json', 'webpack.config.js', 'vite.config.js', 'tsconfig.json', 'pom.xml', 'build.gradle']

        for build_file in build_files:
            build_path = self.project_root / build_file
            if build_path.exists():
                try:
                    with open(build_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if dir_path in content:
                        return "HIGH - Referenced in build configuration"
                except Exception:
                    continue

        return "LOW - No build references found"

    def _determine_recommended_action(self, risk_category: RiskCategory, item_type: str, dependents: List[str], test_coverage: float) -> ActionType:
        """Determine recommended action based on assessment"""
        if risk_category == RiskCategory.SAFE:
            return ActionType.REMOVE_IMMEDIATELY
        elif risk_category == RiskCategory.CAUTION:
            if len(dependents) == 0:
                return ActionType.ARCHIVE
            else:
                return ActionType.REVIEW_REQUIRED
        else:  # RISKY
            if test_coverage > 80:
                return ActionType.MIGRATION_REQUIRED
            else:
                return ActionType.REVIEW_REQUIRED

    def _generate_migration_steps(self, item: Dict, action: ActionType) -> List[str]:
        """Generate migration steps for complex items"""
        if action != ActionType.MIGRATION_REQUIRED:
            return []

        item_type = item['Type']
        item_name = item['Name']

        if item_type == 'library':
            return [
                f"Identify modern replacement for {item_name}",
                f"Update all import statements to use replacement",
                f"Update package.json to include new dependency",
                f"Run tests to verify compatibility",
                f"Remove {item_name} from dependencies"
            ]
        elif item_type == 'config':
            return [
                f"Create new configuration using modern tools",
                f"Test new configuration in development",
                f"Migrate environment-specific settings",
                f"Update documentation",
                f"Remove legacy configuration"
            ]
        else:
            return [
                f"Analyze current functionality of {item_name}",
                f"Identify modern alternatives",
                f"Implement replacement",
                f"Test replacement thoroughly",
                f"Remove legacy implementation"
            ]

    def _estimate_effort(self, item_type: str, action: ActionType, dependents_count: int, migration_steps: List[str]) -> int:
        """Estimate effort in hours"""
        base_effort = {
            ActionType.REMOVE_IMMEDIATELY: 1,
            ActionType.ARCHIVE: 2,
            ActionType.REVIEW_REQUIRED: 4,
            ActionType.MIGRATION_REQUIRED: 16,
            ActionType.MONITOR: 1
        }

        effort = base_effort.get(action, 8)

        # Add complexity based on dependencies
        effort += dependents_count * 2

        # Add complexity based on migration steps
        effort += len(migration_steps) * 2

        # Add type-specific complexity
        if item_type == 'library':
            effort += 4
        elif item_type == 'config':
            effort += 6

        return effort

    def _calculate_confidence(self, item: Dict, direct_deps: List[str], test_coverage: float) -> float:
        """Calculate confidence level in the assessment"""
        confidence = 0.8  # Base confidence

        # Reduce confidence based on complexity
        if len(direct_deps) > 5:
            confidence -= 0.1
        if test_coverage < 50:
            confidence -= 0.2
        if item['Type'] == 'directory':
            confidence -= 0.1

        return max(confidence, 0.3)  # Minimum confidence

    def _assess_rollback_complexity(self, item_type: str, dependents_count: int) -> str:
        """Assess rollback complexity"""
        if dependents_count == 0:
            return "Simple - Git revert"
        elif dependents_count <= 3:
            return "Moderate - May need dependency restoration"
        else:
            return "Complex - Requires careful dependency restoration"

    def _calculate_impact_score(self, risk_score: float, dependents: List[str], test_coverage: float) -> float:
        """Calculate overall impact score"""
        # Weight factors
        risk_weight = 0.4
        dependency_weight = 0.3
        coverage_weight = 0.3

        # Normalize factors
        dependency_factor = min(len(dependents) / 10, 1.0)  # Cap at 10 dependencies
        coverage_factor = (100 - test_coverage) / 100  # Invert: lower coverage = higher impact

        # Calculate weighted score
        impact = (
            risk_score * risk_weight +
            dependency_factor * dependency_weight +
            coverage_factor * coverage_weight
        )

        return min(impact, 1.0)

    def run_full_assessment(self) -> List[ImpactAssessment]:
        """Run full impact assessment on all legacy items"""
        print("🔍 Running comprehensive impact assessment...")

        if self.dependency_graph.number_of_nodes() == 0:
            self.build_dependency_graph()

        self.assessments = []

        for item in self.legacy_items:
            try:
                assessment = self.assess_individual_impact(item)
                self.assessments.append(assessment)
                print(f"  ✅ Assessed: {item['Path']} ({assessment.risk_category.value})")
            except Exception as e:
                print(f"  ❌ Error assessing {item['Path']}: {e}")

        print(f"✅ Assessment complete: {len(self.assessments)} items assessed")
        return self.assessments

    def create_removal_plan(self) -> List[RemovalPlan]:
        """Create structured removal plan"""
        print("📋 Creating removal plan...")

        # Group assessments by recommended action and risk
        safe_items = [a for a in self.assessments if a.risk_category == RiskCategory.SAFE]
        caution_items = [a for a in self.assessments if a.risk_category == RiskCategory.CAUTION]
        risky_items = [a for a in self.assessments if a.risk_category == RiskCategory.RISKY]

        plans = []

        # Phase 1: Safe removals (immediate)
        if safe_items:
            safe_plan = self._create_safe_removal_plan(safe_items)
            plans.append(safe_plan)

        # Phase 2: Cautious removals (review first)
        if caution_items:
            caution_plan = self._create_caution_removal_plan(caution_items)
            plans.append(caution_plan)

        # Phase 3: Risky items (migration required)
        if risky_items:
            risky_plan = self._create_risky_removal_plan(risky_items)
            plans.append(risky_plan)

        print(f"✅ Removal plan created: {len(plans)} phases")
        return plans

    def _create_safe_removal_plan(self, items: List[ImpactAssessment]) -> RemovalPlan:
        """Create plan for safe removals"""
        commands = []
        linked_skills = []

        for item in items:
            if item.item_path.endswith('package.json') or ':lib' in item.item_path:
                # Library removal
                lib_name = item.item_path.split(':')[-1] if ':' in item.item_path else Path(item.item_path).stem
                commands.append(f"npm uninstall {lib_name}")
                linked_skills.append(self.config['skill_mappings']['library_removal'])
            else:
                # File/directory removal
                commands.append(f"git rm -r {item.item_path}")
                linked_skills.append(self.config['skill_mappings']['folder_removal'])

        return RemovalPlan(
            phase=1,
            action_type=ActionType.REMOVE_IMMEDIATELY,
            items=[a.item_path for a in items],
            commands=commands,
            linked_skills=linked_skills,
            prerequisites=["Create backup branch"],
            verification_steps=["Run tests", "Build project"],
            rollback_commands=["git revert HEAD~1"] * len(items)
        )

    def _create_caution_removal_plan(self, items: List[ImpactAssessment]) -> RemovalPlan:
        """Create plan for cautious removals"""
        commands = []
        linked_skills = []

        for item in items:
            # Manual review required
            commands.append(f"# Manual review required for {item.item_path}")
            linked_skills.append(self.config['skill_mappings']['code_review'])

        return RemovalPlan(
            phase=2,
            action_type=ActionType.REVIEW_REQUIRED,
            items=[a.item_path for a in items],
            commands=commands,
            linked_skills=linked_skills,
            prerequisites=["Complete Phase 1", "Team review"],
            verification_steps=["Manual inspection", "Dependency verification"],
            rollback_commands=["git revert HEAD~1"] * len(items)
        )

    def _create_risky_removal_plan(self, items: List[ImpactAssessment]) -> RemovalPlan:
        """Create plan for risky items requiring migration"""
        commands = []
        linked_skills = []

        for item in items:
            for step in item.migration_steps:
                commands.append(f"# {step}")
            linked_skills.append(self.config['skill_mappings']['migration_assist'])

        return RemovalPlan(
            phase=3,
            action_type=ActionType.MIGRATION_REQUIRED,
            items=[a.item_path for a in items],
            commands=commands,
            linked_skills=linked_skills,
            prerequisites=["Complete Phase 2", "Migration planning"],
            verification_steps=["Comprehensive testing", "Performance verification"],
            rollback_commands=["git revert HEAD~1"] * len(items)
        )

    def generate_assessment_report(self, output_path: str = 'impact-assessment-report.json'):
        """Generate comprehensive assessment report"""
        report_data = {
            'assessment_date': datetime.now().isoformat(),
            'total_items_assessed': len(self.assessments),
            'summary': {
                'safe_removals': len([a for a in self.assessments if a.risk_category == RiskCategory.SAFE]),
                'caution_items': len([a for a in self.assessments if a.risk_category == RiskCategory.CAUTION]),
                'risky_items': len([a for a in self.assessments if a.risk_category == RiskCategory.RISKY]),
                'total_effort_hours': sum(a.estimated_effort for a in self.assessments),
                'average_confidence': sum(a.confidence_level for a in self.assessments) / len(self.assessments) if self.assessments else 0
            },
            'assessments': [asdict(assessment) for assessment in self.assessments],
            'dependency_graph': {
                'nodes': self.dependency_graph.number_of_nodes(),
                'edges': self.dependency_graph.number_of_edges(),
                'connected_components': nx.number_weakly_connected_components(self.dependency_graph)
            }
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, default=str)

        print(f"📊 Assessment report saved to: {output_path}")

    def generate_removal_plan_csv(self, removal_plans: List[RemovalPlan], output_path: str = 'removal-plan.csv'):
        """Generate CSV removal plan"""
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Phase', 'Action Type', 'Item Path', 'Command', 'Linked Skill',
                'Prerequisites', 'Verification Steps', 'Rollback Command'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for plan in removal_plans:
                for i, item_path in enumerate(plan.items):
                    command = plan.commands[i] if i < len(plan.commands) else "Manual"
                    skill = plan.linked_skills[i] if i < len(plan.linked_skills) else "Manual"
                    rollback = plan.rollback_commands[i] if i < len(plan.rollback_commands) else "git revert"

                    writer.writerow({
                        'Phase': plan.phase,
                        'Action Type': plan.action_type.value,
                        'Item Path': item_path,
                        'Command': command,
                        'Linked Skill': skill,
                        'Prerequisites': '; '.join(plan.prerequisites),
                        'Verification Steps': '; '.join(plan.verification_steps),
                        'Rollback Command': rollback
                    })

        print(f"📋 Removal plan saved to: {output_path}")

def main():
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description="Assess impact of legacy code removal")
    parser.add_argument('legacy_items', help='Path to legacy items CSV/JSON from Phase 1')
    parser.add_argument('--output-dir', default='.', help='Output directory for reports')
    parser.add_argument('--project-root', help='Project root directory')

    args = parser.parse_args()

    project_root = Path(args.project_root) if args.project_root else Path.cwd()

    # Initialize analyzer
    analyzer = ImpactAnalyzer(args.legacy_items, project_root)

    # Run assessment
    assessments = analyzer.run_full_assessment()

    if assessments:
        # Create removal plan
        removal_plans = analyzer.create_removal_plan()

        # Generate reports
        output_dir = Path(args.output_dir)
        output_dir.mkdir(exist_ok=True)

        analyzer.generate_assessment_report(output_dir / 'impact-assessment-report.json')
        analyzer.generate_removal_plan_csv(removal_plans, output_dir / 'removal-plan.csv')

        # Print summary
        safe_count = len([a for a in assessments if a.risk_category == RiskCategory.SAFE])
        caution_count = len([a for a in assessments if a.risk_category == RiskCategory.CAUTION])
        risky_count = len([a for a in assessments if a.risk_category == RiskCategory.RISKY])

        print(f"\n📊 Assessment Summary:")
        print(f"   Safe to remove: {safe_count} items")
        print(f"   Requires review: {caution_count} items")
        print(f"   Risky (migration needed): {risky_count} items")
        print(f"   Total estimated effort: {sum(a.estimated_effort for a in assessments)} hours")
        print(f"   Reports saved to: {output_dir}")
    else:
        print("❌ No assessments generated!")

if __name__ == '__main__':
    main()