#!/usr/bin/env python3
"""
Tech Stack Analyzer for Smart Documentation Manager

Detects actual technologies used in the codebase by analyzing:
- Package dependencies (package.json, requirements.txt, etc.)
- Code imports and usage patterns
- Configuration files and build tools

Output: JSON report of detected technologies with confidence scores
"""

import os
import json
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Tuple

class TechStackAnalyzer:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.detected_stack = {
            "languages": set(),
            "frameworks": set(),
            "databases": set(),
            "storage": set(),
            "deployment": set(),
            "testing": set(),
            "build_tools": set()
        }
        self.confidence = {}
        self.detection_method = {}

    def find_dependency_files(self) -> List[Path]:
        """Find all package/dependency files in the project"""
        patterns = [
            "package.json", "package-lock.json", "yarn.lock",
            "requirements.txt", "requirements-dev.txt", "Pipfile", "poetry.lock",
            "Cargo.toml", "Cargo.lock",
            "go.mod", "go.sum",
            "pom.xml", "build.gradle", "build.gradle.kts",
            "composer.json", "composer.lock",
            "Gemfile", "Gemfile.lock",
            "mix.exs", "rebar.lock"
        ]

        found_files = []
        for pattern in patterns:
            found_files.extend(self.project_root.rglob(pattern))

        return found_files

    def analyze_package_json(self, file_path: Path) -> Dict:
        """Analyze Node.js package.json for dependencies"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            deps = {}
            for dep_type in ['dependencies', 'devDependencies', 'peerDependencies']:
                if dep_type in data:
                    deps.update(data[dep_type])

            tech_categories = {
                'frameworks': {
                    'react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'gatsby',
                    'express', 'fastify', 'koa', 'hapi', 'nest', 'nestjs',
                    'django', 'flask', 'rails', 'laravel', 'spring'
                },
                'databases': {
                    'pg', 'postgres', 'mysql', 'mysql2', 'mongodb', 'mongoose',
                    'redis', 'ioredis', 'sqlite', 'sqlite3', 'prisma',
                    'typeorm', 'sequelize', 'knex'
                },
                'testing': {
                    'jest', 'mocha', 'jasmine', 'cypress', 'playwright',
                    'vitest', 'testing-library', 'chai', 'sinon'
                },
                'build_tools': {
                    'webpack', 'rollup', 'vite', 'parcel', 'esbuild',
                    'babel', 'postcss', 'sass', 'less', 'stylus'
                },
                'deployment': {
                    'docker', 'kubernetes', 'k8s', 'helm', 'terraform',
                    'aws-sdk', 'azure-sdk', 'gcp', 'firebase'
                },
                'storage': {
                    'aws-sdk', 'aws-s3', 'minio', 'google-cloud-storage',
                    'azure-storage', 'multer', 'sharp', 'jimp'
                }
            }

            detected = {category: set() for category in tech_categories}

            for dep_name in deps.keys():
                for category, techs in tech_categories.items():
                    if any(tech in dep_name.lower() for tech in techs):
                        detected[category].add(dep_name)

            return detected

        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def analyze_requirements_txt(self, file_path: Path) -> Dict:
        """Analyze Python requirements.txt for dependencies"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Extract package names (handle various formats)
            packages = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#'):
                    # Extract package name before version specifier
                    package = re.split(r'[<>=!]', line)[0].strip()
                    if package:
                        packages.append(package)

            tech_categories = {
                'frameworks': {
                    'django', 'flask', 'fastapi', 'starlette', 'tornado',
                    'aiohttp', 'sanic', 'pyramid', 'bottle', 'cherrypy'
                },
                'databases': {
                    'psycopg2', 'pg', 'mysqlclient', 'mysql-connector',
                    'pymongo', 'redis', 'aioredis', 'sqlite',
                    'sqlalchemy', 'alembic', 'peewee', 'pony'
                },
                'testing': {
                    'pytest', 'unittest', 'nose', 'doctest',
                    'factory-boy', 'faker', 'mock', 'responses'
                },
                'deployment': {
                    'gunicorn', 'uvicorn', 'uwsgi', 'mod-wsgi',
                    'docker', 'kubernetes', 'heroku'
                },
                'storage': {
                    'boto3', 'botocore', 'google-cloud-storage',
                    'azure-storage', 'pillow', 'opencv-python'
                }
            }

            detected = {category: set() for category in tech_categories}

            for package in packages:
                package_lower = package.lower()
                for category, techs in tech_categories.items():
                    if any(tech in package_lower for tech in techs):
                        detected[category].add(package)

            return detected

        except FileNotFoundError:
            return {}

    def analyze_code_imports(self) -> Dict[str, Set[str]]:
        """Analyze code files for import statements to detect actual usage"""
        import_patterns = {
            'TypeScript/JavaScript': [
                (r'^import.*from [\'"]([a-zA-Z0-9@/-]+)[\'"]', 'npm'),
                (r'^const\s+\w+\s*=\s*require\([\'"]([a-zA-Z0-9@/-]+)[\'"]\)', 'npm'),
                (r'^import\s+[\'"]([a-zA-Z0-9@/-]+)[\'"]', 'node_builtin'),
            ],
            'Python': [
                (r'^import\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'python'),
                (r'^from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+import', 'python'),
            ],
            'Rust': [
                (r'^use\s+([a-zA-Z_][a-zA-Z0-9_:]*)', 'rust'),
                (r'^extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'rust'),
            ],
            'Go': [
                (r'^import\s+[\'"]([a-zA-Z0-9_/.-]+)[\'"]', 'go'),
            ]
        }

        code_files = []
        for pattern in ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.rs', '**/*.go']:
            code_files.extend(self.project_root.rglob(pattern))

        detected_imports = {
            'npm': set(),
            'python': set(),
            'rust': set(),
            'go': set(),
            'node_builtin': set()
        }

        for file_path in code_files:
            # Skip node_modules and other dependency directories
            if any(skip in str(file_path) for skip in ['node_modules', 'target', 'vendor', '.git']):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # Detect language from extension
                ext = file_path.suffix.lower()
                if ext in ['.ts', '.tsx', '.js', '.jsx']:
                    patterns = import_patterns['TypeScript/JavaScript']
                elif ext == '.py':
                    patterns = import_patterns['Python']
                elif ext == '.rs':
                    patterns = import_patterns['Rust']
                elif ext == '.go':
                    patterns = import_patterns['Go']
                else:
                    continue

                for line in content.split('\n'):
                    for pattern, import_type in patterns:
                        match = re.match(pattern, line.strip())
                        if match:
                            module_name = match.group(1)
                            detected_imports[import_type].add(module_name)

            except (UnicodeDecodeError, PermissionError):
                continue

        return detected_imports

    def analyze_configuration_files(self) -> Dict:
        """Analyze configuration files for tech stack indicators"""
        config_files = []
        patterns = [
            'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
            'kubernetes/**/*.yaml', 'k8s/**/*.yaml', 'kube/**/*.yaml',
            '.github/workflows/*.yml', '.github/workflows/*.yaml',
            'tsconfig.json', 'webpack.config.js', 'vite.config.js',
            'pytest.ini', 'tox.ini', 'setup.cfg'
        ]

        for pattern in patterns:
            config_files.extend(self.project_root.glob(pattern))
            config_files.extend(self.project_root.rglob(pattern))

        detected = {
            'deployment': set(),
            'build_tools': set(),
            'testing': set(),
            'databases': set()
        }

        for config_file in config_files:
            if config_file.name.startswith('docker') or 'docker' in config_file.name:
                detected['deployment'].add('docker')

            if 'k8s' in str(config_file) or 'kubernetes' in str(config_file):
                detected['deployment'].add('kubernetes')

            if config_file.name == 'tsconfig.json':
                detected['build_tools'].add('typescript')

            if 'webpack' in config_file.name:
                detected['build_tools'].add('webpack')

            if 'vite' in config_file.name:
                detected['build_tools'].add('vite')

        # Check Docker Compose for services
        docker_compose_files = [
            self.project_root / 'docker-compose.yml',
            self.project_root / 'docker-compose.yaml'
        ]

        for docker_file in docker_compose_files:
            if docker_file.exists():
                try:
                    with open(docker_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Look for database services
                    if re.search(r'image:\s*.*postgres', content, re.IGNORECASE):
                        detected['databases'].add('postgresql')
                    if re.search(r'image:\s*.*mysql', content, re.IGNORECASE):
                        detected['databases'].add('mysql')
                    if re.search(r'image:\s*.*redis', content, re.IGNORECASE):
                        detected['databases'].add('redis')
                    if re.search(r'image:\s*.*mongo', content, re.IGNORECASE):
                        detected['databases'].add('mongodb')

                except (UnicodeDecodeError, FileNotFoundError):
                    continue

        return detected

    def calculate_confidence(self, tech: str, evidence: List[str]) -> int:
        """Calculate confidence score based on evidence strength"""
        confidence = 0

        # Evidence from dependencies = high confidence
        dep_files = ['package.json', 'requirements.txt', 'Cargo.toml']
        for evidence_item in evidence:
            for dep_file in dep_files:
                if dep_file in evidence_item:
                    confidence += 40

        # Evidence from code imports = high confidence
        code_patterns = ['import', 'from', 'use', 'require']
        for evidence_item in evidence:
            if any(pattern in evidence_item for pattern in code_patterns):
                confidence += 30

        # Evidence from config files = medium confidence
        config_patterns = ['docker', 'kubernetes', 'config']
        for evidence_item in evidence:
            if any(pattern in evidence_item for pattern in config_patterns):
                confidence += 20

        # Multiple mentions increase confidence
        confidence += min(len(evidence) * 5, 20)

        return min(confidence, 100)

    def analyze(self) -> Dict:
        """Main analysis method"""
        print("🔍 Analyzing technology stack...")

        # Find and analyze dependency files
        dep_files = self.find_dependency_files()
        print(f"📦 Found {len(dep_files)} dependency files")

        for dep_file in dep_files:
            print(f"   Analyzing: {dep_file}")

            if dep_file.name == 'package.json':
                detected = self.analyze_package_json(dep_file)
                for category, techs in detected.items():
                    self.detected_stack[category].update(techs)
                    for tech in techs:
                        evidence = [f"Found in {dep_file.relative_to(self.project_root)}"]
                        self.detection_method[tech] = evidence
                        self.confidence[tech] = self.calculate_confidence(tech, evidence)

            elif dep_file.name.startswith('requirements'):
                detected = self.analyze_requirements_txt(dep_file)
                for category, techs in detected.items():
                    self.detected_stack[category].update(techs)
                    for tech in techs:
                        evidence = [f"Found in {dep_file.relative_to(self.project_root)}"]
                        self.detection_method[tech] = evidence
                        self.confidence[tech] = self.calculate_confidence(tech, evidence)

        # Analyze code imports
        print("💻 Analyzing code imports...")
        imports = self.analyze_code_imports()

        # Add language detection
        if imports['python']:
            self.detected_stack['languages'].add('Python')
        if imports['npm']:
            self.detected_stack['languages'].add('TypeScript')  # or JavaScript

        # Analyze configuration files
        print("⚙️ Analyzing configuration files...")
        config_detected = self.analyze_configuration_files()
        for category, techs in config_detected.items():
            self.detected_stack[category].update(techs)

        # Convert sets to lists for JSON serialization
        result = {
            "detected_stack": {
                category: sorted(list(techs))
                for category, techs in self.detected_stack.items()
            },
            "confidence": self.confidence,
            "detection_method": self.detection_method,
            "summary": {
                "total_technologies": sum(len(techs) for techs in self.detected_stack.values()),
                "high_confidence_count": len([c for c in self.confidence.values() if c >= 80]),
                "dependency_files_analyzed": len(dep_files)
            }
        }

        return result

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Analyze technology stack in codebase')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--output', help='Output JSON file path')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON output')

    args = parser.parse_args()

    analyzer = TechStackAnalyzer(args.project_root)
    result = analyzer.analyze()

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2 if args.pretty else None)
        print(f"✅ Results saved to: {args.output}")
    else:
        print(json.dumps(result, indent=2 if args.pretty else None))

if __name__ == "__main__":
    main()