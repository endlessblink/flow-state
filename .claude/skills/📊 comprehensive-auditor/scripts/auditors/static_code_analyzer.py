#!/usr/bin/env python3
"""
Static Code Analysis Auditor

Analyzes source code for syntax errors, type errors, unused code, complexity, and duplications.
Supports TypeScript, JavaScript, Python, and other common languages.
"""

import os
import json
import argparse
import subprocess
import re
import ast
from pathlib import Path
from typing import Dict, List, Any, Set, Tuple
import sys
from datetime import datetime
import time

class StaticCodeAnalyzer:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.results = {
            "findings": [],
            "score": 100,
            "blind_spots": [],
            "metadata": {
                "files_analyzed": 0,
                "languages_detected": set(),
                "lines_of_code": 0,
                "complexity_scores": {},
                "execution_time": 0
            }
        }
        self.issue_weights = {
            "syntax_error": 10,
            "type_error": 8,
            "import_error": 6,
            "unused_import": 3,
            "unused_variable": 2,
            "high_complexity": 4,
            "dead_code": 5,
            "duplicate_code": 3,
            "security_issue": 15
        }

    def analyze(self) -> Dict[str, Any]:
        """Perform comprehensive static code analysis"""
        start_time = time.time()

        print(f"🔍 Starting static code analysis in {self.root_dir}")

        # Detect project type and languages
        languages = self._detect_languages()
        self.results["metadata"]["languages_detected"] = languages

        # Run TypeScript/JavaScript analysis
        if any(lang in languages for lang in ["typescript", "javascript"]):
            self._analyze_typescript_javascript()

        # Run Python analysis
        if "python" in languages:
            self._analyze_python()

        # Run general analysis
        self._analyze_general_issues()

        # Calculate final score
        self._calculate_score()

        # Record metadata
        self.results["metadata"]["execution_time"] = time.time() - start_time
        self.results["metadata"]["files_analyzed"] = len(self._get_code_files())

        return self.results

    def _detect_languages(self) -> Set[str]:
        """Detect programming languages used in the project"""
        languages = set()
        code_files = self._get_code_files()

        for file_path in code_files:
            if file_path.suffix.lower() in ['.ts', '.tsx']:
                languages.add("typescript")
            elif file_path.suffix.lower() in ['.js', '.jsx', '.mjs']:
                languages.add("javascript")
            elif file_path.suffix.lower() == '.py':
                languages.add("python")
            elif file_path.suffix.lower() in ['.java']:
                languages.add("java")
            elif file_path.suffix.lower() in ['.cpp', '.cc', '.cxx']:
                languages.add("cpp")
            elif file_path.suffix.lower() == '.c':
                languages.add("c")
            elif file_path.suffix.lower() in ['.go']:
                languages.add("go")
            elif file_path.suffix.lower() in ['.rs']:
                languages.add("rust")

        return languages

    def _get_code_files(self) -> List[Path]:
        """Get all code files, excluding common ignore patterns"""
        ignore_patterns = {
            'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
            '__pycache__', '.pytest_cache', '.venv', 'venv', 'env'
        }

        code_files = []
        for file_path in self.root_dir.rglob("*"):
            if file_path.is_file() and self._is_code_file(file_path):
                # Skip if in ignored directory
                if any(ignore in str(file_path) for ignore in ignore_patterns):
                    continue
                code_files.append(file_path)

        return code_files

    def _is_code_file(self, file_path: Path) -> bool:
        """Check if file is a code file"""
        code_extensions = {
            '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
            '.py', '.java', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala'
        }
        return file_path.suffix.lower() in code_extensions

    def _analyze_typescript_javascript(self):
        """Analyze TypeScript/JavaScript files"""
        print("📝 Analyzing TypeScript/JavaScript files...")

        # Check for TypeScript configuration
        tsconfig_path = self.root_dir / "tsconfig.json"
        has_tsconfig = tsconfig_path.exists()

        # Run TypeScript compiler check
        if has_tsconfig or any(self.root_dir.rglob("*.ts")):
            self._run_typescript_check()

        # Run ESLint if available
        self._run_eslint_check()

        # Analyze imports/exports
        self._analyze_js_imports()

        # Check for unused variables and dead code
        self._analyze_js_unused_code()

        # Calculate complexity
        self._analyze_js_complexity()

    def _run_typescript_check(self):
        """Run TypeScript compiler to check for type errors"""
        try:
            # Check if TypeScript is installed
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--skipLibCheck"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                lines = result.stderr.split('\n')
                for line in lines:
                    if ':' in line and 'error' in line.lower():
                        self.results["findings"].append({
                            "type": "type_error",
                            "severity": "high",
                            "file": self._extract_file_from_ts_error(line),
                            "message": line.strip(),
                            "line": self._extract_line_from_ts_error(line)
                        })

        except subprocess.TimeoutExpired:
            self.results["findings"].append({
                "type": "tool_timeout",
                "severity": "medium",
                "message": "TypeScript compiler check timed out",
                "tool": "tsc"
            })
        except FileNotFoundError:
            # TypeScript not installed, skip
            pass

    def _extract_file_from_ts_error(self, error_line: str) -> str:
        """Extract file path from TypeScript error line"""
        try:
            # Format: file.ts(line,column): error TS####: message
            match = re.match(r'^([^(]+)\(', error_line)
            if match:
                return match.group(1)
        except:
            pass
        return "unknown"

    def _extract_line_from_ts_error(self, error_line: str) -> int:
        """Extract line number from TypeScript error line"""
        try:
            # Format: file.ts(line,column): error TS####: message
            match = re.match(r'^[^(]+\((\d+),\d+\)', error_line)
            if match:
                return int(match.group(1))
        except:
            pass
        return 0

    def _run_eslint_check(self):
        """Run ESLint to check for code quality issues"""
        try:
            # Check if ESLint is available
            result = subprocess.run(
                ["npx", "eslint", ".", "--format", "json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.stdout:
                try:
                    eslint_results = json.loads(result.stdout)
                    for file_result in eslint_results:
                        for message in file_result.get("messages", []):
                            severity = "high" if message.get("severity") == 2 else "medium"
                            self.results["findings"].append({
                                "type": "code_quality",
                                "severity": severity,
                                "file": file_result.get("filePath", ""),
                                "message": message.get("message", ""),
                                "line": message.get("line", 0),
                                "rule": message.get("ruleId", ""),
                                "tool": "eslint"
                            })
                except json.JSONDecodeError:
                    # ESLint output not in JSON format
                    pass

        except subprocess.TimeoutExpired:
            self.results["findings"].append({
                "type": "tool_timeout",
                "severity": "medium",
                "message": "ESLint check timed out",
                "tool": "eslint"
            })
        except FileNotFoundError:
            # ESLint not installed, skip
            pass

    def _analyze_js_imports(self):
        """Analyze import/export statements for issues"""
        js_files = list(self.root_dir.rglob("*.js")) + list(self.root_dir.rglob("*.ts")) + list(self.root_dir.rglob("*.jsx")) + list(self.root_dir.rglob("*.tsx"))

        for file_path in js_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self._analyze_file_imports(file_path, content)
            except Exception as e:
                self.results["findings"].append({
                    "type": "file_read_error",
                    "severity": "low",
                    "file": str(file_path),
                    "message": f"Could not read file: {str(e)}"
                })

    def _analyze_file_imports(self, file_path: Path, content: str):
        """Analyze imports in a single file"""
        lines = content.split('\n')
        imports = []

        # Find import statements
        for i, line in enumerate(lines, 1):
            line = line.strip()
            if line.startswith(('import ', 'const ', 'var ', 'let ')) and ' from ' in line:
                imports.append((i, line))

        # Check for potential issues
        for line_num, import_line in imports:
            # Check for relative imports that might be broken
            if ' from \"./' in import_line or ' from \"../' in import_line:
                import_path = re.search(r'from [\'"]([^\'"]+)[\'"]', import_line)
                if import_path:
                    path = import_path.group(1)
                    resolved_path = (file_path.parent / path).resolve()

                    # Try different extensions
                    extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '/index.js', '/index.ts']
                    found = False

                    for ext in extensions:
                        if Path(str(resolved_path) + ext).exists():
                            found = True
                            break

                    if not found:
                        self.results["findings"].append({
                            "type": "import_error",
                            "severity": "medium",
                            "file": str(file_path),
                            "line": line_num,
                            "message": f"Import target not found: {path}",
                            "import_path": path
                        })

    def _analyze_js_unused_code(self):
        """Analyze JavaScript/TypeScript for unused code"""
        print("🔍 Analyzing for unused code...")

        # This is a simplified analysis - a full implementation would use AST parsing
        js_files = list(self.root_dir.rglob("*.js")) + list(self.root_dir.rglob("*.ts"))

        for file_path in js_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self._find_unused_variables(file_path, content)
            except Exception:
                continue

    def _find_unused_variables(self, file_path: Path, content: str):
        """Find potentially unused variables (simplified)"""
        lines = content.split('\n')

        # Look for variables that might be unused
        for i, line in enumerate(lines, 1):
            line = line.strip()

            # Skip comments and empty lines
            if not line or line.startswith('//') or line.startswith('/*'):
                continue

            # Look for variable declarations
            if line.startswith(('const ', 'let ', 'var ')):
                # Simple heuristic: check if variable is used elsewhere in file
                var_match = re.match(r'^(const|let|var)\s+(\w+)', line)
                if var_match:
                    var_name = var_match.group(2)

                    # Count occurrences (including the declaration)
                    occurrences = content.count(var_name)

                    # If only declared once or twice, flag as potentially unused
                    if occurrences <= 2:
                        self.results["findings"].append({
                            "type": "unused_variable",
                            "severity": "low",
                            "file": str(file_path),
                            "line": i,
                            "message": f"Potentially unused variable: {var_name}",
                            "variable": var_name,
                            "occurrences": occurrences
                        })

    def _analyze_js_complexity(self):
        """Analyze JavaScript/TypeScript code complexity"""
        print("📊 Analyzing code complexity...")

        js_files = list(self.root_dir.rglob("*.js")) + list(self.root_dir.rglob("*.ts")) + list(self.root_dir.rglob("*.jsx")) + list(self.root_dir.rglob("*.tsx"))

        total_complexity = 0
        file_count = 0

        for file_path in js_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    complexity = self._calculate_complexity(content)
                    total_complexity += complexity
                    file_count += 1

                    # High complexity threshold
                    if complexity > 10:
                        self.results["findings"].append({
                            "type": "high_complexity",
                            "severity": "medium",
                            "file": str(file_path),
                            "message": f"High cyclomatic complexity: {complexity}",
                            "complexity": complexity
                        })

            except Exception:
                continue

        if file_count > 0:
            avg_complexity = total_complexity / file_count
            self.results["metadata"]["complexity_scores"] = {
                "average": avg_complexity,
                "total": total_complexity,
                "files_analyzed": file_count
            }

    def _calculate_complexity(self, content: str) -> int:
        """Calculate simple cyclomatic complexity"""
        complexity = 1  # Base complexity

        # Count decision points
        complexity_keywords = [
            'if', 'else', 'elif', 'while', 'for', 'foreach', 'do',
            'switch', 'case', 'catch', 'try', 'throw', 'return',
            '&&', '||', '?', '??'
        ]

        for keyword in complexity_keywords:
            # Simple count - real implementation would use AST parsing
            complexity += content.count(keyword)

        return complexity

    def _analyze_python(self):
        """Analyze Python files"""
        print("🐍 Analyzing Python files...")

        py_files = list(self.root_dir.rglob("*.py"))

        for file_path in py_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self._analyze_python_file(file_path, content)
            except Exception as e:
                self.results["findings"].append({
                    "type": "file_read_error",
                    "severity": "low",
                    "file": str(file_path),
                    "message": f"Could not read Python file: {str(e)}"
                })

    def _analyze_python_file(self, file_path: Path, content: str):
        """Analyze a single Python file"""
        try:
            # Parse Python AST
            tree = ast.parse(content)

            # Analyze AST for issues
            self._analyze_python_ast(file_path, tree)

        except SyntaxError as e:
            self.results["findings"].append({
                "type": "syntax_error",
                "severity": "high",
                "file": str(file_path),
                "line": e.lineno or 0,
                "message": f"Python syntax error: {str(e)}",
                "error": str(e)
            })
        except Exception as e:
            self.results["findings"].append({
                "type": "parse_error",
                "severity": "medium",
                "file": str(file_path),
                "message": f"Could not parse Python file: {str(e)}"
            })

    def _analyze_python_ast(self, file_path: Path, tree: ast.AST):
        """Analyze Python AST for issues"""
        # Walk through AST nodes
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Check function complexity
                complexity = self._calculate_python_complexity(node)
                if complexity > 10:
                    self.results["findings"].append({
                        "type": "high_complexity",
                        "severity": "medium",
                        "file": str(file_path),
                        "line": node.lineno,
                        "message": f"Function '{node.name}' has high complexity: {complexity}",
                        "function": node.name,
                        "complexity": complexity
                    })

    def _calculate_python_complexity(self, node: ast.FunctionDef) -> int:
        """Calculate Python function complexity"""
        complexity = 1

        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                # and/or operators
                complexity += len(child.values) - 1

        return complexity

    def _analyze_general_issues(self):
        """Analyze general code issues across all languages"""
        print("🔍 Analyzing general code issues...")

        # Look for common security issues
        self._check_security_issues()

        # Look for code duplication
        self._check_code_duplication()

        # Count lines of code
        self._count_lines_of_code()

    def _check_security_issues(self):
        """Check for common security issues"""
        code_files = self._get_code_files()

        security_patterns = {
            r'password\s*=\s*[\'"][^\'"]{8,}[\'"]': "Hardcoded password detected",
            r'api[_-]?key\s*=\s*[\'"][^\'"]{10,}[\'"]': "Hardcoded API key detected",
            r'secret[_-]?key\s*=\s*[\'"][^\'"]{10,}[\'"]': "Hardcoded secret key detected",
            r'token\s*=\s*[\'"][^\'"]{10,}[\'"]': "Hardcoded token detected",
            r'eval\s*\(': "Use of eval() detected",
            r'document\.write\s*\(': "Use of document.write() detected",
            r'innerHTML\s*\=': "Potential XSS vulnerability (innerHTML)",
            r'shell_exec\s*\(': "Use of shell_exec() detected",
            r'exec\s*\(': "Use of exec() detected",
            r'system\s*\(': "Use of system() detected"
        }

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                    for i, line in enumerate(lines, 1):
                        for pattern, message in security_patterns.items():
                            if re.search(pattern, line, re.IGNORECASE):
                                self.results["findings"].append({
                                    "type": "security_issue",
                                    "severity": "high",
                                    "file": str(file_path),
                                    "line": i,
                                    "message": message,
                                    "code": line.strip()
                                })
            except Exception:
                continue

    def _check_code_duplication(self):
        """Check for code duplication (simplified)"""
        code_files = self._get_code_files()

        # This is a very basic check - real implementation would use more sophisticated algorithms
        line_counts = {}

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    normalized_lines = [line.strip().lower() for line in lines if line.strip()]

                    # Simple heuristic: check for very similar files
                    for line in normalized_lines:
                        if len(line) > 20:  # Only check longer lines
                            if line in line_counts:
                                line_counts[line] += 1
                            else:
                                line_counts[line] = 1
            except Exception:
                continue

        # Find potential duplicates
        for line, count in line_counts.items():
            if count > 3:  # Line appears in more than 3 files
                self.results["findings"].append({
                    "type": "duplicate_code",
                    "severity": "low",
                    "message": f"Potential code duplication (appears in {count} files): {line[:50]}...",
                    "occurrences": count,
                    "code": line
                })

    def _count_lines_of_code(self):
        """Count total lines of code"""
        code_files = self._get_code_files()
        total_lines = 0

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    # Count non-empty, non-comment lines
                    for line in lines:
                        stripped = line.strip()
                        if stripped and not stripped.startswith(('//', '#', '/*', '*', '<!--')):
                            total_lines += 1
            except Exception:
                continue

        self.results["metadata"]["lines_of_code"] = total_lines

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored"""
        ignore_patterns = [
            'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
            '__pycache__', '.pytest_cache', 'vendor', 'third_party'
        ]

        return any(ignore in str(file_path) for ignore in ignore_patterns)

    def _calculate_score(self):
        """Calculate final score based on findings"""
        total_deductions = 0

        for finding in self.results["findings"]:
            issue_type = finding.get("type", "unknown")
            severity = finding.get("severity", "medium")

            weight = self.issue_weights.get(issue_type, 3)

            # Adjust weight based on severity
            if severity == "high":
                weight *= 1.5
            elif severity == "low":
                weight *= 0.5

            total_deductions += weight

        # Calculate score (starting from 100)
        self.results["score"] = max(0, 100 - min(total_deductions, 100))

        # Add blind spots
        self.results["blind_spots"] = [
            "Dynamic imports and reflection cannot be statically analyzed",
            "Code generation at build time is not detected",
            "Complex runtime type coercion patterns",
            "Cross-file variable references in dynamically typed languages",
            "Security issues requiring domain knowledge"
        ]

def main():
    parser = argparse.ArgumentParser(description="Static code analysis auditor")
    parser.add_argument("root_dir", help="Root directory to analyze")

    args = parser.parse_args()

    try:
        analyzer = StaticCodeAnalyzer(args.root_dir)
        results = analyzer.analyze()

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