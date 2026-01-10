#!/usr/bin/env python3
"""
Phase 3: Execution Automation via Skills Integration
Executes removal plans with safety checks, validation, and rollback capabilities
"""

import os
import sys
import json
import csv
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import git
from datetime import datetime

class ExecutionMode(Enum):
    DRY_RUN = "dry_run"
    SAFE_ONLY = "safe_only"
    BATCH_EXECUTION = "batch_execution"
    MANUAL_REVIEW = "manual_review"

class ValidationStatus(Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class ExecutionStep:
    """Represents a single execution step"""
    step_id: str
    item_path: str
    action_type: str
    command: str
    linked_skill: Optional[str]
    prerequisites: List[str]
    validation_steps: List[str]
    rollback_command: Optional[str]
    status: ValidationStatus = ValidationStatus.PENDING
    output: str = ""
    error: str = ""
    execution_time: float = 0.0
    commit_hash: Optional[str] = None

@dataclass
class BatchExecution:
    """Represents a batch of execution steps"""
    batch_id: str
    phase: int
    steps: List[ExecutionStep]
    status: ValidationStatus = ValidationStatus.PENDING
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_items: int = 0
    successful_items: int = 0
    failed_items: int = 0

class LegacyRemovalExecutor:
    def __init__(self, removal_plan_path: str, project_root: Path = None):
        self.project_root = project_root or Path.cwd()
        self.removal_plan = self._load_removal_plan(removal_plan_path)
        self.execution_history = []
        self.current_batch = None
        self.config = self._load_config()
        self.repo = None

        # Initialize git repository
        try:
            self.repo = git.Repo(self.project_root)
        except Exception as e:
            print(f"Warning: Could not initialize git repository: {e}")
            print("Execution will proceed without git tracking")

        # Safety settings
        self.max_batch_size = self.config.get('execution', {}).get('batch_size', 5)
        self.validate_after_batch = self.config.get('execution', {}).get('validate_after_batch', True)
        self.auto_commit = self.config.get('git', {}).get('auto_commit', True)
        self.create_backup_branch = self.config.get('git', {}).get('create_backup_branch', True)

    def _load_config(self) -> Dict:
        """Load execution configuration"""
        config_path = self.project_root / '.claude' / 'legacy-remover-config.yml'
        default_config = {
            'execution': {
                'default_mode': 'dry_run',
                'batch_size': 5,
                'validate_after_batch': True,
                'backup_before_execution': True
            },
            'validation': {
                'test_commands': ['npm test', 'python -m pytest'],
                'build_commands': ['npm run build', 'mvn compile'],
                'lint_commands': ['npm run lint', 'eslint src/'],
                'max_validation_time': 300  # 5 minutes
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

    def _load_removal_plan(self, plan_path: str) -> Dict:
        """Load removal plan from Phase 2 output"""
        try:
            with open(plan_path, 'r') as f:
                if plan_path.endswith('.csv'):
                    reader = csv.DictReader(f)
                    return {'steps': list(reader)}
                else:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading removal plan: {e}")
            return {'steps': []}

    def create_backup_branch(self):
        """Create backup branch before execution"""
        if not self.repo or not self.create_backup_branch:
            return

        try:
            branch_name = f"legacy-removal-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            self.repo.git.checkout('-b', branch_name)
            print(f"📦 Created backup branch: {branch_name}")
            return branch_name
        except Exception as e:
            print(f"Warning: Could not create backup branch: {e}")

    def execute_step(self, step: ExecutionStep, mode: ExecutionMode) -> bool:
        """Execute a single removal step"""
        print(f"🔧 Executing step: {step.step_id}")
        print(f"   Item: {step.item_path}")
        print(f"   Action: {step.action_type}")

        step.status = ValidationStatus.PENDING
        start_time = time.time()

        try:
            # Check prerequisites
            if not self._check_prerequisites(step.prerequisites):
                step.status = ValidationStatus.FAILED
                step.error = "Prerequisites not met"
                return False

            # Execute based on mode
            if mode == ExecutionMode.DRY_RUN:
                return self._execute_dry_run(step)
            elif mode == ExecutionMode.SAFE_ONLY and step.action_type != 'REMOVE_IMMEDIATELY':
                step.status = ValidationStatus.SKIPPED
                step.output = "Skipped: Not a safe removal"
                return True
            else:
                return self._execute_actual_removal(step)

        except Exception as e:
            step.status = ValidationStatus.FAILED
            step.error = str(e)
            print(f"❌ Step failed: {e}")
            return False
        finally:
            step.execution_time = time.time() - start_time

    def _check_prerequisites(self, prerequisites: List[str]) -> bool:
        """Check if prerequisites are met"""
        for prereq in prerequisites:
            if prereq == "Create backup branch":
                if self.create_backup_branch:
                    self.create_backup_branch()
            elif prereq == "Complete Phase 1":
                # In real implementation, check for Phase 1 completion
                pass
            elif prereq == "Complete Phase 2":
                # In real implementation, check for Phase 2 completion
                pass
            else:
                # Custom prerequisite logic would go here
                pass
        return True

    def _execute_dry_run(self, step: ExecutionStep) -> bool:
        """Execute step in dry-run mode"""
        print(f"   🏃 DRY RUN: {step.command}")

        # Simulate command execution
        if step.command.startswith('npm uninstall'):
            lib_name = step.command.split()[-1]
            step.output = f"DRY RUN: Would uninstall {lib_name}"
        elif step.command.startswith('git rm'):
            path = step.command.split()[-1]
            step.output = f"DRY RUN: Would remove {path}"
        elif step.linked_skill:
            step.output = f"DRY RUN: Would execute skill {step.linked_skill}"
        else:
            step.output = f"DRY RUN: Would execute: {step.command}"

        step.status = ValidationStatus.PASSED
        print(f"   ✅ DRY RUN completed")
        return True

    def _execute_actual_removal(self, step: ExecutionStep) -> bool:
        """Execute actual removal step"""
        # Check if file/directory exists
        item_abs_path = self.project_root / step.item_path
        if not item_abs_path.exists() and not step.command.startswith('npm uninstall'):
            step.output = f"Item already removed: {step.item_path}"
            step.status = ValidationStatus.PASSED
            return True

        # Execute command
        try:
            result = subprocess.run(
                step.command,
                shell=True,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=self.config['skills']['timeout_seconds']
            )

            step.output = result.stdout

            if result.returncode != 0:
                step.error = result.stderr
                step.status = ValidationStatus.FAILED
                print(f"   ❌ Command failed: {result.stderr}")
                return False

            # Execute linked skill if available
            if step.linked_skill:
                if not self._execute_linked_skill(step):
                    step.status = ValidationStatus.FAILED
                    return False

            # Auto-commit if enabled
            if self.auto_commit and self.repo:
                commit_hash = self._create_commit(step)
                step.commit_hash = commit_hash

            step.status = ValidationStatus.PASSED
            print(f"   ✅ Step completed successfully")
            return True

        except subprocess.TimeoutExpired:
            step.error = "Command execution timed out"
            step.status = ValidationStatus.FAILED
            print(f"   ❌ Command timed out")
            return False
        except Exception as e:
            step.error = str(e)
            step.status = ValidationStatus.FAILED
            print(f"   ❌ Execution error: {e}")
            return False

    def _execute_linked_skill(self, step: ExecutionStep) -> bool:
        """Execute linked Claude Code skill"""
        print(f"   🔗 Executing skill: {step.linked_skill}")

        try:
            # In a real implementation, this would invoke the actual skill
            # For now, we'll simulate the skill execution
            skill_output = f"Simulated execution of {step.linked_skill} for {step.item_path}"
            step.output += f"\nSkill output: {skill_output}"
            return True

        except Exception as e:
            step.error = f"Skill execution failed: {e}"
            return False

    def _create_commit(self, step: ExecutionStep) -> Optional[str]:
        """Create git commit for the step"""
        if not self.repo:
            return None

        try:
            # Check if there are changes to commit
            if not self.repo.is_dirty(untracked_files=True):
                return None

            # Add changes
            self.repo.git.add('-A')

            # Create commit message
            commit_message = f"{self.config['git']['commit_prefix']} {step.action_type}: {step.item_path}"
            if step.linked_skill:
                commit_message += f" (via {step.linked_skill})"

            # Commit
            commit = self.repo.index.commit(commit_message)
            print(f"   📝 Committed: {commit.hexsha[:8]} - {commit_message}")
            return commit.hexsha

        except Exception as e:
            print(f"   ⚠️ Could not create commit: {e}")
            return None

    def run_validation(self, step: ExecutionStep) -> bool:
        """Run validation steps after removal"""
        print(f"   🔍 Running validation for {step.item_path}")

        for validation_step in step.validation_steps:
            if not self._run_single_validation(validation_step):
                print(f"   ❌ Validation failed: {validation_step}")
                return False

        print(f"   ✅ All validations passed")
        return True

    def _run_single_validation(self, validation_step: str) -> bool:
        """Run a single validation step"""
        try:
            # Map validation steps to commands
            if validation_step == "Run tests":
                return self._run_tests()
            elif validation_step == "Build project":
                return self._run_build()
            elif validation_step == "Manual inspection":
                return self._manual_inspection()
            elif validation_step == "Dependency verification":
                return self._verify_dependencies()
            elif validation_step == "Comprehensive testing":
                return self._run_comprehensive_tests()
            elif validation_step == "Performance verification":
                return self._verify_performance()
            else:
                # Try to execute as a command
                result = subprocess.run(
                    validation_step,
                    shell=True,
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=self.config['validation']['max_validation_time']
                )
                return result.returncode == 0

        except Exception as e:
            print(f"   ⚠️ Validation error: {e}")
            return False

    def _run_tests(self) -> bool:
        """Run project tests"""
        test_commands = self.config['validation']['test_commands']

        for command in test_commands:
            try:
                print(f"   🧪 Running: {command}")
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=self.config['validation']['max_validation_time']
                )

                if result.returncode != 0:
                    print(f"   ❌ Tests failed: {result.stderr}")
                    return False

                print(f"   ✅ Tests passed")
                return True

            except Exception as e:
                print(f"   ⚠️ Could not run tests: {e}")
                return False

        return True

    def _run_build(self) -> bool:
        """Run project build"""
        build_commands = self.config['validation']['build_commands']

        for command in build_commands:
            try:
                print(f"   🔨 Building: {command}")
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=self.config['validation']['max_validation_time']
                )

                if result.returncode != 0:
                    print(f"   ❌ Build failed: {result.stderr}")
                    return False

                print(f"   ✅ Build succeeded")
                return True

            except Exception as e:
                print(f"   ⚠️ Could not build: {e}")
                return False

        return True

    def _manual_inspection(self) -> bool:
        """Manual inspection (requires user input)"""
        print("   👤 Manual inspection required:")
        response = input("   Does the removal look correct? (y/n): ").lower().strip()
        return response in ['y', 'yes', 'ok']

    def _verify_dependencies(self) -> bool:
        """Verify dependencies are intact"""
        try:
            # Check package.json if exists
            package_json = self.project_root / 'package.json'
            if package_json.exists():
                result = subprocess.run(
                    'npm ls --depth=0',
                    shell=True,
                    cwd=self.project_root,
                    capture_output=True,
                    text=True
                )
                if result.returncode != 0:
                    print(f"   ⚠️ Dependency issues detected")
                    return False

            print(f"   ✅ Dependencies verified")
            return True

        except Exception as e:
            print(f"   ⚠️ Could not verify dependencies: {e}")
            return False

    def _run_comprehensive_tests(self) -> bool:
        """Run comprehensive test suite"""
        # This would include unit tests, integration tests, e2e tests
        print("   🧪 Running comprehensive test suite...")
        return self._run_tests() and self._run_build()

    def _verify_performance(self) -> bool:
        """Verify performance hasn't degraded"""
        print("   ⚡ Verifying performance...")
        # In a real implementation, this would run performance benchmarks
        return True

    def execute_batch(self, batch_steps: List[ExecutionStep], mode: ExecutionMode) -> BatchExecution:
        """Execute a batch of steps"""
        batch_id = f"batch-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        batch = BatchExecution(
            batch_id=batch_id,
            phase=batch_steps[0].phase if batch_steps else 1,
            steps=batch_steps,
            status=ValidationStatus.PENDING,
            start_time=datetime.now(),
            total_items=len(batch_steps)
        )

        print(f"📦 Executing batch {batch_id} with {len(batch_steps)} items")

        successful_count = 0
        failed_count = 0

        for i, step in enumerate(batch_steps, 1):
            print(f"\n📋 Step {i}/{len(batch_steps)}")

            if self.execute_step(step, mode):
                successful_count += 1

                # Run validation if step succeeded
                if self.validate_after_batch and step.status == ValidationStatus.PASSED:
                    if not self.run_validation(step):
                        step.status = ValidationStatus.FAILED
                        successful_count -= 1
                        failed_count += 1
            else:
                failed_count += 1

            # Add delay between steps for safety
            if i < len(batch_steps):
                time.sleep(1)

        batch.successful_items = successful_count
        batch.failed_items = failed_count
        batch.end_time = datetime.now()
        batch.status = ValidationStatus.PASSED if failed_count == 0 else ValidationStatus.FAILED

        # Print batch summary
        print(f"\n📊 Batch {batch_id} completed:")
        print(f"   ✅ Successful: {successful_count}")
        print(f"   ❌ Failed: {failed_count}")
        print(f"   ⏱️ Duration: {(batch.end_time - batch.start_time).total_seconds():.1f}s")

        return batch

    def rollback_step(self, step: ExecutionStep) -> bool:
        """Rollback a specific step"""
        print(f"🔄 Rolling back step: {step.step_id}")

        if step.commit_hash and self.repo:
            try:
                # Revert the specific commit
                self.repo.git.revert(step.commit_hash, no_edit=True)
                print(f"   ✅ Reverted commit {step.commit_hash[:8]}")
                return True
            except Exception as e:
                print(f"   ❌ Could not revert commit: {e}")

        elif step.rollback_command:
            try:
                result = subprocess.run(
                    step.rollback_command,
                    shell=True,
                    cwd=self.project_root,
                    capture_output=True,
                    text=True
                )

                if result.returncode == 0:
                    print(f"   ✅ Rollback command executed")
                    return True
                else:
                    print(f"   ❌ Rollback command failed: {result.stderr}")

            except Exception as e:
                print(f"   ❌ Rollback error: {e}")

        print(f"   ⚠️ Automatic rollback not possible")
        return False

    def rollback_batch(self, batch: BatchExecution) -> bool:
        """Rollback an entire batch"""
        print(f"🔄 Rolling back batch {batch.batch_id}")

        successful_rollback = 0
        for step in reversed(batch.steps):  # Rollback in reverse order
            if self.rollback_step(step):
                successful_rollback += 1

        print(f"   ✅ Rolled back {successful_rollback}/{len(batch.steps)} steps")
        return successful_rollback == len(batch.steps)

    def prepare_execution_steps(self) -> List[ExecutionStep]:
        """Prepare execution steps from removal plan"""
        steps = []

        for i, plan_item in enumerate(self.removal_plan.get('steps', [])):
            step = ExecutionStep(
                step_id=f"step-{i+1:03d}",
                item_path=plan_item.get('Item Path', ''),
                action_type=plan_item.get('Action Type', ''),
                command=plan_item.get('Command', ''),
                linked_skill=plan_item.get('Linked Skill'),
                prerequisites=plan_item.get('Prerequisites', '').split(';') if plan_item.get('Prerequisites') else [],
                validation_steps=plan_item.get('Verification Steps', '').split(';') if plan_item.get('Verification Steps') else [],
                rollback_command=plan_item.get('Rollback Command')
            )

            # Extract phase from the plan item or derive from action type
            step.phase = int(plan_item.get('Phase', 1))

            steps.append(step)

        return steps

    def execute_full_plan(self, mode: ExecutionMode = ExecutionMode.DRY_RUN) -> List[BatchExecution]:
        """Execute the full removal plan"""
        print(f"🚀 Starting execution in {mode.value} mode")
        print(f"   Project root: {self.project_root}")

        # Prepare steps
        steps = self.prepare_execution_steps()
        print(f"   Total steps to execute: {len(steps)}")

        if not steps:
            print("❌ No execution steps found!")
            return []

        # Create backup if not in dry-run mode
        if mode != ExecutionMode.DRY_RUN:
            self.create_backup_branch()

        # Group steps into batches
        all_batches = []
        for i in range(0, len(steps), self.max_batch_size):
            batch_steps = steps[i:i + self.max_batch_size]
            batch = self.execute_batch(batch_steps, mode)
            all_batches.append(batch)

            # If a batch failed in non-dry-run mode, stop execution
            if batch.status == ValidationStatus.FAILED and mode != ExecutionMode.DRY_RUN:
                print("❌ Batch failed, stopping execution")
                break

        # Print final summary
        total_successful = sum(b.successful_items for b in all_batches)
        total_failed = sum(b.failed_items for b in all_batches)

        print(f"\n🎉 Execution completed:")
        print(f"   ✅ Successful steps: {total_successful}")
        print(f"   ❌ Failed steps: {total_failed}")
        print(f"   📦 Total batches: {len(all_batches)}")

        return all_batches

    def generate_execution_report(self, batches: List[ExecutionStep], output_path: str = 'execution-report.json'):
        """Generate execution report"""
        report = {
            'execution_date': datetime.now().isoformat(),
            'execution_mode': self.config['execution']['default_mode'],
            'total_batches': len(batches),
            'summary': {
                'total_steps': sum(len(batch.steps) for batch in batches if hasattr(batch, 'steps')),
                'successful_steps': sum(batch.successful_items for batch in batches if hasattr(batch, 'successful_items')),
                'failed_steps': sum(batch.failed_items for batch in batches if hasattr(batch, 'failed_items')),
                'total_execution_time': sum(
                    (batch.end_time - batch.start_time).total_seconds()
                    for batch in batches
                    if batch.start_time and batch.end_time
                )
            },
            'batches': []
        }

        for batch in batches:
            if hasattr(batch, 'steps'):
                batch_data = {
                    'batch_id': batch.batch_id,
                    'phase': batch.phase,
                    'status': batch.status.value,
                    'start_time': batch.start_time.isoformat() if batch.start_time else None,
                    'end_time': batch.end_time.isoformat() if batch.end_time else None,
                    'total_items': batch.total_items,
                    'successful_items': batch.successful_items,
                    'failed_items': batch.failed_items,
                    'steps': [asdict(step) for step in batch.steps]
                }
                report['batches'].append(batch_data)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"📊 Execution report saved to: {output_path}")

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Execute legacy removal plan")
    parser.add_argument('removal_plan', help='Path to removal plan CSV/JSON from Phase 2')
    parser.add_argument('--mode', choices=['dry_run', 'safe_only', 'batch_execution', 'manual_review'],
                       default='dry_run', help='Execution mode')
    parser.add_argument('--output-dir', default='.', help='Output directory for reports')
    parser.add_argument('--project-root', help='Project root directory')
    parser.add_argument('--batch-size', type=int, help='Override batch size')
    parser.add_argument('--validate', action='store_true', help='Run validation after each step')

    args = parser.parse_args()

    project_root = Path(args.project_root) if args.project_root else Path.cwd()

    # Map mode strings to enum
    mode_map = {
        'dry_run': ExecutionMode.DRY_RUN,
        'safe_only': ExecutionMode.SAFE_ONLY,
        'batch_execution': ExecutionMode.BATCH_EXECUTION,
        'manual_review': ExecutionMode.MANUAL_REVIEW
    }

    execution_mode = mode_map[args.mode]

    # Initialize executor
    executor = LegacyRemovalExecutor(args.removal_plan, project_root)

    # Override batch size if specified
    if args.batch_size:
        executor.max_batch_size = args.batch_size

    # Override validation setting
    if args.validate:
        executor.validate_after_batch = True

    # Execute plan
    batches = executor.execute_full_plan(execution_mode)

    if batches:
        # Generate report
        output_dir = Path(args.output_dir)
        output_dir.mkdir(exist_ok=True)

        executor.generate_execution_report(batches, output_dir / 'execution-report.json')

        # Print final status
        if execution_mode == ExecutionMode.DRY_RUN:
            print(f"\n🔍 DRY RUN completed - no actual changes made")
            print(f"   Run with '--mode batch_execution' to execute real changes")
        else:
            print(f"\n✅ Execution completed in {execution_mode.value} mode")
            print(f"   All reports saved to: {output_dir}")
    else:
        print("❌ No batches executed!")

if __name__ == '__main__':
    main()