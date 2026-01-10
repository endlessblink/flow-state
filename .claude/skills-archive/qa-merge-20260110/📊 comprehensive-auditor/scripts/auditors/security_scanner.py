#!/usr/bin/env python3
"""
Security Vulnerability Scanner

Comprehensive security analysis covering dependency vulnerabilities, code patterns,
authentication flows, and secrets detection.
"""

import os
import json
import argparse
import subprocess
import re
from pathlib import Path
from typing import Dict, List, Any, Set, Tuple
import sys
from datetime import datetime
import time

class SecurityScanner:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.results = {
            "findings": [],
            "score": 100,
            "blind_spots": [],
            "metadata": {
                "vulnerabilities_found": 0,
                "dependencies_scanned": 0,
                "secrets_detected": 0,
                "auth_flows_analyzed": 0,
                "execution_time": 0
            }
        }
        self.severity_weights = {
            "critical": 20,
            "high": 15,
            "medium": 8,
            "low": 3
        }

    def analyze(self) -> Dict[str, Any]:
        """Perform comprehensive security analysis"""
        start_time = time.time()

        print(f"🔒 Starting security analysis in {self.root_dir}")

        # Scan dependencies for vulnerabilities
        self._scan_dependency_vulnerabilities()

        # Scan code for security issues
        self._scan_code_security_patterns()

        # Detect secrets and credentials
        self._detect_secrets()

        # Analyze authentication and authorization
        self._analyze_authentication_flows()

        # Check for XSS and injection vulnerabilities
        self._scan_injection_vulnerabilities()

        # Analyze API security
        self._analyze_api_security()

        # Check configuration security
        self._check_configuration_security()

        # Calculate final score
        self._calculate_score()

        # Update metadata
        self.results["metadata"]["execution_time"] = time.time() - start_time
        self.results["metadata"]["vulnerabilities_found"] = len([f for f in self.results["findings"] if f.get("severity") in ["critical", "high"]])

        return self.results

    def _scan_dependency_vulnerabilities(self):
        """Scan package dependencies for known vulnerabilities"""
        print("📦 Scanning dependency vulnerabilities...")

        # Check for package.json (Node.js)
        package_json = self.root_dir / "package.json"
        if package_json.exists():
            self._scan_npm_vulnerabilities()

        # Check for requirements.txt (Python)
        requirements_txt = self.root_dir / "requirements.txt"
        if requirements_txt.exists():
            self._scan_python_vulnerabilities()

        # Check for other package managers
        self._scan_other_package_managers()

    def _scan_npm_vulnerabilities(self):
        """Scan npm dependencies using npm audit"""
        try:
            # Run npm audit
            result = subprocess.run(
                ["npm", "audit", "--json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.stdout:
                try:
                    audit_data = json.loads(result.stdout)
                    vulnerabilities = audit_data.get("vulnerabilities", {})

                    self.results["metadata"]["dependencies_scanned"] = len(vulnerabilities)

                    for vuln_id, vuln_data in vulnerabilities.items():
                        severity = vuln_data.get("severity", "moderate")
                        severity_map = {
                            "critical": "critical",
                            "high": "high",
                            "moderate": "medium",
                            "low": "low"
                        }

                        self.results["findings"].append({
                            "type": "dependency_vulnerability",
                            "severity": severity_map.get(severity, "medium"),
                            "package": vuln_data.get("name", ""),
                            "version": vuln_data.get("version", ""),
                            "title": vuln_data.get("title", ""),
                            "url": vuln_data.get("url", ""),
                            "fix_available": vuln_data.get("fixAvailable", False),
                            "tool": "npm_audit"
                        })

                except json.JSONDecodeError:
                    # Try alternative format
                    if "found" in result.stdout.lower() and "vulnerabilities" in result.stdout.lower():
                        self.results["findings"].append({
                            "type": "dependency_vulnerability",
                            "severity": "medium",
                            "message": "npm audit found vulnerabilities but output format is unexpected",
                            "raw_output": result.stdout[:500],
                            "tool": "npm_audit"
                        })

        except subprocess.TimeoutExpired:
            self.results["findings"].append({
                "type": "scan_timeout",
                "severity": "medium",
                "message": "npm audit scan timed out",
                "tool": "npm_audit"
            })
        except FileNotFoundError:
            self.results["findings"].append({
                "type": "tool_not_found",
                "severity": "low",
                "message": "npm not found, dependency vulnerability scan skipped",
                "tool": "npm"
            })
        except Exception as e:
            self.results["findings"].append({
                "type": "scan_error",
                "severity": "medium",
                "message": f"npm audit failed: {str(e)}",
                "tool": "npm_audit"
            })

    def _scan_python_vulnerabilities(self):
        """Scan Python dependencies for vulnerabilities"""
        # Try to use safety if available
        try:
            result = subprocess.run(
                ["safety", "check", "--json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.stdout:
                try:
                    safety_data = json.loads(result.stdout)
                    for vuln in safety_data:
                        self.results["findings"].append({
                            "type": "dependency_vulnerability",
                            "severity": self._map_python_severity(vuln.get("vulnerability_id", "")),
                            "package": vuln.get("package", ""),
                            "version": vuln.get("installed_version", ""),
                            "advisory": vuln.get("advisory", ""),
                            "cve": vuln.get("cve", ""),
                            "tool": "safety"
                        })
                except json.JSONDecodeError:
                    # Fallback to text parsing
                    if "vulnerability" in result.stdout.lower():
                        self.results["findings"].append({
                            "type": "dependency_vulnerability",
                            "severity": "medium",
                            "message": "Safety found vulnerabilities",
                            "raw_output": result.stdout[:500],
                            "tool": "safety"
                        })

        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            # Safety not available or failed, try pip-audit
            self._try_pip_audit()

    def _try_pip_audit(self):
        """Try to use pip-audit as alternative to safety"""
        try:
            result = subprocess.run(
                ["pip-audit", "--format", "json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.stdout:
                try:
                    audit_data = json.loads(result.stdout)
                    for vuln in audit_data.get("dependencies", []):
                        for vuln_info in vuln.get("vulns", []):
                            self.results["findings"].append({
                                "type": "dependency_vulnerability",
                                "severity": self._map_python_severity(vuln_info.get("id", "")),
                                "package": vuln.get("name", ""),
                                "version": vuln.get("version", ""),
                                "advisory": vuln_info.get("advisory", ""),
                                "tool": "pip_audit"
                            })
                except json.JSONDecodeError:
                    pass

        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            # pip-audit also not available
            self.results["findings"].append({
                "type": "tool_not_found",
                "severity": "low",
                "message": "Neither safety nor pip-audit found, Python dependency scan skipped",
                "tool": "safety/pip-audit"
            })

    def _scan_other_package_managers(self):
        """Scan other package managers (Maven, Gradle, etc.)"""
        # Maven
        pom_xml = self.root_dir / "pom.xml"
        if pom_xml.exists():
            self._scan_maven_vulnerabilities()

        # Gradle
        build_gradle = self.root_dir / "build.gradle"
        if build_gradle.exists():
            self._scan_gradle_vulnerabilities()

    def _scan_maven_vulnerabilities(self):
        """Scan Maven dependencies"""
        # Try to use OWASP Dependency-Check if available
        try:
            result = subprocess.run(
                ["dependency-check", "--project", str(self.root_dir), "--format", "json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=300
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            self.results["findings"].append({
                "type": "tool_not_found",
                "severity": "low",
                "message": "OWASP Dependency-Check not found, Maven dependency scan skipped",
                "tool": "dependency-check"
            })

    def _scan_gradle_vulnerabilities(self):
        """Scan Gradle dependencies"""
        # Similar to Maven, try OWASP Dependency-Check
        try:
            result = subprocess.run(
                ["dependency-check", "--project", str(self.root_dir), "--format", "json"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                timeout=300
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            self.results["findings"].append({
                "type": "tool_not_found",
                "severity": "low",
                "message": "OWASP Dependency-Check not found, Gradle dependency scan skipped",
                "tool": "dependency-check"
            })

    def _map_python_severity(self, vuln_id: str) -> str:
        """Map Python vulnerability ID to severity"""
        vuln_lower = vuln_id.lower()
        if "cve" in vuln_lower and any(num in vuln_lower for num in ["2024", "2023", "2022"]):
            return "high"
        elif "remote" in vuln_lower or "rce" in vuln_lower:
            return "critical"
        elif "xss" in vuln_lower or "injection" in vuln_lower:
            return "high"
        elif "dos" in vuln_lower or "denial" in vuln_lower:
            return "medium"
        else:
            return "low"

    def _scan_code_security_patterns(self):
        """Scan source code for security patterns"""
        print("🔍 Scanning code for security patterns...")

        # Security vulnerability patterns
        security_patterns = {
            "sql_injection": {
                "patterns": [
                    r'execute\s*\(\s*["\'].*?\+.*?["\']',  # String concatenation
                    r'query\s*\(\s*["\'].*?\+.*?["\']',   # SQL with +
                    r'select.*?\+.*?from',                  # SELECT with +
                    r'insert.*?\+.*?into',                  # INSERT with +
                    r'update.*?\+.*?set',                   # UPDATE with +
                    r'delete.*?\+.*?from'                   # DELETE with +
                ],
                "message": "Potential SQL injection vulnerability"
            },
            "xss": {
                "patterns": [
                    r'innerHTML\s*=\s*.*?\+',              # Dynamic innerHTML with +
                    r'outerHTML\s*=\s*.*?\+',              # Dynamic outerHTML with +
                    r'document\.write\s*\(\s*.*?\+',       # document.write with +
                    r'eval\s*\(\s*.*?\+',                   # eval with +
                    r'\.html\s*\(\s*.*?\+',                # jQuery .html with +
                    r'setAttribute\s*\(\s*["\']on["\'].*?\+' # Event handler with +
                ],
                "message": "Potential XSS vulnerability"
            },
            "path_traversal": {
                "patterns": [
                    r'readFile\s*\(\s*.*?\+',               # readFile with +
                    r'readFileSync\s*\(\s*.*?\+',          # readFileSync with +
                    r'statSync\s*\(\s*.*?\+',              # statSync with +
                    r'\.\.\/',                              # Directory traversal
                    r'%2e%2e%2f',                          # URL encoded ..//
                    r'%2e%2e\\',                           # URL encoded ..\\
                ],
                "message": "Potential path traversal vulnerability"
            },
            "command_injection": {
                "patterns": [
                    r'exec\s*\(\s*.*?\+',                   # exec with +
                    r'spawn\s*\(\s*.*?\+',                 # spawn with +
                    r'child_process\.exec\s*\(\s*.*?\+',   # child_process.exec with +
                    r'shell_exec\s*\(\s*.*?\+',            # shell_exec with +
                    r'system\s*\(\s*.*?\+',                # system with +
                    r'os\.system\s*\(\s*.*?\+',             # os.system with +
                    r'subprocess\.call\s*\(\s*.*?\+',       # subprocess.call with shell=True
                ],
                "message": "Potential command injection vulnerability"
            },
            "insecure_crypto": {
                "patterns": [
                    r'md5\s*\(',                           # MD5 hash
                    r'sha1\s*\(',                          # SHA1 hash
                    r'des\s*\(',                           # DES encryption
                    r'rc4\s*\(',                           # RC4 encryption
                ],
                "message": "Insecure cryptographic algorithm detected"
            },
            "insecure_random": {
                "patterns": [
                    r'Math\.random\s*\(',                  # Math.random for crypto
                    r'date\.getTime\s*\(',                 # Time-based seed
                    r'rand\s*\(',                         # rand() without seeding
                ],
                "message": "Insecure random number generation"
            },
            "hardcoded_secrets": {
                "patterns": [
                    r'password\s*=\s*["\'][^"\']{8,}["\']',  # Hardcoded password
                    r'api[_-]?key\s*=\s*["\'][^"\']{10,}["\']',  # Hardcoded API key
                    r'secret[_-]?key\s*=\s*["\'][^"\']{10,}["\']',  # Hardcoded secret
                    r'token\s*=\s*["\'][^"\']{10,}["\']',  # Hardcoded token
                    r'private[_-]?key\s*=\s*["\'][^"\']{20,}["\']',  # Private key
                ],
                "message": "Hardcoded secret detected"
            },
            "debug_code": {
                "patterns": [
                    r'console\.log\s*\(',                  # console.log
                    r'console\.debug\s*\(',                # console.debug
                    r'alert\s*\(',                        # alert()
                    r'prompt\s*\(',                       # prompt()
                    r'debugger\s*;',                      # debugger statement
                ],
                "message": "Debug code found (should be removed in production)"
            }
        }

        # Scan all code files
        code_files = self._get_code_files()
        scanned_count = 0

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    for vuln_type, vuln_info in security_patterns.items():
                        for pattern in vuln_info["patterns"]:
                            matches = re.finditer(pattern, line, re.IGNORECASE)
                            for match in matches:
                                self.results["findings"].append({
                                    "type": vuln_type,
                                    "severity": self._get_severity_for_type(vuln_type),
                                    "file": str(file_path),
                                    "line": line_num,
                                    "message": vuln_info["message"],
                                    "code": line.strip(),
                                    "pattern": pattern
                                })

                scanned_count += 1

            except Exception as e:
                self.results["findings"].append({
                    "type": "scan_error",
                    "severity": "low",
                    "file": str(file_path),
                    "message": f"Could not scan file: {str(e)}"
                })

    def _get_severity_for_type(self, vuln_type: str) -> str:
        """Get severity level for vulnerability type"""
        severity_map = {
            "sql_injection": "critical",
            "xss": "high",
            "path_traversal": "high",
            "command_injection": "critical",
            "insecure_crypto": "medium",
            "insecure_random": "medium",
            "hardcoded_secrets": "high",
            "debug_code": "low"
        }
        return severity_map.get(vuln_type, "medium")

    def _detect_secrets(self):
        """Detect secrets and credentials in code"""
        print("🔐 Detecting secrets and credentials...")

        # Common secret patterns
        secret_patterns = [
            # API Keys
            r'AIza[0-9A-Za-z_-]{35}',  # Google API key
            r'sk-[a-zA-Z0-9]{48}',      # Stripe API key
            r'ghp_[a-zA-Z0-9]{36}',      # GitHub personal access token
            r'gho_[a-zA-Z0-9]{36}',      # GitHub OAuth token
            r'ghu_[a-zA-Z0-9]{36}',      # GitHub user token
            r'ghs_[a-zA-Z0-9]{36}',      # GitHub server token
            r'ghr_[a-zA-Z0-9]{36}',      # GitHub refresh token
            r'xoxb-[0-9]{10}-[0-9]{10}-[a-zA-Z0-9]{24}',  # Slack bot token
            r'xoxp-[0-9]{10}-[0-9]{10}-[a-zA-Z0-9]{24}',  # Slack user token
            r'pk_test_[a-zA-Z0-9]{24}',  # Stripe test publishable key
            r'pk_live_[a-zA-Z0-9]{24}',  # Stripe live publishable key
            r'sk_test_[a-zA-Z0-9]{24}',  # Stripe test secret key
            r'sk_live_[a-zA-Z0-9]{24}',  # Stripe live secret key

            # Database URLs (masked)
            r'(mysql|postgresql|mongodb)://[^:\s]+:[^@\s]+@[^/\s]+',

            # Generic base64 encoded secrets (>= 16 chars)
            r'[A-Za-z0-9+/]{16,}={0,2}',
        ]

        code_files = self._get_code_files()
        secrets_count = 0

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    # Skip commented lines for some patterns
                    if line.strip().startswith(('#', '//', '/*', '*')):
                        continue

                    for pattern in secret_patterns:
                        matches = re.finditer(pattern, line)
                        for match in matches:
                            potential_secret = match.group()

                            # Filter false positives
                            if self._is_likely_secret(potential_secret):
                                self.results["findings"].append({
                                    "type": "secret_detected",
                                    "severity": "high",
                                    "file": str(file_path),
                                    "line": line_num,
                                    "message": f"Potential secret detected: {potential_secret[:20]}...",
                                    "secret_type": self._classify_secret(potential_secret),
                                    "code": line.strip()
                                })
                                secrets_count += 1

            except Exception:
                continue

        self.results["metadata"]["secrets_detected"] = secrets_count

    def _is_likely_secret(self, text: str) -> bool:
        """Check if text is likely a secret (vs just random string)"""
        # Common false positives
        false_positives = [
            'https://', 'http://', 'ftp://',  # URLs
            'example.com', 'localhost', '127.0.0.1',  # Example hosts
            'test', 'demo', 'sample', 'example',  # Test strings
            'abcd', 'efgh', 'ijkl', 'mnop',  # Common test strings
        ]

        text_lower = text.lower()
        if any(fp in text_lower for fp in false_positives):
            return False

        # Check length and complexity
        if len(text) < 8:
            return False

        # Check for mix of characters
        has_letters = any(c.isalpha() for c in text)
        has_numbers = any(c.isdigit() for c in text)
        has_special = any(c in '-_+=' for c in text)

        return has_letters and (has_numbers or has_special)

    def _classify_secret(self, secret: str) -> str:
        """Classify the type of secret"""
        if secret.startswith('AIza'):
            return "Google API Key"
        elif secret.startswith('sk-') or secret.startswith('pk_'):
            return "Stripe API Key"
        elif secret.startswith('ghp_') or secret.startswith('gho_'):
            return "GitHub Token"
        elif secret.startswith('xox') or secret.startswith('slack'):
            return "Slack Token"
        elif secret.startswith('mysql://') or secret.startswith('postgresql://'):
            return "Database URL"
        elif re.match(r'[A-Za-z0-9+/]{16,}={0,2}', secret):
            return "Base64 Encoded"
        else:
            return "Unknown"

    def _analyze_authentication_flows(self):
        """Analyze authentication and authorization implementation"""
        print("🔑 Analyzing authentication flows...")

        auth_files = []
        auth_patterns = [
            "auth", "login", "signin", "signup", "register", "logout",
            "jwt", "token", "session", "password", "credential"
        ]

        # Find authentication-related files
        for file_path in self.root_dir.rglob("*"):
            if file_path.is_file() and self._is_code_file(file_path):
                file_name_lower = file_path.name.lower()
                if any(pattern in file_name_lower for pattern in auth_patterns):
                    auth_files.append(file_path)

        self.results["metadata"]["auth_flows_analyzed"] = len(auth_files)

        # Analyze auth files
        for file_path in auth_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self._analyze_auth_file(file_path, content)
            except Exception:
                continue

    def _analyze_auth_file(self, file_path: Path, content: str):
        """Analyze a single authentication file"""
        lines = content.split('\n')

        # Check for common auth vulnerabilities
        auth_vulnerabilities = {
            "plain_text_password": {
                "patterns": [
                    r'password\s*==\s*["\'][^"\']*["\']',  # Plain text password comparison
                    r'if\s*.*password.*===.*["\'][^"\']*["\']',  # Plain text check
                ],
                "message": "Plain text password comparison detected"
            },
            "weak_password_policy": {
                "patterns": [
                    r'length.*<.*6',  # Password length less than 6
                    r'password.*length.*[<<=]\s*[0-9]',  # Password length requirement too short
                ],
                "message": "Weak password policy detected"
            },
            "no_rate_limiting": {
                "patterns": [
                    r'login.*(?!(rate|limit|throttle|attempt))',  # Login without rate limiting mention
                ],
                "message": "Login endpoint may lack rate limiting"
            },
            "insecure_session": {
                "patterns": [
                    r'session\.\w*\s*=\s*.*password',  # Password in session
                    r'setAttribute.*password',  # Password in session attribute
                ],
                "message": "Password stored in session"
            },
            "missing_csrf": {
                "patterns": [
                    r'(post|put|delete).*form.*(?!(csrf|token))',  # Form handling without CSRF
                ],
                "message": "Form handling may lack CSRF protection"
            }
        }

        for line_num, line in enumerate(lines, 1):
            for vuln_type, vuln_info in auth_vulnerabilities.items():
                for pattern in vuln_info["patterns"]:
                    if re.search(pattern, line, re.IGNORECASE):
                        self.results["findings"].append({
                            "type": vuln_type,
                            "severity": "medium",
                            "file": str(file_path),
                            "line": line_num,
                            "message": vuln_info["message"],
                            "code": line.strip()
                        })

    def _scan_injection_vulnerabilities(self):
        """Specific scan for injection vulnerabilities"""
        print("💉 Scanning for injection vulnerabilities...")

        injection_patterns = {
            "ldap_injection": {
                "patterns": [
                    r'ldap_search\s*\(\s*.*?\+',  # LDAP search with concatenation
                ],
                "message": "Potential LDAP injection vulnerability"
            },
            "xpath_injection": {
                "patterns": [
                    r'xpath.*?\+',  # XPath with concatenation
                ],
                "message": "Potential XPath injection vulnerability"
            },
            "no_sql_injection": {
                "patterns": [
                    r'db\.collection.*?\+',  # MongoDB with concatenation
                    r'\$where.*?\+',  # MongoDB $where with concatenation
                ],
                "message": "Potential NoSQL injection vulnerability"
            }
        }

        code_files = self._get_code_files()

        for file_path in code_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    for vuln_type, vuln_info in injection_patterns.items():
                        for pattern in vuln_info["patterns"]:
                            if re.search(pattern, line, re.IGNORECASE):
                                self.results["findings"].append({
                                    "type": vuln_type,
                                    "severity": "high",
                                    "file": str(file_path),
                                    "line": line_num,
                                    "message": vuln_info["message"],
                                    "code": line.strip()
                                })

            except Exception:
                continue

    def _analyze_api_security(self):
        """Analyze API security"""
        print("🌐 Analyzing API security...")

        # Look for API endpoints and check security
        api_files = list(self.root_dir.rglob("*.js")) + list(self.root_dir.rglob("*.ts")) + list(self.root_dir.rglob("*.py"))

        for file_path in api_files:
            if self._should_ignore_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self._analyze_api_file(file_path, content)
            except Exception:
                continue

    def _analyze_api_file(self, file_path: Path, content: str):
        """Analyze API file for security issues"""
        lines = content.split('\n')

        api_security_issues = {
            "no_cors": {
                "patterns": [
                    r'app\.get.*\n.*(?!(cors|origin))',  # GET endpoint without CORS
                ],
                "message": "API endpoint may lack CORS configuration"
            },
            "no_validation": {
                "patterns": [
                    r'req\.body.*(?!(validate|schema|check))',  # Request body without validation
                ],
                "message": "API endpoint may lack input validation"
            },
            "no_auth": {
                "patterns": [
                    r'(post|put|delete).*\n.*(?!(auth|jwt|token|middleware))',  # Sensitive operation without auth
                ],
                "message": "Sensitive API endpoint may lack authentication"
            }
        }

        # This is a simplified analysis - real implementation would parse route definitions
        for i in range(len(lines) - 1):
            combined_lines = lines[i] + lines[i + 1]

            for vuln_type, vuln_info in api_security_issues.items():
                for pattern in vuln_info["patterns"]:
                    if re.search(pattern, combined_lines, re.IGNORECASE):
                        self.results["findings"].append({
                            "type": vuln_type,
                            "severity": "medium",
                            "file": str(file_path),
                            "line": i + 1,
                            "message": vuln_info["message"],
                            "code": combined_lines.strip()
                        })

    def _check_configuration_security(self):
        """Check configuration files for security issues"""
        print("⚙️ Checking configuration security...")

        # Check common config files
        config_files = [
            ".env", ".env.example", ".env.local",
            "config.js", "config.json", "config.yaml", "config.yml",
            "settings.py", "settings.yaml", "application.properties"
        ]

        for config_file in config_files:
            config_path = self.root_dir / config_file
            if config_path.exists():
                self._analyze_config_file(config_path)

    def _analyze_config_file(self, file_path: Path):
        """Analyze configuration file for security issues"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check for insecure configurations
            insecure_configs = {
                "debug_enabled": {
                    "patterns": [
                        r'debug\s*=\s*true',
                        r'DEBUG\s*=\s*True',
                        r'"debug"\s*:\s*true'
                    ],
                    "message": "Debug mode enabled in configuration"
                },
                "default_password": {
                    "patterns": [
                        r'(password|passwd|pwd)\s*=\s*["\']?(admin|password|123456|root)["\']?'
                    ],
                    "message": "Default or weak password in configuration"
                },
                "insecure_cookie": {
                    "patterns": [
                        r'secure\s*=\s*false',
                        r'httpOnly\s*=\s*false'
                    ],
                    "message": "Insecure cookie configuration"
                },
                "exposed_database": {
                    "patterns": [
                        r'localhost.*3306',
                        r'127\.0\.0\.1.*5432'
                    ],
                    "message": "Database connection exposed in configuration"
                }
            }

            for config_type, config_info in insecure_configs.items():
                for pattern in config_info["patterns"]:
                    if re.search(pattern, content, re.IGNORECASE):
                        severity = "high" if config_type in ["debug_enabled", "default_password"] else "medium"
                        self.results["findings"].append({
                            "type": config_type,
                            "severity": severity,
                            "file": str(file_path),
                            "message": config_info["message"],
                            "config_type": config_type
                        })

        except Exception:
            pass

    def _get_code_files(self) -> List[Path]:
        """Get all code files"""
        code_extensions = {
            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.py', '.java', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
            '.cs', '.vb', '.pl', '.sh', '.bash', '.zsh'
        }

        code_files = []
        for file_path in self.root_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in code_extensions:
                if not self._should_ignore_file(file_path):
                    code_files.append(file_path)

        return code_files

    def _is_code_file(self, file_path: Path) -> bool:
        """Check if file is a code file"""
        code_extensions = {
            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.py', '.java', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
            '.cs', '.vb', '.pl', '.sh', '.bash', '.zsh'
        }
        return file_path.suffix.lower() in code_extensions

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored"""
        ignore_patterns = [
            'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
            '__pycache__', '.pytest_cache', 'vendor', 'third_party',
            '.min.js', '.min.css', 'bundle.js', 'chunk.js'
        ]

        return any(ignore in str(file_path) for ignore in ignore_patterns)

    def _calculate_score(self):
        """Calculate security score based on findings"""
        total_deductions = 0

        for finding in self.results["findings"]:
            severity = finding.get("severity", "medium")
            weight = self.severity_weights.get(severity, 8)

            # Higher weight for critical security issues
            if severity == "critical":
                weight *= 2
            elif severity == "high":
                weight *= 1.5

            total_deductions += weight

        # Security score is more critical
        self.results["score"] = max(0, 100 - min(total_deductions * 1.2, 100))

        # Add blind spots for security
        self.results["blind_spots"] = [
            "Logic-based authentication bypasses cannot be detected automatically",
            "Novel zero-day exploits are unknown to vulnerability databases",
            "Social engineering vulnerabilities require human analysis",
            "Third-party service security cannot be fully verified",
            "Runtime security issues in production environments",
            "Complex business logic security flaws",
            "Insider threat detection capabilities"
        ]

def main():
    parser = argparse.ArgumentParser(description="Security vulnerability scanner")
    parser.add_argument("root_dir", help="Root directory to scan")

    args = parser.parse_args()

    try:
        scanner = SecurityScanner(args.root_dir)
        results = scanner.analyze()

        print(json.dumps(results, indent=2))
        return 0

    except Exception as e:
        print(json.dumps({
            "findings": [{"type": "scan_error", "severity": "high", "message": str(e)}],
            "score": 0
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())