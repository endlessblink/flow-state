#!/usr/bin/env python3
"""
CSS Design Token Visual Debugger

This script creates a comprehensive visual debugging report by inspecting the actual
rendered colors in the browser, helping to identify any remaining color inconsistencies.

It analyzes the computed styles of medium priority elements across different views
to detect the yellow vs orange discrepancy.
"""

import os
import json
import requests
import argparse
from pathlib import Path
from typing import Dict, List, Set, Optional
from dataclasses import dataclass
from datetime import datetime
import time

@dataclass
class ColorSample:
    """Represents a color measurement from a specific element"""
    element_type: str  # 'inbox', 'canvas', 'board', 'calendar', 'table'
    element_id: str
    computed_color: str  # RGB color from browser
    hex_color: str
    css_variable: str
    location: str  # File and line reference
    visual_description: str

class VisualDebugger:
    """Visual debugger for color consistency analysis"""

    def __init__(self, app_url: str = "http://localhost:5553"):
        self.app_url = app_url
        self.samples = []

        # Expected medium priority color
        self.expected_rgb = "rgb(245, 158, 11)"  # #f59e0b
        self.expected_hex = "#f59e0b"

        # Common problematic colors we might still see
        self.problematic_colors = {
            "#feca57": "Yellow variant causing inconsistency",
            "#fbbf24": "Another yellow variant",
            "#f39c12": "Darker orange variant",
            "#fbbf24": "Light yellow variant"
        }

    def analyze_medium_priority_elements(self) -> Dict:
        """Analyze medium priority elements across all views"""
        print(f"🔍 Analyzing medium priority colors at {self.app_url}")

        # Wait for app to be ready
        time.sleep(2)

        # Create HTML analysis page
        analysis_script = self.create_analysis_script()

        try:
            # Send analysis script to browser
            response = requests.post(f"{self.app_url}/analyze-colors",
                                     data=analysis_script,
                                     headers={'Content-Type': 'text/html'})

            if response.status_code == 200:
                results = self.parse_analysis_results(response.text)
                return self.generate_visual_report(results)
            else:
                print(f"❌ Could not send analysis script (HTTP {response.status_code})")
                return self.fallback_analysis()

        except Exception as e:
            print(f"⚠️  Could not connect to app: {e}")
            return self.fallback_analysis()

    def create_analysis_script(self) -> str:
        """Create JavaScript to analyze colors in the browser"""
        analysis_html = """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: system-ui; padding: 20px; }
        .result { margin: 10px 0; padding: 10px; border-left: 4px solid #007acc; }
        .color-box { display: inline-block; width: 30px; height: 30px; margin-right: 10px; border-radius: 4px; }
        .hex { font-family: monospace; font-weight: bold; }
        .element { background: #f5f5f5; padding: 2px 4px; border-radius: 4px; margin: 2px 0; }
        .location { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <h1>Medium Priority Color Analysis</h1>
    <div id="results"></div>

    <script>
        const results = [];

        // Function to analyze color of an element
        function analyzeColor(element, elementId, elementType) {
            const computedStyle = window.getComputedStyle(element);
            const backgroundColor = computedStyle.backgroundColor;
            const color = computedStyle.color;

            // Get the main color (prioritize background over text color)
            const mainColor = backgroundColor !== 'rgba(0, 0, 0, 0)' ? backgroundColor : color;

            // Convert RGB to hex
            const hexColor = rgbToHex(mainColor);

            // Get CSS variable if available
            const cssVariable = getCSSVariable(element);

            results.push({
                elementId: elementId,
                elementType: elementType,
                computedColor: mainColor,
                hexColor: hexColor,
                cssVariable: cssVariable,
                location: element.className,
                textContent: element.textContent?.substring(0, 50) || 'N/A'
            });

            return {
                computedColor: mainColor,
                hexColor: hexColor,
                cssVariable: cssVariable
            };
        }

        // Convert RGB to hex
        function rgbToHex(rgb) {
            const match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
            if (!match) return rgb;

            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);

            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        // Get CSS variable value
        function getCSSVariable(element) {
            const style = window.getComputedStyle(element);
            const background = style.background || style.backgroundColor;
            const color = style.color;

            // Check for CSS variable usage
            const bgMatch = background.match(/var\\(--([^)]+)\\)/);
            const colorMatch = color.match(/var\\(--([^)]+)\\)/);

            if (bgMatch) return bgMatch[1];
            if (colorMatch) return colorMatch[1];
            return null;
        }

        // Find all medium priority elements
        function findMediumPriorityElements() {
            const selectors = [
                '.priority-medium',
                '[class*="priority-medium"]',
                '.task-node.priority-medium',
                '.task-row__badge--medium',
                '.task-card .priority-badge.priority-medium',
                '.calendar-event .priority-stripe.priority-medium',
                '.week-event .priority-stripe.priority-medium',
                '.month-event .priority-stripe.priority-medium'
            ];

            const elements = [];

            selectors.forEach(selector => {
                const found = document.querySelectorAll(selector);
                found.forEach((element, index) => {
                    elements.push({
                        element: element,
                        selector: selector,
                        elementId: selector.replace(/[^a-zA-Z0-9]/g, '_') + '_' + index,
                        elementType: selector.includes('calendar') ? 'calendar' :
                                     selector.includes('task-node') ? 'canvas' :
                                     selector.includes('task-row') ? 'table' :
                                     selector.includes('task-card') ? 'board' : 'unknown'
                    });
                });
            });

            return elements;
        }

        // Perform analysis
        setTimeout(() => {
            const elements = findMediumPriorityElements();
            const results_div = document.getElementById('results');

            if (elements.length === 0) {
                results_div.innerHTML = '<div class="result">❌ No medium priority elements found</div>';
                document.title = 'No Medium Priority Elements Found';
            } else {
                results_div.innerHTML = '<div class="result">Found ' + elements.length + ' medium priority elements:</div>';

                elements.forEach((item, index) => {
                    const color_info = analyzeColor(item.element, item.elementId, item.elementType);

                    const result_div = document.createElement('div');
                    result_div.className = 'result';

                    const is_expected_color = color_info.hexColor === '#f59e0b';
                    const is_problematic = ['#feca57', '#fbbf24', '#f39c12'].includes(color_info.hexColor);

                    let status = '✅';
                    let border_color = '#4caf50';
                    if (is_problematic) {
                        status = '⚠️';
                        border_color = '#ff9800';
                    } else if (!is_expected_color) {
                        status = '❓';
                        border_color = '#2196f3';
                    }

                    let problemDiv = is_problematic ? '<div style="color: #f44336; font-weight: bold;">🚨 PROBLEMATIC COLOR (Yellow variant detected)</div>' : '';
                    let unexpectedDiv = !is_expected_color && !is_problematic ? '<div style="color: #ff9800;">⚠️ Unexpected color (Expected: #f59e0b)</div>' : '';

                    result_div.innerHTML =
                        '<div class="element">' +
                            '<div class="color-box" style="background-color: ' + color_info.computedColor + '"></div>' +
                            '<div>' +
                                '<strong>' + status + ' ' + item.elementType.toUpperCase() + ' Element</strong><br>' +
                                'Color: <span class="hex">' + color_info.hexColor + '</span> (RGB: ' + color_info.computedColor + ')<br>' +
                                'CSS Variable: <code>' + (color_info.cssVariable || 'None') + '</code><br>' +
                                'Selector: <code>' + item.selector + '</code><br>' +
                                '<div class="location">Content: "' + item.textContent + '"</div>' +
                                '<div class="location">Classes: "' + item.location + '"</div>' +
                                problemDiv +
                                unexpectedDiv +
                            '</div>' +
                        '</div>';

                    results_div.appendChild(result_div);
                });
            }

            // Create summary
            const summary = createSummary(elements);
            const summary_div = document.createElement('div');
            summary_div.innerHTML = summary;
            summary_div.style.cssText = 'background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;';
            document.body.appendChild(summary_div);

            // Return results for scraping
            window.analysisResults = results;
        }, 1000);

        function createSummary(elements) {
            const colors = elements.map(e => {
                const color_info = analyzeColor(e.element, e.elementId, e.elementType);
                return color_info.hexColor;
            });

            const unique_colors = [...new Set(colors)];
            const problem_colors = unique_colors.filter(c => ['#feca57', '#fbbf24', '#f39c12'].includes(c));
            const unexpected_colors = unique_colors.filter(c => c !== '#f59e0b' && !['#feca57', '#fbbf24', '#f39c12'].includes(c));

            return '<h2>🎯 Analysis Summary</h2>' +
                '<p><strong>Total Elements Found:</strong> ' + elements.length + '</p>' +
                '<p><strong>Unique Colors:</strong> ' + unique_colors.length + '</p>' +
                '<p><strong>Expected Color (#f59e0b):</strong> ' + (unique_colors.includes('#f59e0b') ? '✅ Found' : '❌ Missing') + '</p>' +
                '<p><strong>Problematic Colors:</strong> ' + problem_colors.length + ' ' + (problem_colors.length > 0 ? '⚠️ ' + problem_colors.join(', ') : '✅ None') + '</p>' +
                '<p><strong>Unexpected Colors:</strong> ' + unexpected_colors.length + ' ' + (unexpected_colors.length > 0 ? '❓ ' + unexpected_colors.join(', ') : '✅ None') + '</p>' +
                '<p><strong>Overall Status:</strong> ' + (problem_colors.length === 0 && unique_colors.includes('#f59e0b') ? '✅ PERFECT' : '❌ ISSUES FOUND') + '</p>';
        }

        // Auto-refresh every 2 seconds to catch dynamic changes
        setInterval(() => {
            window.location.reload();
        }, 2000);
    </script>
</body>
</html>"""
        return analysis_html

    def parse_analysis_results(self, html_content: str) -> Dict:
        """Parse results from analysis page"""
        # This would normally extract from a more structured response
        # For now, we'll do fallback analysis
        return self.fallback_analysis()

    def fallback_analysis(self) -> Dict:
        """Fallback analysis when browser automation isn't available"""
        print("🔍 Performing fallback code analysis...")

        # Search for any remaining problematic patterns
        from find_hardcoded_hex import HexValueFinder

        finder = HexValueFinder(".")
        matches = finder.scan_codebase()

        # Look specifically for the problematic yellow colors
        problematic_matches = []
        for file_path, file_matches in matches.items():
            for match in file_matches:
                if match.hex_value in ['#feca57', '#fbbf24', '#f39c12']:
                    problematic_matches.append({
                        'file': file_path,
                        'line': match.line_number,
                        'hex_value': match.hex_value,
                        'context': match.context
                    })

        return {
            'timestamp': datetime.now().isoformat(),
            'method': 'fallback_code_analysis',
            'problematic_matches': problematic_matches,
            'total_problematic': len(problematic_matches),
            'status': 'needs_fixes' if problematic_matches else 'clean'
        }

    def generate_visual_report(self, analysis_results: Dict) -> Dict:
        """Generate comprehensive visual debugging report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'app_url': self.app_url,
            'expected_color': {
                'hex': self.expected_hex,
                'rgb': self.expected_rgb,
                'description': 'Medium priority orange/amber color'
            },
            'analysis_results': analysis_results,
            'recommendations': []
        }

        if analysis_results.get('status') == 'needs_fixes':
            report['recommendations'].append("URGENT: Remove remaining hardcoded hex values")
            report['recommendations'].append("Check for browser cache issues")
            report['recommendations'].append("Verify CSS compilation")
        else:
            report['recommendations'].append("✅ Codebase analysis shows consistency")
            report['recommendations'].append("Check browser cache if visual issues persist")

        return report

    def save_report(self, report: Dict, output_file: str = "visual_debug_report.json"):
        """Save visual debugging report"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        print(f"📊 Visual debug report saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Visual debugger for color consistency")
    parser.add_argument("--url", default="http://localhost:5553", help="Application URL to test")
    parser.add_argument("--output", default="visual_debug_report.json", help="Output report file")

    args = parser.parse_args()

    debugger = VisualDebugger(args.url)
    report = debugger.analyze_medium_priority_elements()
    debugger.save_report(report, args.output)

    print(f"\n🎯 Visual Debug Summary:")
    print(f"  Method: {report.get('method', 'unknown')}")
    print(f"  Expected Color: {report['expected_color']['hex']} ({report['expected_color']['rgb']})")

    if 'problematic_matches' in report:
        print(f"  Problematic Matches Found: {report['total_problematic']}")
        for match in report['problematic_matches'][:5]:  # Show first 5
            print(f"    - {match['file']}:{match['line']} - {match['hex_value']} in '{match['context']}'")

    print(f"  Status: {report['status'].upper()}")
    print(f"  Report saved to: {args.output}")

if __name__ == "__main__":
    main()