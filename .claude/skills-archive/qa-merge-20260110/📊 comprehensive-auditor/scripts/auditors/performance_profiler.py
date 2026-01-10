#!/usr/bin/env python3
"""
Performance & Scalability Profiler

Analyzes application performance including bundle size, render performance,
memory usage, and potential bottlenecks.
"""

import os
import json
import argparse
import subprocess
import re
from pathlib import Path
from typing import Dict, List, Any
import sys
from datetime import datetime
import time

class PerformanceProfiler:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.results = {
            "findings": [],
            "score": 100,
            "blind_spots": [],
            "metadata": {
                "bundle_size": None,
                "bundle_analysis": {},
                "performance_metrics": {},
                "memory_analysis": {},
                "execution_time": 0
            }
        }
        self.performance_thresholds = {
            "bundle_size_mb": 1.0,  # 1MB max
            "chunk_size_mb": 0.3,   # 300KB per chunk
            "large_file_kb": 100,    # 100KB per file
            "complexity_threshold": 50,
            "unused_import_threshold": 0.1  # 10% unused imports
        }

    def analyze(self) -> Dict[str, Any]:
        """Perform comprehensive performance analysis"""
        start_time = time.time()

        print(f"🚀 Starting performance profiling in {self.root_dir}")

        # Analyze bundle size
        self._analyze_bundle_size()

        # Analyze code for performance issues
        self._analyze_code_performance()

        # Check for large files
        self._analyze_file_sizes()

        # Analyze build configuration
        self._analyze_build_config()

        # Check for memory leaks patterns
        self._analyze_memory_patterns()

        # Calculate final score
        self._calculate_score()

        self.results["metadata"]["execution_time"] = time.time() - start_time

        return self.results

    def _analyze_bundle_size(self):
        """Analyze bundle size if webpack or similar build tool is used"""
        print("📦 Analyzing bundle size...")

        # Check for webpack-bundle-analyzer
        try:
            # Try to run bundle analysis
            result = subprocess.run(
                ["npx", "webpack-bundle-analyzer", str(self.root_dir), "--json", "--mode", "static"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                # Parse bundle analysis results
                self._parse_bundle_results(result.stdout)
            else:
                # Fallback to manual bundle size analysis
                self._manual_bundle_analysis()

        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            # Try alternative methods
            self._manual_bundle_analysis()

    def _manual_bundle_analysis(self):
        """Manual bundle size analysis"""
        # Look for build output directories
        build_dirs = ["dist", "build", ".next", "out", "public"]

        total_size = 0
        bundle_files = []

        for build_dir in build_dirs:
            build_path = self.root_dir / build_dir
            if build_path.exists() and build_path.is_dir():
                for file_path in build_path.rglob("*"):
                    if file_path.is_file() and file_path.suffix in ['.js', '.css', '.html']:
                        size = file_path.stat().st_size
                        total_size += size
                        bundle_files.append({
                            "path": str(file_path.relative_to(self.root_dir)),
                            "size": size,
                            "size_mb": round(size / (1024 * 1024), 2)
                        })

        if bundle_files:
            # Sort by size
            bundle_files.sort(key=lambda x: x["size"], reverse=True)

            self.results["metadata"]["bundle_size"] = {
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_count": len(bundle_files),
                "largest_files": bundle_files[:10]  # Top 10 largest
            }

            # Check for large bundles
            threshold_mb = self.performance_thresholds["bundle_size_mb"]
            if total_size / (1024 * 1024) > threshold_mb:
                self.results["findings"].append({
                    "type": "large_bundle",
                    "severity": "high",
                    "message": f"Bundle size {round(total_size / (1024 * 1024), 2)}MB exceeds recommended {threshold_mb}MB",
                    "size_mb": round(total_size / (1024 * 1024), 2),
                    "threshold_mb": threshold_mb
                })

            # Check for large individual files
            chunk_threshold = self.performance_thresholds["chunk_size_mb"]
            for file_info in bundle_files:
                if file_info["size_mb"] > chunk_threshold:
                    self.results["findings"].append({
                        "type": "large_chunk",
                        "severity": "medium",
                        "message": f"Large chunk {file_info['path']} ({file_info['size_mb']}MB)",
                        "file": file_info["path"],
                        "size_mb": file_info["size_mb"]
                    })

    def _parse_bundle_results(self, bundle_output: str):
        """Parse webpack bundle analyzer output"""
        try:
            # This is a simplified parser - real implementation would parse the full JSON output
            bundle_data = json.loads(bundle_output)

            # Extract key metrics
            total_size = bundle_data.get("parsedSize", 0)
            self.results["metadata"]["bundle_size"] = {
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "chunks": len(bundle_data.get("chunks", [])),
                "modules": len(bundle_data.get("modules", []))
            }

        except json.JSONDecodeError:
            self.results["findings"].append({
                "type": "bundle_analysis_error",
                "severity": "low",
                "message": "Could not parse bundle analyzer output",
                "raw_output": bundle_output[:200]
            })

    def _analyze_code_performance(self):
        """Analyze code for performance issues"""
        print("⚡ Analyzing code performance...")

        code_files = self._get_code_files()

        # Performance anti-patterns to check
        performance_patterns = {
            "sync_operations": {
                "patterns": [
                    r'fs\.readFileSync',          # Synchronous file operations
                    r'fs\.writeFileSync',         # Synchronous file operations
                    r'require\s*\(\s*["\'].*\.json["\']',  # Synchronous JSON loading
                    r'synchronous.*loop',         # Explicit synchronous loops
                ],
                "message": "Synchronous operations can block event loop"
            },
            "memory_leaks": {
                "patterns": [
                    r'setInterval.*?\(\s*0\s*,',   # setInterval with 0 delay
                    r'addEventListener.*?remove',   # Event listener without cleanup
                    r'dom.*addEventListener.*?null',  # DOM event listener without cleanup
                ],
                "message": "Potential memory leak pattern detected"
            },
            "inefficient_dom": {
                "patterns": [
                    r'innerHTML.*?=',             # innerHTML assignment
                    r'document\.write',            # document.write usage
                    r'appendChild.*?loop',         # appendChild in loop
                ],
                "message": "Inefficient DOM manipulation detected"
            },
            "blocking_operations": {
                "patterns": [
                    r'while\s*\(\s*true\s*\)',     # Infinite while loop
                    r'for\s*\(\s*.*?length.*?\)',  # Array length in loop condition
                    r'date\.getTime.*?Math\.random', # Time-based randomness
                ],
                "message": "Potentially blocking operation detected"
            },
            "large_arrays": {
                "patterns": [
                    r'new Array\s*\(\s*\d{4,}',  # Large array allocation
                    r'\[\s*\d{4,}\s*\]',         # Large array literal
                ],
                "message": "Large array allocation detected"
            }
        }

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    for perf_type, perf_info in performance_patterns.items():
                        for pattern in perf_info["patterns"]:
                            if re.search(pattern, line, re.IGNORECASE):
                                severity = "high" if perf_type == "sync_operations" else "medium"
                                self.results["findings"].append({
                                    "type": perf_type,
                                    "severity": severity,
                                    "file": str(file_path),
                                    "line": line_num,
                                    "message": perf_info["message"],
                                    "code": line.strip()
                                })

            except Exception:
                continue

    def _analyze_file_sizes(self):
        """Analyze file sizes for large files that might impact performance"""
        print("📊 Analyzing file sizes...")

        large_file_threshold = self.performance_thresholds["large_file_kb"] * 1024
        large_files = []
        total_size = 0

        for file_path in self.root_dir.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                size = file_path.stat().st_size
                total_size += size

                if size > large_file_threshold:
                    large_files.append({
                        "path": str(file_path.relative_to(self.root_dir)),
                        "size": size,
                        "size_kb": round(size / 1024, 2)
                    })

        # Sort by size
        large_files.sort(key=lambda x: x["size"], reverse=True)

        if large_files:
            self.results["metadata"]["large_files"] = large_files

            # Flag largest files
            for file_info in large_files[:5]:  # Top 5 largest
                self.results["findings"].append({
                    "type": "large_source_file",
                    "severity": "medium",
                    "message": f"Large source file: {file_info['path']} ({file_info['size_kb']}KB)",
                    "file": file_info["path"],
                    "size_kb": file_info["size_kb"]
                })

    def _analyze_build_config(self):
        """Analyze build configuration for performance optimizations"""
        print("⚙️ Analyzing build configuration...")

        # Check for optimization configs
        config_files = [
            "webpack.config.js", "webpack.config.ts",
            "vite.config.js", "vite.config.ts",
            "rollup.config.js", "rollup.config.ts",
            "parcel.config.js", "parcel.config.json"
        ]

        for config_file in config_files:
            config_path = self.root_dir / config_file
            if config_path.exists():
                self._analyze_build_config_file(config_path)

    def _analyze_build_config_file(self, config_path: Path):
        """Analyze a specific build configuration file"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check for common performance optimizations
            optimization_checks = {
                "minification_missing": {
                    "patterns": [
                        r'minify\s*:\s*false',
                        r'optimization\.minimize\s*:\s*false'
                    ],
                    "message": "Minification appears to be disabled"
                },
                "no_code_splitting": {
                    "patterns": [
                        r'splitChunks\s*:\s*false',
                        r'chunkFilename'
                    ],
                    "message": "Code splitting may be disabled"
                },
                "no_tree_shaking": {
                    "patterns": [
                        r'treeShaking\s*:\s*false',
                        r'sideEffects\s*:\s*\[\s*\*\s*\]'
                    ],
                    "message": "Tree shaking may be disabled"
                },
                "source_maps_prod": {
                    "patterns": [
                        r'devtool\s*:\s*[\'"]source-map[\'"]',
                        r'production.*sourceMap.*true'
                    ],
                    "message": "Source maps enabled in production build"
                }
            }

            for check_type, check_info in optimization_checks.items():
                for pattern in check_info["patterns"]:
                    if re.search(pattern, content, re.IGNORECASE):
                        self.results["findings"].append({
                            "type": check_type,
                            "severity": "medium",
                            "file": str(config_path),
                            "message": check_info["message"],
                            "config_type": config_path.name
                        })

        except Exception:
            pass

    def _analyze_memory_patterns(self):
        """Analyze code for memory-related issues"""
        print("🧠 Analyzing memory patterns...")

        js_files = list(self.root_dir.rglob("*.js")) + list(self.root_dir.rglob("*.ts")) + list(self.root_dir.rglob("*.jsx")) + list(self.root_dir.rglob("*.tsx"))

        memory_patterns = {
            "event_listeners": {
                "patterns": [
                    r'addEventListener',
                    r'onClick',
                    r'onLoad'
                ],
                "cleanup_patterns": [
                    r'removeEventListener',
                    r'cleanup',
                    r'unmount'
                ]
            },
            "timers": {
                "patterns": [
                    r'setTimeout',
                    r'setInterval'
                ],
                "cleanup_patterns": [
                    r'clearTimeout',
                    r'clearInterval'
                ]
            },
            "dom_references": {
                "patterns": [
                    r'document\.getElementById',
                    r'document\.querySelector',
                    r'\.getElementById'
                ]
            }
        }

        for file_path in js_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Check for potential memory leaks
                if 'addEventListener' in content and 'removeEventListener' not in content:
                    self.results["findings"].append({
                        "type": "event_listener_leak",
                        "severity": "medium",
                        "file": str(file_path),
                        "message": "Event listeners added but no cleanup pattern found"
                    })

                if 'setTimeout' in content and 'clearTimeout' not in content:
                    self.results["findings"].append({
                        "type": "timer_leak",
                        "severity": "low",
                        "file": str(file_path),
                        "message": "Timers used but no cleanup pattern found"
                    })

            except Exception:
                continue

    def _get_code_files(self) -> List[Path]:
        """Get all code files"""
        code_extensions = {
            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.py', '.java', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala'
        }

        code_files = []
        for file_path in self.root_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in code_extensions:
                if not self._should_ignore_file(file_path):
                    code_files.append(file_path)

        return code_files

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored"""
        ignore_patterns = [
            'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
            '__pycache__', '.pytest_cache', 'vendor', 'third_party',
            '.min.js', '.min.css', 'bundle.js', 'chunk.js'
        ]

        return any(ignore in str(file_path) for ignore in ignore_patterns)

    def _calculate_score(self):
        """Calculate performance score"""
        total_deductions = 0
        issue_weights = {
            "large_bundle": 20,
            "large_chunk": 10,
            "sync_operations": 15,
            "memory_leaks": 12,
            "inefficient_dom": 8,
            "blocking_operations": 10,
            "minification_missing": 12,
            "no_code_splitting": 8,
            "large_source_file": 5,
            "event_listener_leak": 6,
            "timer_leak": 3
        }

        for finding in self.results["findings"]:
            issue_type = finding.get("type", "unknown")
            weight = issue_weights.get(issue_type, 5)

            severity = finding.get("severity", "medium")
            if severity == "high":
                weight *= 1.5
            elif severity == "low":
                weight *= 0.7

            total_deductions += weight

        self.results["score"] = max(0, 100 - min(total_deductions, 100))

        # Add blind spots for performance
        self.results["blind_spots"] = [
            "Real user performance under production load cannot be measured",
            "Network latency variations across different geographic locations",
            "Browser-specific performance issues on older browsers",
            "Mobile device performance limitations",
            "Third-party CDN performance impact",
            "Database query performance under load",
            "Memory usage patterns in production environment",
            "WebSocket and real-time communication performance"
        ]

def main():
    parser = argparse.ArgumentParser(description="Performance and scalability profiler")
    parser.add_argument("root_dir", help="Root directory to analyze")

    args = parser.parse_args()

    try:
        profiler = PerformanceProfiler(args.root_dir)
        results = profiler.analyze()

        print(json.dumps(results, indent=2))
        return 0

    except Exception as e:
        print(json.dumps({
            "findings": [{"type": "analysis_error", "severity": "high", "message": str(e)}],
            "score": 0
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())