#!/usr/bin/env python3
"""
CSS Design Token Enforcer - Consistency Validator

This script validates that the codebase maintains consistent use of CSS design tokens
and identifies any remaining hardcoded values or inconsistencies.

Based on enterprise design system validation practices.
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict, Counter

from find_hardcoded_hex import HexValueFinder, HexValueMatch

class ConsistencyValidator:
    """Validates CSS design token consistency across the codebase"""

    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir)
        self.finder = HexValueFinder(root_dir)

        # Design tokens that should be used consistently
        self.design_tokens = {
            # Priority colors
            '--color-priority-medium': '#f59e0b',
            '--color-priority-high': '#ef4444',
            '--color-priority-low': '#3b82f6',
            '--color-work': '#10b981',

            # Priority backgrounds
            '--color-priority-medium-bg': 'rgba(245, 158, 11, 0.3)',
            '--priority-high-bg': 'rgba(239, 68, 68, 0.3)',
            '--priority-low-bg': 'rgba(59, 130, 246, 0.3)',

            # Priority glows
            '--priority-medium-glow': '0 4px 8px rgba(245, 158, 11, 0.3), 0 0 12px rgba(245, 158, 11, 0.2)',
            '--priority-high-glow': '0 4px 8px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.2)',
            '--priority-low-glow': '0 4px 8px rgba(59, 130, 246, 0.3), 0 0 12px rgba(59, 130, 246, 0.2)',
        }

        # Problematic hex values that should never appear
        self.forbidden_hex_values = {
            '#feca57',  # Yellow variant causing color inconsistency
            '#fbbf24',  # Another yellow variant
            '#f59e0b',  # Should use CSS variable instead
            '#10b981',  # Should use CSS variable instead
            '#ef4444',  # Should use CSS variable instead
            '#3b82f6',  # Should use CSS variable instead
        }

    def check_design_token_usage(self) -> Dict:
        """Check how design tokens are being used across the codebase"""
        token_usage = defaultdict(lambda: defaultdict(int))

        print("🔍 Analyzing design token usage...")

        for file_path in self.root_dir.rglob('*'):
            if not file_path.is_file() or file_path.suffix.lower() not in {'.vue', '.css', '.scss', '.less'}:
                continue

            # Skip excluded directories
            if any(part in file_path.parts for part in ['.git', 'node_modules', 'dist', 'build', '.cache']):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Count token usage
                for token in self.design_tokens:
                    count = len(re.findall(re.escape(token), content))
                    if count > 0:
                        token_usage[str(file_path)][token] = count

            except Exception as e:
                print(f"  ⚠️  Error reading {file_path}: {e}")

        return dict(token_usage)

    def find_inconsistencies(self, matches: Dict[str, List[HexValueMatch]]) -> Dict:
        """Find inconsistencies in color usage"""
        inconsistencies = {
            'hardcoded_priority_colors': [],
            'mixed_approaches': defaultdict(list),
            'potential_issues': []
        }

        for file_path, file_matches in matches.items():
            file_inconsistencies = []

            for match in file_matches:
                # Check for forbidden hex values
                if match.hex_value in self.forbidden_hex_values:
                    inconsistencies['hardcoded_priority_colors'].append({
                        'file': file_path,
                        'line': match.line_number,
                        'hex_value': match.hex_value,
                        'context': match.context,
                        'css_property': match.css_property,
                        'recommended_token': self.get_recommended_token(match.hex_value)
                    })

                # Check for mixed approaches (hex + tokens in same file)
                if match.hex_value in self.forbidden_hex_values:
                    inconsistencies['mixed_approaches'][file_path].append(match)

        return inconsistencies

    def get_recommended_token(self, hex_value: str) -> str:
        """Get recommended CSS token for a hex value"""
        recommendations = {
            '#f59e0b': 'var(--color-priority-medium)',
            '#feca57': 'var(--color-priority-medium)',
            '#10b981': 'var(--color-work)',
            '#ef4444': 'var(--color-priority-high)',
            '#3b82f6': 'var(--color-priority-low)',
        }
        return recommendations.get(hex_value, 'UNKNOWN - needs manual review')

    def check_color_frequency_analysis(self, matches: Dict[str, List[HexValueMatch]]) -> Dict:
        """Analyze color frequency to identify patterns"""
        color_frequency = Counter()
        color_by_property = defaultdict(Counter)
        color_by_file = defaultdict(list)

        for file_path, file_matches in matches.items():
            for match in file_matches:
                color_frequency[match.hex_value] += 1
                if match.css_property:
                    color_by_property[match.css_property][match.hex_value] += 1
                color_by_file[file_path].append(match.hex_value)

        return {
            'frequency': dict(color_frequency.most_common()),
            'by_property': {prop: dict(counter.most_common()) for prop, counter in color_by_property.items()},
            'by_file': {file_path: Counter(colors) for file_path, colors in color_by_file.items()},
            'total_unique_colors': len(color_frequency)
        }

    def validate_vue_components(self) -> Dict:
        """Validate Vue component specific issues"""
        vue_issues = {
            'inline_styles': [],
            'computed_colors': [],
            'template_colors': []
        }

        print("🔍 Analyzing Vue components...")

        vue_files = list(self.root_dir.rglob('*.vue'))

        for vue_file in vue_files:
            if any(part in vue_file.parts for part in ['.git', 'node_modules', 'dist', 'build']):
                continue

            try:
                with open(vue_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Check for inline styles with hex values
                inline_style_pattern = r'style\s*=\s*["\'][^"\']*#[0-9a-fA-F]{3,6}[^"\']*["\']'
                inline_matches = re.findall(inline_style_pattern, content)
                if inline_matches:
                    vue_issues['inline_styles'].append({
                        'file': str(vue_file),
                        'matches': inline_matches
                    })

                # Check template section for hex values
                if '<template>' in content:
                    template_start = content.find('<template>')
                    template_end = content.find('</template>')
                    template_content = content[template_start:template_end]

                    template_hex_pattern = r'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b'
                    template_matches = re.findall(template_hex_pattern, template_content)
                    if template_matches:
                        vue_issues['template_colors'].append({
                            'file': str(vue_file),
                            'hex_values': [f"#{hex.lower()}" for hex in template_matches]
                        })

            except Exception as e:
                print(f"  ⚠️  Error analyzing {vue_file}: {e}")

        return vue_issues

    def generate_validation_report(self) -> Dict:
        """Generate comprehensive validation report"""
        print("🔍 Running comprehensive validation...")

        # Find all hardcoded values
        matches = self.finder.scan_codebase()

        # Check design token usage
        token_usage = self.check_design_token_usage()

        # Find inconsistencies
        inconsistencies = self.find_inconsistencies(matches)

        # Color frequency analysis
        color_analysis = self.check_color_frequency_analysis(matches)

        # Vue component validation
        vue_issues = self.validate_vue_components()

        # Calculate scores
        total_files = len(token_usage)
        files_with_issues = len(set([issue['file'] for issue in inconsistencies['hardcoded_priority_colors']]))

        score = {
            'consistency_score': max(0, 100 - (len(inconsistencies['hardcoded_priority_colors']) * 10)),
            'coverage_score': min(100, (len(token_usage) / max(1, total_files)) * 100) if total_files > 0 else 100,
            'overall_score': 0
        }

        score['overall_score'] = (score['consistency_score'] + score['coverage_score']) / 2

        return {
            'timestamp': str(datetime.now()),
            'summary': {
                'total_files_analyzed': total_files,
                'files_with_token_usage': len(token_usage),
                'files_with_hardcoded_issues': files_with_issues,
                'total_hardcoded_matches': len(inconsistencies['hardcoded_priority_colors']),
                'consistency_score': score['consistency_score'],
                'coverage_score': score['coverage_score'],
                'overall_score': score['overall_score']
            },
            'token_usage': dict(token_usage),
            'inconsistencies': inconsistencies,
            'color_analysis': color_analysis,
            'vue_issues': vue_issues,
            'recommendations': self.generate_recommendations(inconsistencies, color_analysis)
        }

    def generate_recommendations(self, inconsistencies: Dict, color_analysis: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        if inconsistencies['hardcoded_priority_colors']:
            recommendations.append(
                f"URGENT: Replace {len(inconsistencies['hardcoded_priority_colors'])} hardcoded priority colors with CSS tokens"
            )

        if color_analysis['total_unique_colors'] > 20:
            recommendations.append(
                f"Consider reducing color palette complexity (currently {color_analysis['total_unique_colors']} unique colors)"
            )

        # Check for most common problematic colors
        problematic_colors = [color for color, count in color_analysis['frequency'].items()
                            if color in self.forbidden_hex_values and count > 1]

        if problematic_colors:
            recommendations.append(
                f"Priority colors to replace: {', '.join(problematic_colors[:3])}"
            )

        if not recommendations:
            recommendations.append("✅ Codebase shows good consistency with design token usage")

        return recommendations

    def save_report(self, report: Dict, output_file: str = "css_consistency_report.json"):
        """Save validation report"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        print(f"📊 Validation report saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Validate CSS design token consistency")
    parser.add_argument("--root", default=".", help="Root directory to validate")
    parser.add_argument("--output", default="css_consistency_report.json", help="Output report file")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    validator = ConsistencyValidator(args.root)
    report = validator.generate_validation_report()
    validator.save_report(report, args.output)

    print(f"\n🎯 Validation Summary:")
    print(f"  Overall Score: {report['summary']['overall_score']:.1f}/100")
    print(f"  Consistency Score: {report['summary']['consistency_score']:.1f}/100")
    print(f"  Coverage Score: {report['summary']['coverage_score']:.1f}/100")
    print(f"  Files with Issues: {report['summary']['files_with_hardcoded_issues']}")
    print(f"  Hardcoded Matches: {report['summary']['total_hardcoded_matches']}")

    print(f"\n📋 Recommendations:")
    for rec in report['recommendations']:
        print(f"  • {rec}")

if __name__ == "__main__":
    from datetime import datetime
    main()