#!/usr/bin/env python3
"""
Skill Validation and Packaging Script
Validates and packages Claude Code skills for deployment
"""

import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse

class SkillPackager:
    def __init__(self, skill_path: str):
        self.skill_path = Path(skill_path).resolve()
        self.skill_name = self.skill_path.name
        self.errors = []
        self.warnings = []

    def validate_skill_structure(self) -> bool:
        """Validate the skill has required structure"""
        print(f"🔍 Validating skill structure for {self.skill_name}")

        required_files = ["SKILL.md"]
        required_dirs = ["scripts"]

        # Check required files
        for file in required_files:
            file_path = self.skill_path / file
            if not file_path.exists():
                self.errors.append(f"Missing required file: {file}")
            else:
                print(f"✅ Found required file: {file}")

        # Check required directories
        for dir_name in required_dirs:
            dir_path = self.skill_path / dir_name
            if not dir_path.exists() or not dir_path.is_dir():
                self.errors.append(f"Missing required directory: {dir_name}")
            else:
                print(f"✅ Found required directory: {dir_name}")

        # Check optional directories
        optional_dirs = ["references", "assets"]
        for dir_name in optional_dirs:
            dir_path = self.skill_path / dir_name
            if dir_path.exists() and dir_path.is_dir():
                print(f"✅ Found optional directory: {dir_name}")

        return len(self.errors) == 0

    def validate_skill_metadata(self) -> bool:
        """Validate skill metadata against skills.json registry"""
        print(f"📋 Validating skill metadata")

        skills_json_path = self.skill_path.parent.parent / "config" / "skills.json"
        if not skills_json_path.exists():
            self.warnings.append("skills.json registry not found")
            return True  # Not a failure for skill validation

        try:
            with open(skills_json_path, 'r') as f:
                skills_registry = json.load(f)

            if self.skill_name in skills_registry.get("skills", {}):
                skill_metadata = skills_registry["skills"][self.skill_name]

                # Check required metadata fields
                required_fields = ["description", "category", "version", "author"]
                for field in required_fields:
                    if field not in skill_metadata:
                        self.warnings.append(f"Missing metadata field: {field}")
                    else:
                        print(f"✅ Found metadata field: {field}")

                print(f"✅ Skill found in registry with version {skill_metadata.get('version', 'unknown')}")
            else:
                self.warnings.append(f"Skill not found in skills.json registry")

        except json.JSONDecodeError as e:
            self.warnings.append(f"Invalid JSON in skills.json: {e}")

        return True  # Metadata issues are warnings, not errors

    def validate_scripts(self) -> bool:
        """Validate Python scripts in the skill"""
        print(f"🐍 Validating Python scripts")

        scripts_dir = self.skill_path / "scripts"
        if not scripts_dir.exists():
            return True

        python_files = list(scripts_dir.glob("*.py"))
        if not python_files:
            self.warnings.append("No Python scripts found in scripts directory")
            return True

        for script_file in python_files:
            try:
                # Check Python syntax
                with open(script_file, 'r') as f:
                    script_content = f.read()

                # Compile to check syntax
                compile(script_content, str(script_file), 'exec')
                print(f"✅ Valid Python syntax: {script_file.name}")

                # Check for shebang
                if script_content.startswith("#!"):
                    print(f"✅ Has shebang: {script_file.name}")
                else:
                    self.warnings.append(f"No shebang found: {script_file.name}")

            except SyntaxError as e:
                self.errors.append(f"Syntax error in {script_file.name}: {e}")
            except Exception as e:
                self.errors.append(f"Error reading {script_file.name}: {e}")

        return len(self.errors) == 0

    def check_dependencies(self) -> bool:
        """Check if skill dependencies are available"""
        print(f"📦 Checking skill dependencies")

        # Look for requirements.txt or dependencies in scripts
        scripts_dir = self.skill_path / "scripts"
        requirements_file = self.skill_path / "requirements.txt"

        if requirements_file.exists():
            print(f"✅ Found requirements.txt")
            try:
                with open(requirements_file, 'r') as f:
                    requirements = f.read()
                    print(f"📋 Requirements: {len(requirements.splitlines())} packages")
            except Exception as e:
                self.warnings.append(f"Error reading requirements.txt: {e}")

        # Check Python imports in scripts
        if scripts_dir.exists():
            python_files = list(scripts_dir.glob("*.py"))
            imports_found = set()

            for script_file in python_files:
                try:
                    with open(script_file, 'r') as f:
                        content = f.read()
                        # Simple import detection
                        for line in content.split('\n'):
                            if line.strip().startswith('import ') or line.strip().startswith('from '):
                                imports_found.add(line.split()[1])
                except Exception:
                    continue

            if imports_found:
                print(f"📋 Found imports: {len(imports_found)} unique modules")

        return True  # Dependency issues are typically warnings

    def run_skill_test(self) -> bool:
        """Attempt to run the skill's main script if it exists"""
        print(f"🧪 Testing skill execution")

        # Look for main entry point
        potential_mains = [
            self.skill_path / "scripts" / "main.py",
            self.skill_path / "scripts" / f"{self.skill_name}.py",
            self.skill_path / "scripts" / "run.py"
        ]

        for main_script in potential_mains:
            if main_script.exists():
                try:
                    # Try to get help (most scripts support --help)
                    result = subprocess.run(
                        [sys.executable, str(main_script), "--help"],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )

                    if result.returncode == 0:
                        print(f"✅ Main script executable: {main_script.name}")
                        return True
                    else:
                        self.warnings.append(f"Main script failed with code {result.returncode}: {main_script.name}")

                except subprocess.TimeoutExpired:
                    self.warnings.append(f"Main script timed out: {main_script.name}")
                except Exception as e:
                    self.warnings.append(f"Error running main script {main_script.name}: {e}")

                break

        self.warnings.append("No main script found for testing")
        return True  # Not a failure

    def generate_package_info(self) -> Dict[str, Any]:
        """Generate package information"""
        scripts_dir = self.skill_path / "scripts"
        references_dir = self.skill_path / "references"
        assets_dir = self.skill_path / "assets"

        package_info = {
            "skill_name": self.skill_name,
            "path": str(self.skill_path),
            "validation": {
                "errors": self.errors,
                "warnings": self.warnings,
                "is_valid": len(self.errors) == 0
            },
            "structure": {
                "has_skill_md": (self.skill_path / "SKILL.md").exists(),
                "scripts_count": len(list(scripts_dir.glob("*.py"))) if scripts_dir.exists() else 0,
                "references_count": len(list(references_dir.glob("**/*"))) if references_dir.exists() else 0,
                "assets_count": len(list(assets_dir.glob("**/*"))) if assets_dir.exists() else 0
            },
            "size_info": self._calculate_size_info()
        }

        return package_info

    def _calculate_size_info(self) -> Dict[str, int]:
        """Calculate size information"""
        total_size = 0
        file_counts = {
            "total": 0,
            "python": 0,
            "markdown": 0,
            "json": 0,
            "other": 0
        }

        for file_path in self.skill_path.rglob("*"):
            if file_path.is_file():
                total_size += file_path.stat().st_size
                file_counts["total"] += 1

                suffix = file_path.suffix.lower()
                if suffix == ".py":
                    file_counts["python"] += 1
                elif suffix in [".md", ".txt"]:
                    file_counts["markdown"] += 1
                elif suffix == ".json":
                    file_counts["json"] += 1
                else:
                    file_counts["other"] += 1

        return {
            "total_bytes": total_size,
            "total_kb": round(total_size / 1024, 2),
            "file_counts": file_counts
        }

    def package_skill(self) -> Dict[str, Any]:
        """Main packaging function"""
        print(f"📦 Packaging skill: {self.skill_name}")
        print(f"📍 Path: {self.skill_path}")
        print("=" * 50)

        # Run all validations
        structure_valid = self.validate_skill_structure()
        metadata_valid = self.validate_skill_metadata()
        scripts_valid = self.validate_scripts()
        deps_ok = self.check_dependencies()
        test_ok = self.run_skill_test()

        print("=" * 50)

        # Generate package info
        package_info = self.generate_package_info()

        # Print results
        if self.errors:
            print(f"❌ Validation failed with {len(self.errors)} errors:")
            for error in self.errors:
                print(f"   • {error}")

        if self.warnings:
            print(f"⚠️  Validation completed with {len(self.warnings)} warnings:")
            for warning in self.warnings:
                print(f"   • {warning}")

        if len(self.errors) == 0:
            print(f"✅ Skill {self.skill_name} validated successfully!")

            # Create package summary
            print(f"\n📋 Package Summary:")
            print(f"   • Scripts: {package_info['structure']['scripts_count']} Python files")
            print(f"   • References: {package_info['structure']['references_count']} files")
            print(f"   • Assets: {package_info['structure']['assets_count']} files")
            print(f"   • Total size: {package_info['size_info']['total_kb']} KB")

            # Save package info
            package_info_file = self.skill_path / "package_info.json"
            with open(package_info_file, 'w') as f:
                json.dump(package_info, f, indent=2)
            print(f"   • Package info saved to: {package_info_file.name}")
        else:
            print(f"❌ Skill {self.skill_name} validation failed!")

        return package_info

def main():
    parser = argparse.ArgumentParser(description="Package and validate Claude Code skills")
    parser.add_argument("skill_path", help="Path to the skill directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not skill_path.exists() or not skill_path.is_dir():
        print(f"❌ Skill path does not exist or is not a directory: {skill_path}")
        sys.exit(1)

    packager = SkillPackager(skill_path)
    package_info = packager.package_skill()

    # Exit with error code if validation failed
    if not package_info["validation"]["is_valid"]:
        sys.exit(1)

    print(f"\n🎉 Skill {packager.skill_name} is ready for deployment!")

if __name__ == "__main__":
    main()