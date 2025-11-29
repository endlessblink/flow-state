#!/usr/bin/env python3
"""
Documentation Accuracy Verifier

Compares documentation claims against actual code implementation to detect:
- Documented features that don't exist in code
- Code features that lack documentation
- Outdated API documentation
- Broken code examples in documentation
"""

import os
import re
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class FeatureStatus(Enum):
    ACTIVE = "ACTIVE"
    DOCUMENTATION_ONLY = "DOCUMENTATION_ONLY"
    CODE_ONLY = "CODE_ONLY"
    INACCURATE = "INACCURATE"
    UNCERTAIN = "UNCERTAIN"

@dataclass
class FeatureEvidence:
    file_path: str
    line_number: int
    content: str
    evidence_type: str  # "import", "function", "class", "config", etc.

@dataclass
class DocumentationClaim:
    doc_file: str
    line_number: int
    claim: str
    feature_name: str
    confidence: int

class DocumentationAccuracyVerifier:
    def __init__(self, project_root: str = ".", docs_dir: str = "docs"):
        self.project_root = Path(project_root)
        self.docs_dir = Path(docs_dir)
        self.src_dirs = ["src", "lib", "app", "components", "services", "utils"]
        self.code_extensions = {'.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java'}

        self.verified_features = {}
        self.unmatched_claims = []
        self.undocumented_features = []
        self.inaccurate_examples = []

    def find_documentation_files(self) -> List[Path]:
        """Find all documentation files"""
        doc_extensions = {'.md', '.rst', '.txt', '.adoc'}
        doc_files = []

        for ext in doc_extensions:
            doc_files.extend(self.docs_dir.rglob(f'*{ext}'))

        return doc_files

    def find_source_files(self) -> List[Path]:
        """Find all source code files"""
        source_files = []

        for src_dir in self.src_dirs:
            src_path = self.project_root / src_dir
            if src_path.exists():
                for ext in self.code_extensions:
                    source_files.extend(src_path.rglob(f'*{ext}'))

        # Also search in project root for files
        for ext in self.code_extensions:
            source_files.extend(self.project_root.rglob(f'*{ext}'))

        # Filter out common non-source directories
        source_files = [
            f for f in source_files
            if not any(skip in str(f) for skip in ['node_modules', 'target', 'vendor', '.git', 'dist', 'build'])
        ]

        return list(set(source_files))  # Remove duplicates

    def extract_code_features(self, source_file: Path) -> Dict[str, List[FeatureEvidence]]:
        """Extract features from source code"""
        features = {
            'imports': [],
            'functions': [],
            'classes': [],
            'endpoints': [],
            'database_operations': [],
            'config_keys': [],
            'dependencies': []
        }

        try:
            with open(source_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except (UnicodeDecodeError, PermissionError):
            return features

        ext = source_file.suffix.lower()

        for i, line in enumerate(lines, 1):
            line = line.strip()

            # Extract imports
            if ext in ['.ts', '.tsx', '.js', '.jsx']:
                # TypeScript/JavaScript imports
                import_match = re.match(r'^(?:import|const)\s+.*from\s+[\'"]([^\'"]+)[\'"]', line)
                if import_match:
                    features['imports'].append(FeatureEvidence(
                        str(source_file), i, line, 'import'
                    ))

                # Function exports
                func_match = re.match(r'^export\s+(?:function|const)\s+(\w+)', line)
                if func_match:
                    features['functions'].append(FeatureEvidence(
                        str(source_file), i, line, 'function'
                    ))

                # API endpoints
                endpoint_match = re.match(r'^\w+\.(get|post|put|delete|patch)\s*\([\'"]([^\'"]+)[\'"]', line)
                if endpoint_match:
                    features['endpoints'].append(FeatureEvidence(
                        str(source_file), i, line, 'endpoint'
                    ))

                # Classes
                class_match = re.match(r'^export\s+class\s+(\w+)', line)
                if class_match:
                    features['classes'].append(FeatureEvidence(
                        str(source_file), i, line, 'class'
                    ))

            elif ext == '.py':
                # Python imports
                import_match = re.match(r'^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)', line)
                if import_match:
                    features['imports'].append(FeatureEvidence(
                        str(source_file), i, line, 'import'
                    ))

                # Function definitions
                func_match = re.match(r'^def\s+(\w+)', line)
                if func_match:
                    features['functions'].append(FeatureEvidence(
                        str(source_file), i, line, 'function'
                    ))

                # Class definitions
                class_match = re.match(r'^class\s+(\w+)', line)
                if class_match:
                    features['classes'].append(FeatureEvidence(
                        str(source_file), i, line, 'class'
                    ))

                # Flask/FastAPI routes
                route_match = re.match(r'^@\w+\.(?:route|get|post|put|delete)\s*\([\'"]([^\'"]+)[\'"]', line)
                if route_match:
                    features['endpoints'].append(FeatureEvidence(
                        str(source_file), i, line, 'endpoint'
                    ))

            # Database operations (common patterns)
            db_patterns = [
                r'SELECT\s+.*FROM\s+(\w+)',
                r'INSERT\s+INTO\s+(\w+)',
                r'UPDATE\s+(\w+)\s+SET',
                r'DELETE\s+FROM\s+(\w+)',
                r'CREATE\s+TABLE\s+(\w+)',
                r'DROP\s+TABLE\s+(\w+)'
            ]

            for pattern in db_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    features['database_operations'].append(FeatureEvidence(
                        str(source_file), i, line, 'database_operation'
                    ))
                    break

            # Configuration keys
            config_match = re.match(r'^[\'"]?([a-zA-Z_][a-zA-Z0-9_]*)[\'"]?\s*[:=]', line)
            if config_match and any(keyword in line.lower() for keyword in ['config', 'setting', 'env', 'database', 'api']):
                features['config_keys'].append(FeatureEvidence(
                    str(source_file), i, line, 'config'
                ))

        return features

    def extract_documentation_claims(self, doc_file: Path) -> List[DocumentationClaim]:
        """Extract feature claims from documentation"""
        claims = []

        try:
            with open(doc_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except (UnicodeDecodeError, FileNotFoundError):
            return claims

        # Patterns to identify feature claims
        claim_patterns = [
            # API endpoints
            (r'([A-Z]+\s+[/][^ \n]+)', 'api_endpoint', 90),
            (r'(?:endpoint|route):\s*([A-Z]+\s+[/][^ \n]+)', 'api_endpoint', 85),

            # Database tables
            (r'(?:table|collection):\s*(\w+)', 'database_table', 80),
            (r'(?:CREATE|DROP|ALTER)\s+TABLE\s+(\w+)', 'database_table', 95),

            # Technologies and libraries
            (r'(?:built with|uses|powered by|requires)\s+([A-Z][a-zA-Z0-9\s-]+)', 'technology', 70),
            (r'([A-Z][a-zA-Z0-9]+)\s+(?:library|framework|package)', 'technology', 75),

            # Features and functionality
            (r'(?:supports|provides|offers|includes)\s+(\w+(?:\s+\w+)*)', 'feature', 60),
            (r'(\w+(?:\s+\w+)*)\s+(?:feature|functionality|capability)', 'feature', 65),
        ]

        for i, line in enumerate(lines, 1):
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith('#') or line.startswith('//'):
                continue

            for pattern, claim_type, confidence in claim_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    claim = DocumentationClaim(
                        doc_file=str(doc_file),
                        line_number=i,
                        claim=line,
                        feature_name=match.group(1),
                        confidence=confidence
                    )
                    claims.append(claim)

        return claims

    def search_code_for_feature(self, feature_name: str, source_files: List[Path]) -> List[FeatureEvidence]:
        """Search code for evidence of a specific feature"""
        evidence = []
        feature_lower = feature_name.lower()

        # Search terms related to the feature
        search_terms = [feature_lower]

        # Add common variations
        if '/' in feature_name:  # API endpoint
            search_terms.append(feature_name.split('/')[-1])
            search_terms.append(feature_name.replace('/', '_'))

        # Remove common words and create variations
        feature_words = [w for w in feature_lower.split() if len(w) > 2]
        if feature_words:
            search_terms.extend(feature_words)

        for source_file in source_files:
            try:
                with open(source_file, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
            except (UnicodeDecodeError, PermissionError):
                continue

            for i, line in enumerate(lines, 1):
                line_lower = line.lower()

                # Check if any search term appears in the line
                if any(term in line_lower for term in search_terms):
                    # Determine evidence type
                    evidence_type = 'unknown'
                    if 'import' in line_lower or 'from' in line_lower:
                        evidence_type = 'import'
                    elif 'function' in line_lower or 'def ' in line_lower:
                        evidence_type = 'function'
                    elif 'class ' in line_lower:
                        evidence_type = 'class'
                    elif any(http_method in line_lower for http_method in ['get', 'post', 'put', 'delete']):
                        evidence_type = 'endpoint'
                    elif any(db_word in line_lower for db_word in ['select', 'insert', 'update', 'delete', 'create table']):
                        evidence_type = 'database_operation'

                    evidence.append(FeatureEvidence(
                        str(source_file), i, line.strip(), evidence_type
                    ))

        return evidence

    def verify_code_examples(self, doc_file: Path) -> List[Dict]:
        """Extract and verify code examples in documentation"""
        try:
            with open(doc_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except (UnicodeDecodeError, FileNotFoundError):
            return []

        # Extract code blocks (fenced and indented)
        code_blocks = []

        # Fenced code blocks ```
        fenced_blocks = re.findall(r'```(\w*)\n(.*?)\n```', content, re.DOTALL)
        for language, code in fenced_blocks:
            code_blocks.append({
                'type': 'fenced',
                'language': language or 'text',
                'code': code.strip(),
                'line_number': content[:content.find(code)].count('\n') + 1
            })

        # Indented code blocks (4+ spaces)
        indented_lines = []
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('    ') or line.startswith('\t'):
                indented_lines.append((i+1, line))

        if indented_lines:
            code_blocks.append({
                'type': 'indented',
                'language': 'text',
                'code': '\n'.join(line for _, line in indented_lines),
                'line_number': indented_lines[0][0]
            })

        verified_blocks = []
        for block in code_blocks:
            # Basic syntax checks
            issues = []

            if block['language'] in ['js', 'javascript', 'ts', 'typescript']:
                # Check for common JavaScript/TypeScript syntax errors
                if '{' in block['code'] and '}' not in block['code']:
                    issues.append('Unclosed braces')
                if block['code'].count('(') != block['code'].count(')'):
                    issues.append('Unmatched parentheses')

            elif block['language'] in ['py', 'python']:
                # Check for common Python syntax errors
                if ':' in block['code'] and not block['code'].strip().endswith(':'):
                    lines = block['code'].split('\n')
                    for line in lines:
                        if ':' in line and not line.strip().startswith('#'):
                            if not any(line.strip().startswith(indent) for indent in [' ', '\t']):
                                issues.append('Missing indentation after colon')
                                break

            verified_blocks.append({
                **block,
                'issues': issues,
                'valid': len(issues) == 0
            })

        return verified_blocks

    def verify_accuracy(self) -> Dict:
        """Main verification method"""
        print("🔍 Verifying documentation accuracy...")

        # Find all files
        doc_files = self.find_documentation_files()
        source_files = self.find_source_files()

        print(f"📚 Found {len(doc_files)} documentation files")
        print(f"💻 Found {len(source_files)} source files")

        # Extract all code features
        print("🔧 Extracting code features...")
        all_code_features = {}
        for source_file in source_files:
            features = self.extract_code_features(source_file)
            for feature_type, feature_list in features.items():
                if feature_type not in all_code_features:
                    all_code_features[feature_type] = []
                all_code_features[feature_type].extend(feature_list)

        # Process documentation claims
        print("📝 Processing documentation claims...")
        for doc_file in doc_files:
            claims = self.extract_documentation_claims(doc_file)

            for claim in claims:
                # Search for evidence in code
                evidence = self.search_code_for_feature(claim.feature_name, source_files)

                if evidence:
                    status = FeatureStatus.ACTIVE
                    self.verified_features[claim.feature_name] = {
                        'status': status.value,
                        'evidence': [f"{e.file_path}:{e.line_number} - {e.content[:100]}..." for e in evidence[:5]],
                        'documentation': [claim.doc_file],
                        'confidence': claim.confidence
                    }
                else:
                    # No evidence found - could be documentation-only or inaccurate
                    status = FeatureStatus.DOCUMENTATION_ONLY
                    self.unmatched_claims.append({
                        'claim': claim,
                        'status': status.value,
                        'warning': f"⚠️ {claim.feature_name} documented but no code evidence found"
                    })

        # Check for undocumented features (code-only features)
        print("🔍 Checking for undocumented features...")
        documented_features = set(self.verified_features.keys())

        # Extract feature names from code
        code_feature_names = set()
        for feature_type, features in all_code_features.items():
            for feature in features:
                # Extract meaningful names from evidence
                if feature.evidence_type == 'function':
                    func_match = re.search(r'(?:function|def)\s+(\w+)', feature.content)
                    if func_match:
                        code_feature_names.add(func_match.group(1))
                elif feature.evidence_type == 'class':
                    class_match = re.search(r'class\s+(\w+)', feature.content)
                    if class_match:
                        code_feature_names.add(class_match.group(1))
                elif feature.evidence_type == 'endpoint':
                    endpoint_match = re.search(r'[\'"]/([^\'"]+)[\'"]', feature.content)
                    if endpoint_match:
                        code_feature_names.add(endpoint_match.group(1))

        undocumented = code_feature_names - documented_features
        for feature in undocumented:
            # Find evidence for this undocumented feature
            evidence = self.search_code_for_feature(feature, source_files)
            if evidence:
                self.undocumented_features.append({
                    'feature_name': feature,
                    'evidence': [f"{e.file_path}:{e.line_number} - {e.content[:100]}..." for e in evidence[:3]],
                    'suggestion': f"Create documentation for {feature}"
                })

        # Verify code examples
        print("🧪 Verifying code examples...")
        for doc_file in doc_files:
            code_examples = self.verify_code_examples(doc_file)
            invalid_examples = [ex for ex in code_examples if not ex['valid']]
            if invalid_examples:
                self.inaccurate_examples.append({
                    'doc_file': str(doc_file),
                    'invalid_examples': invalid_examples
                })

        # Generate summary
        total_claims = len(self.verified_features) + len(self.unmatched_claims)
        accuracy_rate = (len(self.verified_features) / total_claims * 100) if total_claims > 0 else 0

        return {
            'summary': {
                'total_documentation_files': len(doc_files),
                'total_source_files': len(source_files),
                'verified_features': len(self.verified_features),
                'unmatched_claims': len(self.unmatched_claims),
                'undocumented_features': len(self.undocumented_features),
                'invalid_code_examples': len(self.inaccurate_examples),
                'accuracy_rate': round(accuracy_rate, 1)
            },
            'verified_features': self.verified_features,
            'unmatched_claims': self.unmatched_claims,
            'undocumented_features': self.undocumented_features,
            'inaccurate_examples': self.inaccurate_examples
        }

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Verify documentation accuracy against code')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--docs-dir', default='docs', help='Documentation directory')
    parser.add_argument('--output', help='Output JSON file path')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON output')

    args = parser.parse_args()

    verifier = DocumentationAccuracyVerifier(args.project_root, args.docs_dir)
    result = verifier.verify_accuracy()

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2 if args.pretty else None)
        print(f"✅ Results saved to: {args.output}")
    else:
        print(json.dumps(result, indent=2 if args.pretty else None))

if __name__ == "__main__":
    main()