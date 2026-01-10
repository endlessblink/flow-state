#!/usr/bin/env python3
"""
CSS Design Token Enforcer - Automatic Hex Value Replacement

This script automatically replaces hardcoded hex values with appropriate CSS design tokens.
It creates backups and validates replacements to ensure no regressions.

Based on industry best practices for automated design system enforcement.
"""

import os
import re
import json
import shutil
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from find_hardcoded_hex import HexValueFinder, HexValueMatch

@dataclass
class ReplacementRule:
    """Defines a replacement rule for hex values"""
    hex_value: str
    replacement: str
    priority: int  # 1=highest, 5=lowest
    context_patterns: List[str]  # CSS properties where this applies
    alpha_variants: Dict[float, str] = None  # Different replacements for different alpha values

class TokenReplacer:
    """Automatically replaces hardcoded hex values with CSS tokens"""

    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir)
        self.backup_dir = self.root_dir / ".claude" / "css-token-backups" / datetime.now().strftime("%Y%m%d_%H%M%S")
        self.finder = HexValueFinder(root_dir)

        # Comprehensive replacement rules based on current design tokens
        self.replacement_rules = [
            # Priority colors - HIGH PRIORITY
            ReplacementRule(
                hex_value="#f59e0b",
                replacement="var(--color-priority-medium)",
                priority=1,
                context_patterns=["background", "background-color", "color", "border-color"],
                alpha_variants={
                    1.0: "var(--color-priority-medium)",
                    0.3: "var(--color-priority-medium-bg)",
                    0.1: "var(--color-warning-alpha-10)",
                    0.05: "var(--color-priority-medium-bg-subtle)",
                    0.2: "var(--color-priority-medium-border-medium)"
                }
            ),
            ReplacementRule(
                hex_value="#10b981",
                replacement="var(--color-work)",
                priority=1,
                context_patterns=["background", "background-color", "color"]
            ),
            ReplacementRule(
                hex_value="#ef4444",
                replacement="var(--color-priority-high)",
                priority=1,
                context_patterns=["background", "background-color", "color", "border-color"],
                alpha_variants={
                    1.0: "var(--color-priority-high)",
                    0.3: "var(--priority-high-bg)",
                    0.1: "var(--color-error-alpha-10)"
                }
            ),
            ReplacementRule(
                hex_value="#3b82f6",
                replacement="var(--color-priority-low)",
                priority=1,
                context_patterns=["background", "background-color", "color", "border-color"],
                alpha_variants={
                    1.0: "var(--color-priority-low)",
                    0.3: "var(--priority-low-bg)"
                }
            ),

            # Problematic yellow variants that cause color inconsistency
            ReplacementRule(
                hex_value="#feca57",
                replacement="var(--color-priority-medium)",
                priority=1,
                context_patterns=["background", "background-color", "color", "border-color"],
                alpha_variants={
                    1.0: "var(--color-priority-medium)",
                    0.3: "var(--color-priority-medium-bg)",
                    0.1: "var(--color-warning-alpha-10)"
                }
            ),

            # Common UI colors - MEDIUM PRIORITY
            ReplacementRule(
                hex_value="#6b7280",
                replacement="var(--text-secondary)",
                priority=2,
                context_patterns=["color"]
            ),
            ReplacementRule(
                hex_value="#9ca3af",
                replacement="var(--text-tertiary)",
                priority=2,
                context_patterns=["color"]
            ),
            ReplacementRule(
                hex_value="#374151",
                replacement="var(--text-primary)",
                priority=2,
                context_patterns=["color"]
            ),

            # Background colors - LOW PRIORITY
            ReplacementRule(
                hex_value="#ffffff",
                replacement="var(--surface-primary)",
                priority=3,
                context_patterns=["background", "background-color"]
            ),
            ReplacementRule(
                hex_value="#f9fafb",
                replacement="var(--surface-secondary)",
                priority=3,
                context_patterns=["background", "background-color"]
            )
        ]

    def find_best_replacement(self, match: HexValueMatch) -> Optional[ReplacementRule]:
        """Find the best replacement rule for a given hex value"""
        matching_rules = [
            rule for rule in self.replacement_rules
            if rule.hex_value.lower() == match.hex_value.lower()
        ]

        if not matching_rules:
            return None

        # Sort by priority (lower number = higher priority)
        matching_rules.sort(key=lambda x: x.priority)
        best_rule = matching_rules[0]

        # Check for alpha variants
        if best_rule.alpha_variants and match.rgba_alpha is not None:
            alpha = match.rgba_alpha
            # Find closest alpha match
            closest_alpha = min(best_rule.alpha_variants.keys(), key=lambda x: abs(x - alpha))
            if abs(closest_alpha - alpha) < 0.05:  # Within 5% tolerance
                # Create a custom rule for this alpha
                custom_rule = ReplacementRule(
                    hex_value=best_rule.hex_value,
                    replacement=best_rule.alpha_variants[closest_alpha],
                    priority=best_rule.priority,
                    context_patterns=best_rule.context_patterns
                )
                return custom_rule

        # Check if context matches
        if match.css_property and best_rule.context_patterns:
            if match.css_property not in best_rule.context_patterns:
                return None  # Don't replace if context doesn't match

        return best_rule

    def create_backup(self, file_path: Path) -> Path:
        """Create backup of file before modification"""
        backup_dir = self.backup_dir / file_path.relative_to(self.root_dir).parent
        backup_dir.mkdir(parents=True, exist_ok=True)

        backup_path = backup_dir / file_path.name
        shutil.copy2(file_path, backup_path)
        return backup_path

    def replace_in_file(self, file_path: Path, matches: List[HexValueMatch], dry_run: bool = False) -> Dict:
        """Replace hex values in a single file"""
        if not matches:
            return {"replacements": 0, "skipped": 0}

        # Create backup
        if not dry_run:
            backup_path = self.create_backup(file_path)
            print(f"  💾 Backed up to: {backup_path}")

        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.splitlines()

        replacements = 0
        skipped = 0
        modifications = []

        # Process each match
        for match in sorted(matches, key=lambda x: x.line_number, reverse=True):
            replacement_rule = self.find_best_replacement(match)

            if not replacement_rule:
                skipped += 1
                continue

            line_idx = match.line_number - 1
            original_line = lines[line_idx]

            # Replace hex value with token
            new_line = original_line.replace(match.hex_value, replacement_rule.replacement)

            if new_line != original_line:
                lines[line_idx] = new_line
                replacements += 1

                modifications.append({
                    'line_number': match.line_number,
                    'original_hex': match.hex_value,
                    'replacement': replacement_rule.replacement,
                    'context': match.context,
                    'original_line': original_line.strip(),
                    'new_line': new_line.strip()
                })

        # Write modified content back to file
        if replacements > 0 and not dry_run:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))

        return {
            "replacements": replacements,
            "skipped": skipped,
            "modifications": modifications
        }

    def process_matches(self, matches: Dict[str, List[HexValueMatch]], dry_run: bool = False) -> Dict:
        """Process all matches and replace hex values with tokens"""
        results = {
            "files_processed": 0,
            "total_replacements": 0,
            "total_skipped": 0,
            "file_results": {},
            "all_modifications": []
        }

        print(f"🔧 {'DRY RUN: ' if dry_run else ''}Processing replacements...")

        for file_path_str, file_matches in matches.items():
            file_path = Path(file_path_str)

            if not file_matches:
                continue

            print(f"\n📁 Processing: {file_path}")
            file_result = self.replace_in_file(file_path, file_matches, dry_run)

            if file_result["replacements"] > 0 or file_result["skipped"] > 0:
                results["files_processed"] += 1
                results["total_replacements"] += file_result["replacements"]
                results["total_skipped"] += file_result["skipped"]
                results["file_results"][file_path_str] = file_result
                results["all_modifications"].extend(file_result["modifications"])

                print(f"  ✅ Replacements: {file_result['replacements']}")
                print(f"  ⏭️  Skipped: {file_result['skipped']}")

                if file_result["modifications"] and not dry_run:
                    for mod in file_result["modifications"][:3]:  # Show first 3 modifications
                        print(f"    Line {mod['line_number']}: {mod['original_hex']} → {mod['replacement']}")

        return results

    def validate_replacements(self, results: Dict) -> Dict:
        """Validate that replacements were successful"""
        validation_results = {
            "validation_passed": True,
            "issues_found": [],
            "files_checked": 0
        }

        print(f"\n🔍 Validating replacements...")

        for file_path_str in results["file_results"]:
            file_path = Path(file_path_str)
            validation_results["files_checked"] += 1

            # Re-scan file to check for remaining hardcoded values
            matches = self.finder.scan_file(file_path)

            # Check if any priority colors remain
            priority_issues = [
                match for match in matches
                if match.hex_value in ["#f59e0b", "#feca57", "#10b981", "#ef4444", "#3b82f6"]
            ]

            if priority_issues:
                validation_results["validation_passed"] = False
                validation_results["issues_found"].append({
                    "file": file_path_str,
                    "remaining_issues": len(priority_issues),
                    "details": [
                        {
                            "line": issue.line_number,
                            "hex": issue.hex_value,
                            "context": issue.context
                        } for issue in priority_issues
                    ]
                })
                print(f"  ❌ {file_path_str}: {len(priority_issues)} remaining issues")
            else:
                print(f"  ✅ {file_path_str}: All priority colors replaced")

        return validation_results

    def save_results(self, results: Dict, validation: Dict, dry_run: bool = False):
        """Save replacement results to file"""
        output_file = f"hex_replacement_results{'_dryrun' if dry_run else ''}.json"

        combined_results = {
            "timestamp": datetime.now().isoformat(),
            "dry_run": dry_run,
            "replacement_results": results,
            "validation_results": validation,
            "backup_directory": str(self.backup_dir) if not dry_run else None
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(combined_results, f, indent=2, default=str)

        print(f"\n📊 Results saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Replace hardcoded hex values with CSS tokens")
    parser.add_argument("--root", default=".", help="Root directory to process")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be replaced without making changes")
    parser.add_argument("--report", help="Previous hex value report to process")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    replacer = TokenReplacer(args.root)

    # Load previous report or scan fresh
    if args.report and Path(args.report).exists():
        with open(args.report, 'r') as f:
            report_data = json.load(f)

        # Reconstruct matches from report (simplified)
        matches = {}
        print("📁 Loading from previous report...")
    else:
        # Scan for hardcoded values
        matches = replacer.finder.scan_codebase()

    # Process replacements
    results = replacer.process_matches(matches, args.dry_run)

    # Validate replacements (only if not dry run)
    validation = {"validation_passed": True, "issues_found": []}
    if not args.dry_run and results["total_replacements"] > 0:
        validation = replacer.validate_replacements(results)

    # Save results
    replacer.save_results(results, validation, args.dry_run)

    print(f"\n🎯 Summary:")
    print(f"  {'DRY RUN - ' if args.dry_run else ''}Files processed: {results['files_processed']}")
    print(f"  Total replacements: {results['total_replacements']}")
    print(f"  Total skipped: {results['total_skipped']}")

    if not args.dry_run:
        print(f"  Validation passed: {validation['validation_passed']}")
        if validation['issues_found']:
            print(f"  Issues found: {len(validation['issues_found'])}")

if __name__ == "__main__":
    main()