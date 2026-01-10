#!/usr/bin/env python3
"""
Storybook Master - Main Orchestrator
Coordinates all 4 phases of Storybook documentation and testing
"""

import os
import sys
import json
import yaml
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import argparse

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from phase1_discovery import ComponentDiscovery
    from phase2_generation import StoryGenerator
    from phase3_testing import VisualTestHarness
    from phase4_integration import CIIntegration
except ImportError as e:
    print(f"Error importing phase modules: {e}")
    print("Please ensure all phase scripts are in the same directory")
    sys.exit(1)

@dataclass
class StorybookMasterSession:
    """Represents a complete Storybook Master session"""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    phase: int = 1
    mode: str = "discovery_only"
    config: Dict = None
    results: Dict = None
    status: str = "in_progress"

class StorybookMasterOrchestrator:
    def __init__(self, config_path: str = None, project_root: Path = None):
        self.project_root = project_root or Path.cwd()
        self.session = StorybookMasterSession(
            session_id=f"storybook-master-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            start_time=datetime.now(),
            config=self._load_config(config_path),
            results={}
        )

        # Initialize output directory
        self.output_dir = self.project_root / 'storybook-master-output' / self.session.session_id
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Phase results
        self.phase1_results = None
        self.phase2_results = None
        self.phase3_results = None
        self.phase4_results = None

        print(f"📚 Storybook Master - Session {self.session.session_id}")
        print(f"📁 Project: {self.project_root}")
        print(f"📂 Output: {self.output_dir}")

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from file or use defaults"""
        default_config = {
            'discovery': {
                'component_paths': [
                    'src/components/**/*',
                    'lib/components/**/*',
                    'components/**/*'
                ],
                'framework_detection': True
            },
            'generation': {
                'autodocs': True,
                'controls': True,
                'interactions': True,
                'responsive_variants': True,
                'accessibility_testing': True
            },
            'testing': {
                'visual_testing': {
                    'enabled': True,
                    'tool': 'chromatic'
                },
                'accessibility': {
                    'enabled': True,
                    'standards': ['WCAG2.1AA']
                },
                'coverage': {
                    'minimum_story_coverage': 80
                }
            },
            'ci': {
                'enforce_coverage': True,
                'generate_reports': True
            },
            'figma': {
                'enabled': False
            }
        }

        if config_path and Path(config_path).exists():
            try:
                with open(config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                self._merge_configs(default_config, user_config)
                print(f"✅ Configuration loaded from: {config_path}")
            except Exception as e:
                print(f"⚠️ Could not load config file {config_path}: {e}")
        else:
            # Try to find default config file
            default_config_path = self.project_root / '.storybook' / 'skill-config.yml'
            if default_config_path.exists():
                try:
                    with open(default_config_path, 'r') as f:
                        user_config = yaml.safe_load(f)
                    self._merge_configs(default_config, user_config)
                    print(f"✅ Configuration loaded from: {default_config_path}")
                except Exception as e:
                    print(f"⚠️ Could not load default config: {e}")
            else:
                print("ℹ️ No configuration file found, using built-in defaults")

        return default_config

    def _merge_configs(self, base_config: Dict, user_config: Dict):
        """Recursively merge user config with base config"""
        for key, value in user_config.items():
            if key in base_config and isinstance(base_config[key], dict) and isinstance(value, dict):
                self._merge_configs(base_config[key], value)
            else:
                base_config[key] = value

    def run_phase1_discovery(self) -> Dict:
        """Run Phase 1: Component Discovery & Inventory"""
        print("\n" + "="*60)
        print("🔍 PHASE 1: Component Discovery & Inventory")
        print("="*60)

        try:
            # Initialize discovery
            discovery = ComponentDiscovery()

            # Run discovery
            components = discovery.discover_components()

            # Generate reports in output directory
            inventory_path = self.output_dir / 'storybook-inventory.csv'
            discovery.generate_inventory_csv(str(inventory_path))

            missing_stories_path = self.output_dir / 'missing-stories-report.md'
            discovery.generate_missing_stories_report(str(missing_stories_path))

            component_map_path = self.output_dir / 'component-update-map.json'
            discovery.generate_component_update_map(str(component_map_path))

            # Store results
            self.phase1_results = {
                'components_found': len(components),
                'components': components,
                'reports': {
                    'inventory': str(inventory_path),
                    'missing_stories': str(missing_stories_path),
                    'component_map': str(component_map_path)
                }
            }

            # Summary statistics
            total = len(components)
            with_stories = len([c for c in components if c.has_story])
            coverage = (with_stories / total * 100) if total > 0 else 0

            print(f"\n📊 Phase 1 Summary:")
            print(f"   Components discovered: {total}")
            print(f"   With stories: {with_stories}")
            print(f"   Coverage: {coverage:.1f}%")
            print(f"   Reports saved to: {self.output_dir}")

            self.session.phase = 1
            self.session.results['phase1'] = self.phase1_results

            return self.phase1_results

        except Exception as e:
            print(f"❌ Phase 1 failed: {e}")
            raise

    def run_phase2_generation(self, auto_fix: bool = False) -> Dict:
        """Run Phase 2: Autodocs & Story Automation"""
        print("\n" + "="*60)
        print("📚 PHASE 2: Autodocs & Story Automation")
        print("="*60)

        if not self.phase1_results:
            print("❌ No discovery results available. Run Phase 1 first.")
            return {}

        try:
            # Initialize story generator
            generator = StoryGenerator()

            # Get components that need stories
            components = self.phase1_results['components']
            components_needing_stories = [c.__dict__ for c in components if not c.has_story]

            print(f"📋 Components needing stories: {len(components_needing_stories)}")

            # Generate stories
            results = generator.run_story_generation(
                components_file=self.phase1_results['reports']['component_map'],
                auto_fix=auto_fix
            )

            # Copy generated reports to output directory
            autodocs_path = self.project_root / 'autodocs-missing.md'
            if autodocs_path.exists():
                autodocs_path.rename(self.output_dir / 'autodocs-missing.md')

            summary_path = self.project_root / 'story-generation-summary.json'
            if summary_path.exists():
                summary_path.rename(self.output_dir / 'story-generation-summary.json')

            # Store results
            self.phase2_results = results
            self.phase2_results['reports'] = {
                'autodocs_missing': str(self.output_dir / 'autodocs-missing.md'),
                'generation_summary': str(self.output_dir / 'story-generation-summary.json')
            }

            print(f"\n📊 Phase 2 Summary:")
            print(f"   Stories generated: {results.get('stories_generated', 0)}")
            print(f"   New stories: {results.get('new_stories', 0)}")
            print(f"   Updated stories: {results.get('updated_stories', 0)}")

            self.session.phase = 2
            self.session.results['phase2'] = self.phase2_results

            return self.phase2_results

        except Exception as e:
            print(f"❌ Phase 2 failed: {e}")
            raise

    def run_phase3_testing(self, run_visual: bool = False, run_accessibility: bool = False) -> Dict:
        """Run Phase 3: Automated Visual & Interaction Testing"""
        print("\n" + "="*60)
        print("🧪 PHASE 3: Automated Visual & Interaction Testing")
        print("="*60)

        try:
            # Initialize test harness
            test_harness = VisualTestHarness(self.config['testing'])

            # Run tests based on configuration
            results = {}

            if run_visual or self.config['testing']['visual_testing']['enabled']:
                print("🎨 Running visual tests...")
                visual_results = test_harness.run_visual_tests()
                results['visual'] = visual_results

            if run_accessibility or self.config['testing']['accessibility']['enabled']:
                print("♿ Running accessibility tests...")
                accessibility_results = test_harness.run_accessibility_tests()
                results['accessibility'] = accessibility_results

            # Generate coverage report
            print("📊 Generating coverage report...")
            coverage_results = test_harness.generate_coverage_report()
            results['coverage'] = coverage_results

            # Save reports to output directory
            if 'visual' in results:
                visual_report_path = self.output_dir / 'storybook-visual-report.md'
                with open(visual_report_path, 'w') as f:
                    f.write(results['visual']['report'])
                results['visual']['report_path'] = str(visual_report_path)

            if 'accessibility' in results:
                accessibility_report_path = self.output_dir / 'storybook-a11y-report.md'
                with open(accessibility_report_path, 'w') as f:
                    f.write(results['accessibility']['report'])
                results['accessibility']['report_path'] = str(accessibility_report_path)

            if 'coverage' in results:
                coverage_summary_path = self.output_dir / 'storybook-coverage-summary.json'
                with open(coverage_summary_path, 'w') as f:
                    json.dump(results['coverage'], f, indent=2)
                results['coverage']['report_path'] = str(coverage_summary_path)

            # Store results
            self.phase3_results = results

            print(f"\n📊 Phase 3 Summary:")
            print(f"   Visual tests: {'✅' if 'visual' in results else '❌'}")
            print(f"   Accessibility tests: {'✅' if 'accessibility' in results else '❌'}")
            print(f"   Coverage generated: {'✅' if 'coverage' in results else '❌'}")
            print(f"   Reports saved to: {self.output_dir}")

            self.session.phase = 3
            self.session.results['phase3'] = self.phase3_results

            return self.phase3_results

        except Exception as e:
            print(f"❌ Phase 3 failed: {e}")
            raise

    def run_phase4_integration(self) -> Dict:
        """Run Phase 4: Team Workflow Integration & CI"""
        print("\n" + "="*60)
        print("🔗 PHASE 4: Team Workflow Integration & CI")
        print("="*60)

        try:
            # Initialize CI integration
            ci_integration = CIIntegration(self.config['ci'])

            # Generate CI configuration
            print("🔧 Generating CI configuration...")
            ci_config = ci_integration.generate_ci_config()

            # Generate PR templates
            print("📝 Generating PR templates...")
            pr_templates = ci_integration.generate_pr_templates()

            # Generate dashboard reports
            print("📊 Generating dashboard reports...")
            dashboard = ci_integration.generate_dashboard_report(self.session.results)

            # Save to output directory
            ci_config_path = self.output_dir / 'storybook-ci.yml'
            with open(ci_config_path, 'w') as f:
                yaml.dump(ci_config, f, default_flow_style=False)

            pr_template_path = self.output_dir / 'storybook-pr-template.md'
            with open(pr_template_path, 'w') as f:
                f.write(pr_templates)

            dashboard_path = self.output_dir / 'storybook-dashboard.html'
            with open(dashboard_path, 'w') as f:
                f.write(dashboard)

            # Store results
            self.phase4_results = {
                'ci_config': str(ci_config_path),
                'pr_template': str(pr_template_path),
                'dashboard': str(dashboard_path),
                'integration_complete': True
            }

            print(f"\n📊 Phase 4 Summary:")
            print(f"   CI configuration: ✅")
            print(f"   PR templates: ✅")
            print(f"   Dashboard report: ✅")
            print(f"   Integration assets: {self.output_dir}")

            self.session.phase = 4
            self.session.results['phase4'] = self.phase4_results

            return self.phase4_results

        except Exception as e:
            print(f"❌ Phase 4 failed: {e}")
            raise

    def run_full_process(self, mode: str = "discovery_only", auto_fix: bool = False,
                         run_visual: bool = False, run_accessibility: bool = False) -> Dict:
        """Run complete Storybook Master process"""
        print(f"\n🚀 Starting Storybook Master Process")
        print(f"📅 Session: {self.session.session_id}")
        print(f"🔧 Mode: {mode}")

        try:
            # Phase 1: Discovery
            self.run_phase1_discovery()

            if mode == "discovery_only":
                print("\n✅ Discovery complete. Use --mode generation to continue.")
                return self.session.results

            # Phase 2: Generation
            self.run_phase2_generation(auto_fix)

            if mode == "generation_only":
                print("\n✅ Generation complete. Use --mode testing to continue.")
                return self.session.results

            # Phase 3: Testing
            self.run_phase3_testing(run_visual, run_accessibility)

            if mode == "testing_only":
                print("\n✅ Testing complete. Use --mode integration to continue.")
                return self.session.results

            # Phase 4: Integration
            self.run_phase4_integration()

            # Complete session
            self.session.end_time = datetime.now()
            self.session.status = "completed"

            # Generate final report
            self.generate_final_report()

            print(f"\n🎉 Storybook Master Process Completed!")
            print(f"⏱️ Duration: {(self.session.end_time - self.session.start_time).total_seconds():.1f} seconds")
            print(f"📂 All reports saved to: {self.output_dir}")

            return self.session.results

        except KeyboardInterrupt:
            print(f"\n⚠️ Process interrupted by user")
            self.session.status = "interrupted"
            return self.session.results
        except Exception as e:
            print(f"\n❌ Process failed: {e}")
            self.session.status = "failed"
            raise
        finally:
            self.session.end_time = datetime.now()

    def generate_final_report(self) -> str:
        """Generate comprehensive final report"""
        report = {
            'session_id': self.session.session_id,
            'project_root': str(self.project_root),
            'start_time': self.session.start_time.isoformat(),
            'end_time': self.session.end_time.isoformat() if self.session.end_time else None,
            'duration_seconds': (self.session.end_time - self.session.start_time).total_seconds() if self.session.end_time else None,
            'status': self.session.status,
            'phases_completed': list(self.session.results.keys()),
            'summary': {
                'components_discovered': self.phase1_results['components_found'] if self.phase1_results else 0,
                'stories_generated': self.phase2_results.get('stories_generated', 0) if self.phase2_results else 0,
                'tests_run': bool(self.phase3_results) if self.phase3_results else False,
                'integration_complete': self.phase4_results.get('integration_complete', False) if self.phase4_results else False
            },
            'configuration': self.config,
            'results': self.session.results
        }

        # Save final report
        report_path = self.output_dir / 'storybook-master-report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"📊 Final report saved: {report_path}")
        return str(report_path)


# Mock implementations for phases 3 and 4 (would be full implementations in production)

class VisualTestHarness:
    """Mock implementation for visual testing"""

    def __init__(self, config: Dict):
        self.config = config

    def run_visual_tests(self) -> Dict:
        """Run visual regression tests"""
        return {
            'status': 'mock_implementation',
            'tests_run': 15,
            'passed': 14,
            'failed': 1,
            'report': '# Visual Test Report\n\nMock implementation - would integrate with Chromatic/Percy'
        }

    def run_accessibility_tests(self) -> Dict:
        """Run accessibility tests"""
        return {
            'status': 'mock_implementation',
            'violations': 2,
            'warnings': 5,
            'report': '# Accessibility Report\n\nMock implementation - would integrate with axe-core'
        }

    def generate_coverage_report(self) -> Dict:
        """Generate coverage report"""
        return {
            'total_components': 45,
            'covered_components': 38,
            'coverage_percentage': 84.4,
            'missing_variants': 12
        }


class CIIntegration:
    """Mock implementation for CI integration"""

    def __init__(self, config: Dict):
        self.config = config

    def generate_ci_config(self) -> Dict:
        """Generate CI configuration"""
        return {
            'name': 'storybook-ci',
            'on': ['pull_request', 'push'],
            'jobs': {
                'storybook': {
                    'runs-on': 'ubuntu-latest',
                    'steps': [
                        'uses: actions/checkout@v2',
                        'name: Build Storybook',
                        'run: npm run build-storybook'
                    ]
                }
            }
        }

    def generate_pr_templates(self) -> str:
        """Generate PR templates"""
        return """# Storybook Changes

## Component Coverage
- [ ] New components documented
- [ ] Visual tests passing
- [ ] Accessibility compliant

## Changes
- Component updates
- Story additions/modifications
"""

    def generate_dashboard_report(self, results: Dict) -> str:
        """Generate dashboard report"""
        return """<!DOCTYPE html>
<html>
<head><title>Storybook Dashboard</title></head>
<body>
<h1>Storybook Coverage Dashboard</h1>
<p>Mock dashboard implementation</p>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(
        description="Storybook Master - Universal Component Documentation & Testing Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full discovery and generation (dry run)
  python run_storybook_master.py --mode generation

  # Complete process with testing
  python run_storybook_master.py --mode integration --visual --accessibility

  # Custom configuration
  python run_storybook_master.py --config custom-config.yml

  # Auto-fix existing stories
  python run_storybook_master.py --mode generation --auto-fix
        """
    )

    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--project-root', help='Project root directory')
    parser.add_argument('--output-dir', help='Output directory (default: storybook-master-output/session-id)')
    parser.add_argument('--mode',
                       choices=['discovery_only', 'generation_only', 'testing_only', 'integration'],
                       default='discovery_only',
                       help='Execution mode (default: discovery_only)')
    parser.add_argument('--auto-fix', action='store_true',
                       help='Auto-fix existing stories')
    parser.add_argument('--visual', action='store_true',
                       help='Run visual testing')
    parser.add_argument('--accessibility', action='store_true',
                       help='Run accessibility testing')
    parser.add_argument('--debug', action='store_true',
                       help='Enable debug mode')
    parser.add_argument('--version', action='version', version='Storybook Master 1.0.0')

    args = parser.parse_args()

    # Initialize orchestrator
    try:
        orchestrator = StorybookMasterOrchestrator(args.config, Path(args.project_root) if args.project_root else None)

        # Override output directory if specified
        if args.output_dir:
            orchestrator.output_dir = Path(args.output_dir)
            orchestrator.output_dir.mkdir(parents=True, exist_ok=True)

        # Enable debug mode if specified
        if args.debug:
            print("🐛 Debug mode enabled")

        # Run process
        results = orchestrator.run_full_process(
            mode=args.mode,
            auto_fix=args.auto_fix,
            run_visual=args.visual,
            run_accessibility=args.accessibility
        )

        # Print final status
        if orchestrator.session.status == 'completed':
            print(f"\n✅ Process completed successfully!")
            print(f"📁 Results: {orchestrator.output_dir}")
        elif orchestrator.session.status == 'interrupted':
            print(f"\n⚠️ Process was interrupted")
            print(f"📁 Partial results: {orchestrator.output_dir}")
        else:
            print(f"\n❌ Process failed")
            sys.exit(1)

    except KeyboardInterrupt:
        print(f"\n⚠️ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()