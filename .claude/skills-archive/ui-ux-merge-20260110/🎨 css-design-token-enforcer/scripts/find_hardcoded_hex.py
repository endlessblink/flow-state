#!/usr/bin/env python3
"""
CSS Design Token Enforcer - Hardcoded Hex Value Finder

This script scans the entire codebase for hardcoded hex values that should be replaced
with CSS design tokens. It identifies potential color inconsistencies and provides
detailed reports for systematic replacement.

Based on industry best practices from:
- Atlassian Design System
- Salesforce Lightning Design System
- CSS-Tricks design tokens guidance
- Enterprise design system standards
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class HexValueMatch:
    """Represents a hardcoded hex value found in the codebase"""
    file_path: str
    line_number: int
    hex_value: str
    context: str
    full_line: str
    css_property: str = None
    rgba_alpha: float = None

class HexValueFinder:
    """Finds and analyzes hardcoded hex values in codebase"""

    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir)
        self.hex_pattern = re.compile(
            r'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)',
            re.IGNORECASE
        )
        self.css_property_pattern = re.compile(
            r'(background|background-color|color|border-color|box-shadow|text-shadow):\s*([^;]+)',
            re.IGNORECASE
        )

        # Priority color mappings based on current design tokens
        self.priority_mappings = {
            '#f59e0b': 'var(--color-priority-medium)',
            '#10b981': 'var(--color-work)',
            '#ef4444': 'var(--color-priority-high)',
            '#3b82f6': 'var(--color-priority-low)',
            '#feca57': 'var(--color-priority-medium)',  # Yellow variant to replace
        }

        # File patterns to scan
        self.included_extensions = {'.vue', '.css', '.scss', '.less', '.ts', '.js'}
        self.excluded_dirs = {
            '.git', 'node_modules', '.nuxt', 'dist', 'build', '.cache',
            '.claude', 'coverage', '.vscode', '.idea'
        }

    def is_file_included(self, file_path: Path) -> bool:
        """Check if file should be scanned"""
        if file_path.suffix.lower() not in self.included_extensions:
            return False

        # Check if any parent directory is in excluded list
        for part in file_path.parts:
            if part in self.excluded_dirs:
                return False

        return True

    def extract_hex_values(self, text: str, line_num: int, file_path: str) -> List[HexValueMatch]:
        """Extract hex values from text line"""
        matches = []

        # Find all hex and rgb/rgba values
        for match in self.hex_pattern.finditer(text):
            if match.group(1):  # Hex format
                hex_value = f"#{match.group(1).lower()}"
                # Convert 3-digit hex to 6-digit
                if len(hex_value) == 4:
                    hex_value = f"#{hex_value[1]}{hex_value[1]}{hex_value[2]}{hex_value[2]}{hex_value[3]}{hex_value[3]}"
            else:  # RGB/RGBA format
                r, g, b, a = match.groups()
                hex_value = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                if a:
                    # Store alpha value for rgba
                    matches.append(HexValueMatch(
                        file_path=file_path,
                        line_number=line_num,
                        hex_value=hex_value,
                        context=text[max(0, match.start()-20):match.end()+20],
                        full_line=text,
                        rgba_alpha=float(a)
                    ))
                    continue

            matches.append(HexValueMatch(
                file_path=file_path,
                line_number=line_num,
                hex_value=hex_value,
                context=text[max(0, match.start()-20):match.end()+20],
                full_line=text
            ))

        return matches

    def find_css_property(self, line: str, match: HexValueMatch) -> str:
        """Extract CSS property name for a hex value"""
        css_match = self.css_property_pattern.search(line)
        if css_match:
            return css_match.group(1).lower()
        return None

    def scan_file(self, file_path: Path) -> List[HexValueMatch]:
        """Scan a single file for hardcoded hex values"""
        matches = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            for line_num, line in enumerate(lines, 1):
                hex_matches = self.extract_hex_values(line, line_num, str(file_path))
                for match in hex_matches:
                    match.css_property = self.find_css_property(line, match)
                    matches.append(match)

        except Exception as e:
            print(f"Error scanning {file_path}: {e}")

        return matches

    def scan_codebase(self) -> Dict[str, List[HexValueMatch]]:
        """Scan entire codebase for hardcoded hex values"""
        results = defaultdict(list)

        print("🔍 Scanning codebase for hardcoded hex values...")

        for file_path in self.root_dir.rglob('*'):
            if file_path.is_file() and self.is_file_included(file_path):
                matches = self.scan_file(file_path)
                if matches:
                    results[str(file_path)] = matches
                    print(f"  📁 {file_path}: {len(matches)} matches")

        return results

    def categorize_matches(self, matches: Dict[str, List[HexValueMatch]]) -> Dict[str, List[HexValueMatch]]:
        """Categorize matches by type and priority"""
        categories = {
            'priority_colors': [],
            'ui_colors': [],
            'semantic_colors': [],
            'unknown': []
        }

        for file_path, file_matches in matches.items():
            for match in file_matches:
                if match.hex_value in self.priority_mappings:
                    categories['priority_colors'].append(match)
                elif any(color in match.hex_value for color in ['ff', '00', '33', '66', '99', 'cc']):
                    categories['ui_colors'].append(match)
                elif 'gray' in match.full_line.lower() or 'neutral' in match.full_line.lower():
                    categories['semantic_colors'].append(match)
                else:
                    categories['unknown'].append(match)

        return categories

    def generate_report(self, matches: Dict[str, List[HexValueMatch]]) -> Dict:
        """Generate comprehensive report of findings"""
        total_matches = sum(len(file_matches) for file_matches in matches.values())
        categories = self.categorize_matches(matches)

        # Priority issues (colors that should definitely be replaced)
        priority_issues = []
        for match in categories['priority_colors']:
            priority_issues.append({
                'file': match.file_path,
                'line': match.line_number,
                'hex_value': match.hex_value,
                'recommended_replacement': self.priority_mappings.get(match.hex_value),
                'context': match.context,
                'full_line': match.full_line.strip()
            })

        # Color frequency analysis
        color_frequency = defaultdict(int)
        for file_matches in matches.values():
            for match in file_matches:
                color_frequency[match.hex_value] += 1

        return {
            'summary': {
                'total_files_scanned': len(matches),
                'total_matches': total_matches,
                'unique_colors': len(color_frequency),
                'priority_issues': len(priority_issues)
            },
            'categories': {
                name: len(category_matches)
                for name, category_matches in categories.items()
            },
            'priority_issues': priority_issues,
            'color_frequency': dict(sorted(color_frequency.items(), key=lambda x: x[1], reverse=True)),
            'files_with_issues': list(matches.keys())
        }

    def save_report(self, report: Dict, output_file: str = "hex_value_report.json"):
        """Save report to JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        print(f"📊 Report saved to {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Find hardcoded hex values in codebase")
    parser.add_argument("--root", default=".", help="Root directory to scan")
    parser.add_argument("--output", default="hex_value_report.json", help="Output report file")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    finder = HexValueFinder(args.root)
    matches = finder.scan_codebase()

    if args.verbose:
        for file_path, file_matches in matches.items():
            print(f"\n📁 {file_path}")
            for match in file_matches:
                print(f"  Line {match.line_number}: {match.hex_value} in '{match.context}'")

    report = finder.generate_report(matches)
    finder.save_report(report, args.output)

    print(f"\n🎯 Summary:")
    print(f"  Files with issues: {report['summary']['total_files_scanned']}")
    print(f"  Total matches: {report['summary']['total_matches']}")
    print(f"  Priority issues: {report['summary']['priority_issues']}")
    print(f"  Unique colors: {report['summary']['unique_colors']}")

    if report['summary']['priority_issues'] > 0:
        print(f"\n⚠️  Found {report['summary']['priority_issues']} priority color issues that need immediate attention!")

if __name__ == "__main__":
    main()