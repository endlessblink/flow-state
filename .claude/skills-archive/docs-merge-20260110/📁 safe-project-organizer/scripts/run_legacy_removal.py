#!/usr/bin/env python3
"""
Legacy Tech Remover - Main Orchestrator
Coordinates all 4 phases of legacy technology removal
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
    from phase1_detection import LegacyDetector
    from phase2_assessment import ImpactAnalyzer, RiskCategory
    from phase3_execution import LegacyRemovalExecutor, ExecutionMode
    from phase4_documentation import DocumentationManager
except ImportError as e:
    print(f"Error importing phase modules: {e}")
    print("Please ensure all phase scripts are in the same directory")
    sys.exit(1)

@dataclass
class LegacyRemovalSession:
    """Represents a complete legacy removal session"""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    phase: int = 1
    mode: str = "detection_only"
    config: Dict = None
    results: Dict = None
    status: str = "in_progress"

class LegacyRemovalOrchestrator:
    def __init__(self, config_path: str = None, project_root: Path = None):
        self.project_root = project_root or Path.cwd()
        self.session = LegacyRemovalSession(
            session_id=f"legacy-removal-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            start_time=datetime.now(),
            config=self._load_config(config_path),
            results={}
        )

        # Initialize output directory
        self.output_dir = self.project_root / 'legacy-removal-output' / self.session.session_id
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Phase results
        self.phase1_results = None
        self.phase2_results = None
        self.phase3_results = None
        self.phase4_results = None

        print(f"🧹 Legacy Tech Remover - Session {self.session.session_id}")
        print(f"📁 Project: {self.project_root}")
        print(f"📂 Output: {self.output_dir}")

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from file or use defaults"""
        default_config = {
            'detection': {
                'min_years_untouched': 2,
                'safe_folder_patterns': ['^src/legacy/', '^old/', '^bak/', '^deprecated/'],
                'protected_packages': ['core-js', 'typescript', 'react', 'vue', 'angular'],
                'excluded_paths': ['node_modules', '.git', 'dist', 'build', 'coverage']
            },
            'risk_thresholds': {
                'safe_removal': 0.2,
                'caution_zone': 0.6,
                'risky_removal': 0.8
            },
            'execution': {
                'default_mode': 'dry_run',
                'batch_size': 5,
                'validate_after_batch': True,
                'backup_before_execution': True
            },
            'validation': {
                'test_commands': ['npm test', 'python -m pytest'],
                'build_commands': ['npm run build', 'mvn compile'],
                'max_validation_time': 300
            },
            'git': {
                'auto_commit': True,
                'commit_prefix': '[legacy-removal]',
                'create_backup_branch': True,
                'push_commits': False
            },
            'skills': {
                'timeout_seconds': 60,
                'retry_attempts': 3,
                'skill_mappings': {
                    'library_removal': '/skill-remove-library',
                    'folder_removal': '/skill-code-folder-remove',
                    'config_cleanup': '/skill-config-cleanup',
                    'code_review': '/skill-request-code-review'
                }
            },
            'documentation': {
                'auto_update': True,
                'backup_docs': True,
                'create_migration_guide': True
            },
            'communication': {
                'auto_pr': True,
                'team_announcement': True,
                'channels': ['slack', 'github']
            },
            'safety': {
                'require_confirmation': True,
                'max_risk_level': 'caution',
                'emergency_stop': True
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
                print("Using default configuration")
        else:
            # Try to find default config file
            default_config_path = self.project_root / '.claude' / 'legacy-remover-config.yml'
            if default_config_path.exists():
                try:
                    with open(default_config_path, 'r') as f:
                        user_config = yaml.safe_load(f)
                    self._merge_configs(default_config, user_config)
                    print(f"✅ Configuration loaded from: {default_config_path}")
                except Exception as e:
                    print(f"⚠️ Could not load default config: {e}")
                    print("Using built-in configuration")
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

    def run_phase1_detection(self, focus_areas: List[str] = None) -> Dict:
        """Run Phase 1: Legacy Detection & Inventory"""
        print("\n" + "="*60)
        print("🔍 PHASE 1: Legacy Detection & Inventory")
        print("="*60)

        try:
            # Initialize detector
            detector = LegacyDetector()

            # Run detection
            if focus_areas:
                legacy_items = []
                for area in focus_areas:
                    print(f"\n🔎 Focusing on: {area}")
                    if area == 'dependencies':
                        legacy_items.extend(detector.detect_legacy_dependencies())
                    elif area == 'dirs':
                        legacy_items.extend(detector.detect_legacy_directories())
                    elif area == 'files':
                        legacy_items.extend(detector.detect_legacy_files())
                    elif area == 'configs':
                        legacy_items.extend(detector.detect_legacy_configs())
            else:
                legacy_items = detector.run_full_scan()

            # Generate reports
            if legacy_items:
                inventory_path = self.output_dir / 'legacy-inventory.csv'
                detector.generate_inventory_csv(str(inventory_path))

                tree_path = self.output_dir / 'legacy-directories.tree'
                detector.generate_directory_tree(str(tree_path))

                summary_path = self.output_dir / 'legacy-summary.json'
                detector.generate_summary_report(str(summary_path))

            # Store results
            self.phase1_results = {
                'items_found': len(legacy_items),
                'items': legacy_items,
                'reports': {
                    'inventory': str(inventory_path) if legacy_items else None,
                    'tree': str(tree_path) if legacy_items else None,
                    'summary': str(summary_path) if legacy_items else None
                }
            }

            # Print summary
            high_risk = len([i for i in legacy_items if float(i.get('Risk Score', 0)) > 0.7])
            print(f"\n📊 Phase 1 Summary:")
            print(f"   Total legacy items: {len(legacy_items)}")
            print(f"   High risk items: {high_risk}")
            print(f"   Reports saved to: {self.output_dir}")

            self.session.phase = 1
            self.session.results['phase1'] = self.phase1_results

            return self.phase1_results

        except Exception as e:
            print(f"❌ Phase 1 failed: {e}")
            raise

    def run_phase2_assessment(self) -> Dict:
        """Run Phase 2: Impact Assessment & Risk Analysis"""
        print("\n" + "="*60)
        print("⚖️ PHASE 2: Impact Assessment & Risk Analysis")
        print("="*60)

        if not self.phase1_results or not self.phase1_results.get('items'):
            print("❌ No legacy items to assess. Run Phase 1 first.")
            return {}

        try:
            # Initialize analyzer
            inventory_path = self.phase1_results['reports']['inventory']
            analyzer = ImpactAnalyzer(str(inventory_path), self.project_root)

            # Run assessment
            assessments = analyzer.run_full_assessment()

            if assessments:
                # Create removal plan
                removal_plans = analyzer.create_removal_plan()

                # Generate reports
                assessment_report_path = self.output_dir / 'impact-assessment-report.json'
                analyzer.generate_assessment_report(str(assessment_report_path))

                removal_plan_path = self.output_dir / 'removal-plan.csv'
                analyzer.generate_removal_plan_csv(removal_plans, str(removal_plan_path))

            # Store results
            self.phase2_results = {
                'assessments_completed': len(assessments),
                'assessments': assessments,
                'removal_plans': removal_plans,
                'reports': {
                    'assessment': str(assessment_report_path) if assessments else None,
                    'removal_plan': str(removal_plan_path) if removal_plans else None
                }
            }

            # Print summary
            safe_count = len([a for a in assessments if a.risk_category == RiskCategory.SAFE])
            caution_count = len([a for a in assessments if a.risk_category == RiskCategory.CAUTION])
            risky_count = len([a for a in assessments if a.risk_category == RiskCategory.RISKY])

            print(f"\n📊 Phase 2 Summary:")
            print(f"   Items assessed: {len(assessments)}")
            print(f"   Safe to remove: {safe_count}")
            print(f"   Requires review: {caution_count}")
            print(f"   Risky (migration needed): {risky_count}")
            print(f"   Total estimated effort: {sum(a.estimated_effort for a in assessments)} hours")

            self.session.phase = 2
            self.session.results['phase2'] = self.phase2_results

            return self.phase2_results

        except Exception as e:
            print(f"❌ Phase 2 failed: {e}")
            raise

    def run_phase3_execution(self, mode: str = None) -> Dict:
        """Run Phase 3: Execution Automation"""
        print("\n" + "="*60)
        print("⚡ PHASE 3: Execution Automation")
        print("="*60)

        if not self.phase2_results or not self.phase2_results.get('removal_plan'):
            print("❌ No removal plan available. Run Phase 2 first.")
            return {}

        try:
            # Get execution mode
            execution_mode = mode or self.config['execution']['default_mode']
            mode_map = {
                'dry_run': ExecutionMode.DRY_RUN,
                'safe_only': ExecutionMode.SAFE_ONLY,
                'batch_execution': ExecutionMode.BATCH_EXECUTION,
                'manual_review': ExecutionMode.MANUAL_REVIEW
            }

            if execution_mode not in mode_map:
                print(f"❌ Invalid execution mode: {execution_mode}")
                return {}

            mode_enum = mode_map[execution_mode]
            print(f"🔧 Execution mode: {execution_mode}")

            # Safety confirmation
            if execution_mode != 'dry_run' and self.config['safety']['require_confirmation']:
                print("\n⚠️ SAFETY WARNING:")
                print(f"   About to execute legacy removal in {execution_mode} mode")
                print(f"   Mode: {execution_mode}")
                print(f"   Max risk level: {self.config['safety']['max_risk_level']}")

                response = input("\n   Continue? (yes/no): ").lower().strip()
                if response not in ['yes', 'y']:
                    print("   ❌ Execution cancelled by user")
                    return {}

            # Initialize executor
            removal_plan_path = self.phase2_results['reports']['removal_plan']
            executor = LegacyRemovalExecutor(str(removal_plan_path), self.project_root)

            # Apply configuration overrides
            executor.max_batch_size = self.config['execution']['batch_size']
            executor.validate_after_batch = self.config['execution']['validate_after_batch']
            executor.auto_commit = self.config['git']['auto_commit']
            executor.create_backup_branch = self.config['git']['create_backup_branch']

            # Execute plan
            batches = executor.execute_full_plan(mode_enum)

            # Generate report
            execution_report_path = self.output_dir / 'execution-report.json'
            executor.generate_execution_report(batches, str(execution_report_path))

            # Store results
            self.phase3_results = {
                'execution_mode': execution_mode,
                'batches_completed': len(batches),
                'batches': batches,
                'reports': {
                    'execution': str(execution_report_path) if batches else None
                }
            }

            # Print summary
            total_successful = sum(b.successful_items for b in batches if hasattr(b, 'successful_items'))
            total_failed = sum(b.failed_items for b in batches if hasattr(b, 'failed_items'))

            print(f"\n📊 Phase 3 Summary:")
            print(f"   Batches executed: {len(batches)}")
            print(f"   Successful steps: {total_successful}")
            print(f"   Failed steps: {total_failed}")

            self.session.phase = 3
            self.session.results['phase3'] = self.phase3_results

            return self.phase3_results

        except Exception as e:
            print(f"❌ Phase 3 failed: {e}")
            raise

    def run_phase4_documentation(self, dry_run: bool = False) -> Dict:
        """Run Phase 4: Documentation & Team Communication"""
        print("\n" + "="*60)
        print("📚 PHASE 4: Documentation & Team Communication")
        print("="*60)

        if not self.phase3_results:
            print("❌ No execution results available. Run Phase 3 first.")
            return {}

        try:
            # Initialize documentation manager
            execution_report_path = self.phase3_results['reports']['execution']
            doc_manager = DocumentationManager(str(execution_report_path), self.project_root)

            # Configure based on settings
            doc_manager.config['documentation'].update(self.config['documentation'])
            doc_manager.config['communication'].update(self.config['communication'])
            doc_manager.config['migration'].update(self.config.get('migration', {}))

            # Run documentation process
            results = doc_manager.run_full_documentation_process(dry_run)

            # Store results
            self.phase4_results = {
                'documentation_updates': len(results['doc_updates']),
                'team_communications': len(results['communications']),
                'migration_guide_created': bool(results['migration_guide']),
                'results': results
            }

            # Print summary
            print(f"\n📊 Phase 4 Summary:")
            print(f"   Documentation updates: {len(results['doc_updates'])}")
            print(f"   Team communications: {len(results['communications'])}")
            print(f"   Migration guide: {'Created' if results['migration_guide'] else 'Skipped'}")

            self.session.phase = 4
            self.session.results['phase4'] = self.phase4_results

            return self.phase4_results

        except Exception as e:
            print(f"❌ Phase 4 failed: {e}")
            raise

    def run_full_process(self, mode: str = "detection_only", focus_areas: List[str] = None) -> Dict:
        """Run complete legacy removal process"""
        print(f"\n🚀 Starting Legacy Tech Removal Process")
        print(f"📅 Session: {self.session.session_id}")
        print(f"🔧 Mode: {mode}")

        if focus_areas:
            print(f"🎯 Focus areas: {', '.join(focus_areas)}")

        try:
            # Phase 1: Detection
            self.run_phase1_detection(focus_areas)

            if mode == "detection_only":
                print("\n✅ Detection complete. Use --mode assessment to continue.")
                return self.session.results

            # Phase 2: Assessment
            self.run_phase2_assessment()

            if mode == "assessment_only":
                print("\n✅ Assessment complete. Use --mode execution to continue.")
                return self.session.results

            # Phase 3: Execution
            self.run_phase3_execution(mode.split('_')[0] if '_' in mode else mode)

            # Phase 4: Documentation (only if execution was successful)
            if self.phase3_results and mode not in ['dry_run_only']:
                self.run_phase4_documentation(mode == 'dry_run' or mode == 'dry_run_only')

            # Complete session
            self.session.end_time = datetime.now()
            self.session.status = "completed"

            # Generate final report
            self.generate_final_report()

            print(f"\n🎉 Legacy Tech Removal Process Completed!")
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
                'total_legacy_items': self.phase1_results['items_found'] if self.phase1_results else 0,
                'items_assessed': self.phase2_results['assessments_completed'] if self.phase2_results else 0,
                'batches_executed': self.phase3_results['batches_completed'] if self.phase3_results else 0,
                'documentation_updates': self.phase4_results['documentation_updates'] if self.phase4_results else 0
            },
            'configuration': self.config,
            'results': self.session.results
        }

        # Save final report
        report_path = self.output_dir / 'final-report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"📊 Final report saved: {report_path}")
        return str(report_path)

def main():
    parser = argparse.ArgumentParser(
        description="Legacy Tech Remover - Automated audit and clean-up",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full detection and assessment (dry run)
  python run_legacy_removal.py --mode assessment_only

  # Complete execution in dry-run mode
  python run_legacy_removal.py --mode dry_run

  # Execute safe removals only
  python run_legacy_removal.py --mode safe_only --focus dependencies,dirs

  # Custom configuration
  python run_legacy_removal.py --config custom-config.yml

  # Focus on specific areas only
  python run_legacy_removal.py --mode detection_only --focus dependencies
        """
    )

    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--project-root', help='Project root directory')
    parser.add_argument('--output-dir', help='Output directory (default: legacy-removal-output/session-id)')
    parser.add_argument('--mode',
                       choices=['detection_only', 'assessment_only', 'dry_run', 'safe_only', 'batch_execution'],
                       default='detection_only',
                       help='Execution mode (default: detection_only)')
    parser.add_argument('--focus',
                       help='Focus on specific areas: dependencies,dirs,files,configs (comma-separated)')
    parser.add_argument('--no-confirmation', action='store_true',
                       help='Skip safety confirmation prompts')
    parser.add_argument('--debug', action='store_true',
                       help='Enable debug mode with verbose logging')
    parser.add_argument('--version', action='version', version='Legacy Tech Remover 1.0.0')

    args = parser.parse_args()

    # Parse focus areas
    focus_areas = None
    if args.focus:
        focus_areas = [area.strip() for area in args.focus.split(',')]
        valid_areas = ['dependencies', 'dirs', 'files', 'configs']
        for area in focus_areas:
            if area not in valid_areas:
                print(f"❌ Invalid focus area: {area}")
                print(f"Valid areas: {', '.join(valid_areas)}")
                sys.exit(1)

    # Initialize orchestrator
    try:
        orchestrator = LegacyRemovalOrchestrator(args.config, Path(args.project_root) if args.project_root else None)

        # Override confirmation setting if specified
        if args.no_confirmation:
            orchestrator.config['safety']['require_confirmation'] = False

        # Override output directory if specified
        if args.output_dir:
            orchestrator.output_dir = Path(args.output_dir)
            orchestrator.output_dir.mkdir(parents=True, exist_ok=True)

        # Enable debug mode if specified
        if args.debug:
            orchestrator.config['advanced'] = orchestrator.config.get('advanced', {})
            orchestrator.config['advanced']['debug_mode'] = True
            print("🐛 Debug mode enabled")

        # Run process
        results = orchestrator.run_full_process(args.mode, focus_areas)

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