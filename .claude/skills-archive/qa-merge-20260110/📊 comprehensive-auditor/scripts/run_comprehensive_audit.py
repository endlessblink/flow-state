#!/usr/bin/env python3
"""
Comprehensive Project Auditor - Main Orchestrator

Executes all 12 audit dimensions in parallel and generates comprehensive reports.
"""

import os
import json
import argparse
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import sys
from datetime import datetime
import concurrent.futures
import time

class ComprehensiveAuditor:
    def __init__(self, root_dir: str = ".", config_file: str = None):
        self.root_dir = Path(root_dir).resolve()
        self.config = self._load_config(config_file)
        self.results = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "root_directory": str(self.root_dir),
                "auditor_version": "1.0.0",
                "total_dimensions": 12,
                "execution_time": None
            },
            "dimensions": {},
            "cross_dimension_findings": [],
            "overall_health_score": None,
            "overall_confidence": None,
            "blind_spots": [],
            "recommendations": []
        }

        # Define all 12 dimensions
        self.dimensions = {
            "static_code": {
                "name": "Static Code Analysis",
                "confidence": 95,
                "weight": 0.15,
                "enabled": self.config["dimensions"].get("static_code", {}).get("enabled", True),
                "script": "static_code_analyzer.py"
            },
            "runtime_behavior": {
                "name": "Runtime Behavior Simulation",
                "confidence": 70,
                "weight": 0.12,
                "enabled": self.config["dimensions"].get("runtime_behavior", {}).get("enabled", True),
                "script": "runtime_behavior_analyzer.py"
            },
            "data_flow": {
                "name": "Data Flow & State Management",
                "confidence": 80,
                "weight": 0.10,
                "enabled": self.config["dimensions"].get("data_flow", {}).get("enabled", True),
                "script": "data_flow_analyzer.py"
            },
            "api_deps": {
                "name": "API & External Dependencies",
                "confidence": 65,
                "weight": 0.08,
                "enabled": self.config["dimensions"].get("api_deps", {}).get("enabled", True),
                "script": "api_dependency_analyzer.py"
            },
            "security": {
                "name": "Security Vulnerabilities",
                "confidence": 60,
                "weight": 0.15,
                "enabled": self.config["dimensions"].get("security", {}).get("enabled", True),
                "script": "security_scanner.py"
            },
            "performance": {
                "name": "Performance & Scalability",
                "confidence": 55,
                "weight": 0.08,
                "enabled": self.config["dimensions"].get("performance", {}).get("enabled", True),
                "script": "performance_profiler.py"
            },
            "documentation": {
                "name": "Documentation Accuracy",
                "confidence": 85,
                "weight": 0.10,
                "enabled": self.config["dimensions"].get("documentation", {}).get("enabled", True),
                "script": "documentation_analyzer.py"
            },
            "test_coverage": {
                "name": "Test Coverage & Quality",
                "confidence": 90,
                "weight": 0.12,
                "enabled": self.config["dimensions"].get("test_coverage", {}).get("enabled", True),
                "script": "test_coverage_analyzer.py"
            },
            "infrastructure": {
                "name": "Infrastructure & Deployment",
                "confidence": 70,
                "weight": 0.05,
                "enabled": self.config["dimensions"].get("infrastructure", {}).get("enabled", True),
                "script": "infrastructure_analyzer.py"
            },
            "accessibility": {
                "name": "Accessibility & UX",
                "confidence": 50,
                "weight": 0.03,
                "enabled": self.config["dimensions"].get("accessibility", {}).get("enabled", True),
                "script": "accessibility_analyzer.py"
            },
            "business_logic": {
                "name": "Business Logic Correctness",
                "confidence": 40,
                "weight": 0.01,
                "enabled": self.config["dimensions"].get("business_logic", {}).get("enabled", True),
                "script": "business_logic_analyzer.py"
            },
            "team_health": {
                "name": "Human Processes & Team Health",
                "confidence": 30,
                "weight": 0.01,
                "enabled": self.config["dimensions"].get("team_health", {}).get("enabled", True),
                "script": "team_health_analyzer.py"
            }
        }

    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "dimensions": {
                "static_code": {"enabled": True, "weight": 0.15},
                "runtime_behavior": {"enabled": True, "weight": 0.12},
                "data_flow": {"enabled": True, "weight": 0.10},
                "api_deps": {"enabled": True, "weight": 0.08},
                "security": {"enabled": True, "weight": 0.15},
                "performance": {"enabled": True, "weight": 0.08},
                "documentation": {"enabled": True, "weight": 0.10},
                "test_coverage": {"enabled": True, "weight": 0.12},
                "infrastructure": {"enabled": True, "weight": 0.05},
                "accessibility": {"enabled": True, "weight": 0.03},
                "business_logic": {"enabled": True, "weight": 0.01},
                "team_health": {"enabled": True, "weight": 0.01}
            },
            "thresholds": {
                "high_confidence": 90,
                "medium_confidence": 70,
                "low_confidence": 50,
                "min_overall_health": 75
            },
            "reporting": {
                "include_blind_spots": True,
                "prioritize_cross_dimension": True,
                "suggest_improvements": True
            }
        }

        if config_file and Path(config_file).exists():
            try:
                import yaml
                with open(config_file, 'r') as f:
                    user_config = yaml.safe_load(f)
                    # Deep merge with default config
                    for key in user_config:
                        if key in default_config and isinstance(default_config[key], dict):
                            default_config[key].update(user_config[key])
                        else:
                            default_config[key] = user_config[key]
            except ImportError:
                print("⚠️ PyYAML not installed, using default configuration")
            except Exception as e:
                print(f"⚠️ Error loading config: {e}, using defaults")

        return default_config

    def run_dimension_audit(self, dimension_key: str, dimension_config: Dict) -> Dict[str, Any]:
        """Run a single dimension audit"""
        script_path = Path(__file__).parent / "auditors" / dimension_config["script"]

        if not script_path.exists():
            return {
                "dimension": dimension_key,
                "status": "skipped",
                "reason": f"Script not found: {dimension_config['script']}",
                "findings": [],
                "score": None,
                "confidence": dimension_config["confidence"]
            }

        try:
            print(f"🔍 Running {dimension_config['name']}...")

            result = subprocess.run(
                ["python3", str(script_path), str(self.root_dir)],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout per dimension
            )

            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout)
                    return {
                        "dimension": dimension_key,
                        "status": "success",
                        "findings": output.get("findings", []),
                        "score": output.get("score", 50),
                        "confidence": dimension_config["confidence"],
                        "blind_spots": output.get("blind_spots", []),
                        "metadata": output.get("metadata", {}),
                        "execution_time": output.get("execution_time", 0)
                    }
                except json.JSONDecodeError:
                    return {
                        "dimension": dimension_key,
                        "status": "partial",
                        "reason": "Invalid JSON output",
                        "findings": [],
                        "score": 50,
                        "confidence": dimension_config["confidence"],
                        "raw_output": result.stdout
                    }
            else:
                return {
                    "dimension": dimension_key,
                    "status": "failed",
                    "reason": result.stderr,
                    "findings": [],
                    "score": 0,
                    "confidence": dimension_config["confidence"]
                }

        except subprocess.TimeoutExpired:
            return {
                "dimension": dimension_key,
                "status": "timeout",
                "reason": "Execution timeout (5 minutes)",
                "findings": [],
                "score": 0,
                "confidence": dimension_config["confidence"]
            }
        except Exception as e:
            return {
                "dimension": dimension_key,
                "status": "error",
                "reason": str(e),
                "findings": [],
                "score": 0,
                "confidence": dimension_config["confidence"]
            }

    def run_parallel_audits(self, quick_mode: bool = False) -> Dict[str, Any]:
        """Run all enabled audits in parallel"""
        start_time = time.time()

        # Filter dimensions based on quick mode and enabled status
        dimensions_to_run = {}
        for key, config in self.dimensions.items():
            if not config["enabled"]:
                continue
            if quick_mode and config["confidence"] < 70:
                # Skip slow dimensions (runtime, performance) in quick mode
                continue
            dimensions_to_run[key] = config

        print(f"🚀 Starting {len(dimensions_to_run)} dimension audits in parallel...")

        # Run audits in parallel using ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_dimension = {
                executor.submit(self.run_dimension_audit, key, config): key
                for key, config in dimensions_to_run.items()
            }

            for future in concurrent.futures.as_completed(future_to_dimension):
                dimension_key = future_to_dimension[future]
                try:
                    result = future.result()
                    self.results["dimensions"][dimension_key] = result

                    status_emoji = {"success": "✅", "failed": "❌", "timeout": "⏰", "error": "💥", "skipped": "⏭️"}
                    emoji = status_emoji.get(result["status"], "❓")

                    print(f"{emoji} {self.dimensions[dimension_key]['name']}: {result['status']}")
                    if result["score"] is not None:
                        print(f"   Score: {result['score']}/100 | Confidence: {result['confidence']}%")

                except Exception as e:
                    print(f"💥 {self.dimensions[dimension_key]['name']}: Exception - {e}")
                    self.results["dimensions"][dimension_key] = {
                        "dimension": dimension_key,
                        "status": "error",
                        "reason": str(e),
                        "findings": [],
                        "score": 0,
                        "confidence": self.dimensions[dimension_key]["confidence"]
                    }

        execution_time = time.time() - start_time
        self.results["metadata"]["execution_time"] = round(execution_time, 2)

        return self.results

    def calculate_overall_scores(self):
        """Calculate overall health score and confidence"""
        total_weight = 0
        weighted_score = 0
        total_confidence = 0
        confidence_count = 0

        for dimension_key, dimension_config in self.dimensions.items():
            if not dimension_config["enabled"]:
                continue

            weight = dimension_config["weight"]
            result = self.results["dimensions"].get(dimension_key, {})
            score = result.get("score", 0)
            confidence = result.get("confidence", dimension_config["confidence"])

            total_weight += weight
            weighted_score += score * weight
            total_confidence += confidence
            confidence_count += 1

        # Calculate weighted scores
        if total_weight > 0:
            self.results["overall_health_score"] = round(weighted_score / total_weight, 1)
        else:
            self.results["overall_health_score"] = 0

        if confidence_count > 0:
            self.results["overall_confidence"] = round(total_confidence / confidence_count, 1)
        else:
            self.results["overall_confidence"] = 0

        # Determine health status
        health_thresholds = self.config["thresholds"]
        if self.results["overall_health_score"] >= health_thresholds["high_confidence"]:
            health_status = "Excellent"
        elif self.results["overall_health_score"] >= health_thresholds["medium_confidence"]:
            health_status = "Good"
        elif self.results["overall_health_score"] >= health_thresholds["low_confidence"]:
            health_status = "Fair"
        else:
            health_status = "Poor"

        self.results["metadata"]["health_status"] = health_status

    def collect_blind_spots(self):
        """Collect all blind spots from dimensions"""
        blind_spots = []

        for dimension_key, dimension_config in self.dimensions.items():
            if not dimension_config["enabled"]:
                continue

            result = self.results["dimensions"].get(dimension_key, {})
            dimension_blind_spots = result.get("blind_spots", [])

            # Add dimension context
            for blind_spot in dimension_blind_spots:
                blind_spots.append({
                    "dimension": dimension_key,
                    "dimension_name": dimension_config["name"],
                    "confidence": dimension_config["confidence"],
                    "description": blind_spot if isinstance(blind_spot, str) else blind_spot.get("description", "")
                })

        self.results["blind_spots"] = blind_spots

    def generate_recommendations(self):
        """Generate actionable recommendations based on findings"""
        recommendations = []

        # Analyze critical issues
        critical_issues = []
        for dimension_key, result in self.results["dimensions"].items():
            if result.get("score", 100) < 50:
                critical_issues.append({
                    "dimension": dimension_key,
                    "dimension_name": self.dimensions[dimension_key]["name"],
                    "score": result.get("score", 0),
                    "confidence": self.dimensions[dimension_key]["confidence"]
                })

        if critical_issues:
            recommendations.append({
                "priority": "P0",
                "category": "Critical Issues",
                "description": f"{len(critical_issues)} dimensions have critical health scores (<50)",
                "actions": [
                    {
                        "dimension": issue["dimension"],
                        "dimension_name": issue["dimension_name"],
                        "action": "Address critical findings immediately",
                        "impact": "High",
                        "effort": "Medium"
                    } for issue in critical_issues
                ]
            })

        # Generate cross-dimension recommendations
        # Look for patterns like: low confidence + critical issues
        high_risk_dimensions = [
            key for key, result in self.results["dimensions"].items()
            if result.get("score", 100) < 60 and self.dimensions[key]["confidence"] < 70
        ]

        if high_risk_dimensions:
            recommendations.append({
                "priority": "P1",
                "category": "High Risk Areas",
                "description": f"{len(high_risk_dimensions)} dimensions combine low scores with low confidence",
                "actions": [
                    {
                        "dimension": dim,
                        "action": "Increase monitoring and manual verification",
                        "impact": "Risk reduction",
                        "effort": "Low"
                    } for dim in high_risk_dimensions
                ]
            })

        # Suggest improvements for blind spots
        if len(self.results["blind_spots"]) > 5:
            recommendations.append({
                "priority": "P2",
                "category": "Coverage Improvement",
                "description": "Multiple blind spots detected - consider additional monitoring",
                "actions": [
                    {
                        "action": "Set up production monitoring for runtime behavior",
                        "impact": "+20% confidence in performance",
                        "effort": "Medium"
                    },
                    {
                        "action": "Conduct user testing for accessibility",
                        "impact": "+30% confidence in UX",
                        "effort": "Medium"
                    },
                    {
                        "action": "Implement security audit processes",
                        "impact": "+25% confidence in security",
                        "effort": "High"
                    }
                ]
            })

        self.results["recommendations"] = recommendations

    def save_results(self, output_dir: str = ".") -> str:
        """Save comprehensive audit results"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Generate timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_file = output_path / f"comprehensive_audit_{timestamp}.json"

        # Save JSON results
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, default=str)

        print(f"📊 Detailed results saved to: {result_file}")

        # Generate human-readable report
        report_file = self._generate_report(output_path, timestamp)

        return str(result_file)

    def _generate_report(self, output_path: Path, timestamp: str) -> Path:
        """Generate human-readable audit report"""
        report_file = output_path / f"comprehensive_audit_report_{timestamp}.md"

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(self._generate_markdown_report())

        print(f"📋 Audit report saved to: {report_file}")
        return report_file

    def _generate_markdown_report(self) -> str:
        """Generate markdown report content"""
        lines = [
            f"# Comprehensive Project Audit Report",
            f"",
            f"**Date:** {self.results['metadata']['timestamp']}",
            f"**Project:** {self.results['metadata']['root_directory']}",
            f"**Auditor Version:** {self.results['metadata']['auditor_version']}",
            f"**Execution Time:** {self.results['metadata']['execution_time']}s",
            f"",
            f"## Executive Summary",
            f"",
            f"**Overall Health Score:** {self.results['overall_health_score']}/100 ({self.results['metadata']['health_status']})",
            f"**Overall Confidence:** {self.results['overall_confidence']}%",
            f"**Dimensions Audited:** {len([d for d in self.results['dimensions'].values() if d.get('status') == 'success'])}/12",
            f""
        ]

        # Add dimension breakdown
        lines.extend([
            f"## Dimension Breakdown",
            f""
        ])

        for dimension_key, dimension_config in self.dimensions.items():
            if not dimension_config["enabled"]:
                continue

            result = self.results["dimensions"].get(dimension_key, {})
            score = result.get("score", "N/A")
            confidence = result.get("confidence", dimension_config["confidence"])
            status = result.get("status", "unknown")

            status_emoji = {"success": "✅", "failed": "❌", "timeout": "⏰", "error": "💥", "skipped": "⏭️"}
            emoji = status_emoji.get(status, "❓")

            lines.extend([
                f"### {emoji} {dimension_config['name']}",
                f"- **Score:** {score}/100",
                f"- **Confidence:** {confidence}%",
                f"- **Weight:** {dimension_config['weight']:.0%}",
                f"- **Status:** {status}"
            ])

            if result.get("findings"):
                lines.append(f"- **Findings:** {len(result['findings'])} issues found")

            lines.append("")

        # Add recommendations
        if self.results["recommendations"]:
            lines.extend([
                f"## Recommendations",
                f""
            ])

            for rec in self.results["recommendations"]:
                lines.extend([
                    f"### {rec['priority']} - {rec['category']}",
                    f"{rec['description']}",
                    ""
                ])

                for action in rec.get("actions", []):
                    if isinstance(action, dict):
                        lines.append(f"- **{action.get('action', 'Action')}** (Impact: {action.get('impact', 'Unknown')}, Effort: {action.get('effort', 'Unknown')})")
                    else:
                        lines.append(f"- {action}")

                lines.append("")

        # Add blind spots
        if self.results["blind_spots"] and self.config["reporting"]["include_blind_spots"]:
            lines.extend([
                f"## Blind Spots",
                f""
            ])

            for blind_spot in self.results["blind_spots"]:
                lines.append(f"- **{blind_spot['dimension_name']}** (Confidence: {blind_spot['confidence']}%): {blind_spot['description']}")

            lines.extend([
                "",
                f"## Confidence Analysis",
                f"",
                f"This audit operates with explicit confidence levels for each dimension. Lower confidence indicates higher uncertainty in findings.",
                f"Areas with <70% confidence require manual verification and additional monitoring.",
                ""
            ])

        lines.extend([
            f"---",
            f"*Generated by Comprehensive Auditor v{self.results['metadata']['auditor_version']}*"
        ])

        return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Run comprehensive project audit")
    parser.add_argument("--root", default=".", help="Root directory to audit")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--output", default=".", help="Output directory for results")
    parser.add_argument("--quick", action="store_true", help="Skip slow dimensions (runtime, performance)")
    parser.add_argument("--dimension", help="Run single dimension audit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    print("🔍 Comprehensive Project Auditor")
    print(f"📂 Analyzing: {Path(args.root).resolve()}")

    try:
        auditor = ComprehensiveAuditor(args.root, args.config)

        if args.dimension:
            # Run single dimension
            if args.dimension not in auditor.dimensions:
                print(f"❌ Unknown dimension: {args.dimension}")
                print(f"Available dimensions: {', '.join(auditor.dimensions.keys())}")
                return 1

            dimension_config = auditor.dimensions[args.dimension]
            if not dimension_config["enabled"]:
                print(f"❌ Dimension '{args.dimension}' is disabled in configuration")
                return 1

            result = auditor.run_dimension_audit(args.dimension, dimension_config)
            auditor.results["dimensions"][args.dimension] = result
            print(f"✅ Dimension '{args.dimension}' completed")
        else:
            # Run all dimensions
            auditor.run_parallel_audits(args.quick)
            auditor.calculate_overall_scores()
            auditor.collect_blind_spots()
            auditor.generate_recommendations()

            # Print summary
            print(f"\n📊 Audit Summary:")
            print(f"   Overall Health: {auditor.results['overall_health_score']}/100 ({auditor.results['metadata']['health_status']})")
            print(f"   Overall Confidence: {auditor.results['overall_confidence']}%")
            print(f"   Dimensions Completed: {len([d for d in auditor.results['dimensions'].values() if d.get('status') == 'success'])}")

        # Save results
        result_file = auditor.save_results(args.output)

        print(f"\n🎉 Comprehensive audit completed!")
        return 0

    except KeyboardInterrupt:
        print("\n❌ Audit interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Audit failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())