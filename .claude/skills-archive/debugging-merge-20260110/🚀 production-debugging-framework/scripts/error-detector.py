#!/usr/bin/env python3
"""
Error Detector - Automated error classification and routing
Part of Production Debugging Framework

Analyzes error messages and classifies them for appropriate debugging protocols.
"""

import re
import sys
import json
import argparse
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class ErrorType(Enum):
    TYPESCRIPT_COMPILATION = "typescript_compilation"
    IMPORT_MODULE_RESOLUTION = "import_module_resolution"
    COMPONENT_REFERENCE = "component_reference"
    RUNTIME_BROWSER = "runtime_browser"
    BUILD_FAILURE = "build_failure"
    LINTING_ERROR = "linting_error"
    TEST_FAILURE = "test_failure"
    UNKNOWN = "unknown"

class ErrorSeverity(Enum):
    CRITICAL = "critical"  # Blocks development
    HIGH = "high"          # Major functionality impact
    MEDIUM = "medium"      # Some functionality impact
    LOW = "low"            # Minor issues, warnings

@dataclass
class ErrorInfo:
    type: ErrorType
    severity: ErrorSeverity
    pattern: str
    description: str
    suggested_skill: Optional[str]
    suggested_command: Optional[str]

class ErrorDetector:
    """Analyzes error messages and provides routing information"""

    def __init__(self):
        self.error_patterns = self._initialize_patterns()

    def _initialize_patterns(self) -> Dict[str, ErrorInfo]:
        """Initialize error classification patterns"""
        return {
            # TypeScript compilation errors
            r"TS2339.*Property .* does not exist on type": ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.HIGH,
                pattern="TS2339",
                description="TypeScript property missing on type",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            ),
            r"TS2345.*Argument .* is not assignable to parameter": ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.HIGH,
                pattern="TS2345",
                description="TypeScript argument type mismatch",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            ),
            r"TS2322.*Type .* is not assignable to type": ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.HIGH,
                pattern="TS2322",
                description="TypeScript type assignment error",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            ),
            r"TS7005.*implicitly has 'any' type": ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.MEDIUM,
                pattern="TS7005",
                description="TypeScript implicit any type",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            ),
            r"TS7006.*Parameter .* implicitly has 'any' type": ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.MEDIUM,
                pattern="TS7006",
                description="TypeScript parameter implicit any type",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            ),

            # Import/Module resolution errors
            r"Module not found.*Cannot resolve": ErrorInfo(
                type=ErrorType.IMPORT_MODULE_RESOLUTION,
                severity=ErrorSeverity.CRITICAL,
                pattern="Module not found",
                description="Module resolution failure",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run validate:imports"
            ),
            r"Cannot resolve module.*from": ErrorInfo(
                type=ErrorType.IMPORT_MODULE_RESOLUTION,
                severity=ErrorSeverity.CRITICAL,
                pattern="Cannot resolve module",
                description="Import path resolution failure",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run validate:imports"
            ),
            r"Could not find a declaration file for module": ErrorInfo(
                type=ErrorType.IMPORT_MODULE_RESOLUTION,
                severity=ErrorSeverity.MEDIUM,
                pattern="Declaration file not found",
                description="TypeScript module declaration missing",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run validate:imports"
            ),

            # Component reference errors
            r"Component .* failed to resolve": ErrorInfo(
                type=ErrorType.COMPONENT_REFERENCE,
                severity=ErrorSeverity.CRITICAL,
                pattern="Component failed to resolve",
                description="Vue component resolution failure",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run validate:imports"
            ),
            r"Failed to resolve component": ErrorInfo(
                type=ErrorType.COMPONENT_REFERENCE,
                severity=ErrorSeverity.CRITICAL,
                pattern="Failed to resolve component",
                description="Vue component registration issue",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run validate:imports"
            ),

            # Runtime browser errors
            r"Cannot read propert.*of undefined": ErrorInfo(
                type=ErrorType.RUNTIME_BROWSER,
                severity=ErrorSeverity.HIGH,
                pattern="Cannot read property of undefined",
                description="Runtime undefined property access",
                suggested_skill="dev-debugging",
                suggested_command="Check browser DevTools console"
            ),
            r"Cannot read propert.*of null": ErrorInfo(
                type=ErrorType.RUNTIME_BROWSER,
                severity=ErrorSeverity.HIGH,
                pattern="Cannot read property of null",
                description="Runtime null property access",
                suggested_skill="dev-debugging",
                suggested_command="Check browser DevTools console"
            ),
            r"Uncaught.*Error": ErrorInfo(
                type=ErrorType.RUNTIME_BROWSER,
                severity=ErrorSeverity.HIGH,
                pattern="Uncaught Error",
                description="Runtime JavaScript error",
                suggested_skill="dev-debugging",
                suggested_command="Check browser DevTools console"
            ),

            # Build failures
            r"Build failed with code": ErrorInfo(
                type=ErrorType.BUILD_FAILURE,
                severity=ErrorSeverity.CRITICAL,
                pattern="Build failed",
                description="Vite build process failure",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run build"
            ),
            r"Error during build": ErrorInfo(
                type=ErrorType.BUILD_FAILURE,
                severity=ErrorSeverity.CRITICAL,
                pattern="Error during build",
                description="Build process error",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run build"
            ),

            # Linting errors
            r"eslint.*error": ErrorInfo(
                type=ErrorType.LINTING_ERROR,
                severity=ErrorSeverity.LOW,
                pattern="ESLint error",
                description="Code style/linting error",
                suggested_skill="production-debugging-framework",
                suggested_command="npm run lint"
            ),

            # Test failures
            r"Test.*failed": ErrorInfo(
                type=ErrorType.TEST_FAILURE,
                severity=ErrorSeverity.MEDIUM,
                pattern="Test failed",
                description="Unit test failure",
                suggested_skill="qa-testing",
                suggested_command="npm run test"
            ),
        }

    def analyze_error(self, error_message: str) -> Optional[ErrorInfo]:
        """Analyze a single error message and return classification"""
        error_message_lower = error_message.lower()

        for pattern, error_info in self.error_patterns.items():
            if re.search(pattern, error_message, re.IGNORECASE):
                return error_info

        # Check for cascading TypeScript errors
        if error_message_lower.count("error") > 10:
            return ErrorInfo(
                type=ErrorType.TYPESCRIPT_COMPILATION,
                severity=ErrorSeverity.CRITICAL,
                pattern="Cascading TypeScript errors",
                description="Multiple TypeScript compilation errors",
                suggested_skill="ts-foundation-restorer",
                suggested_command="npm run typecheck"
            )

        return None

    def analyze_multiple_errors(self, error_text: str) -> List[Tuple[str, ErrorInfo]]:
        """Analyze multiple errors from a block of text"""
        results = []
        lines = error_text.split('\n')

        for line in lines:
            line = line.strip()
            if line and any(keyword in line.lower() for keyword in ['error', 'failed', 'cannot']):
                error_info = self.analyze_error(line)
                if error_info:
                    results.append((line, error_info))

        return results

    def suggest_debugging_protocol(self, error_info: ErrorInfo) -> str:
        """Suggest specific debugging protocol based on error type"""
        protocols = {
            ErrorType.TYPESCRIPT_COMPILATION: "Use TypeScript Structural Error Protocol:\n1. Read complete file context\n2. Update interfaces/types first\n3. Fix all affected locations\n4. Validate with npm run typecheck",
            ErrorType.IMPORT_MODULE_RESOLUTION: "Use Import/Module Resolution Protocol:\n1. Verify file paths and existence\n2. Check barrel exports\n3. Validate alias configuration\n4. Run npm run validate:imports",
            ErrorType.COMPONENT_REFERENCE: "Use Component Reference Protocol:\n1. Check component registration\n2. Verify import/export consistency\n3. Validate naming conventions\n4. Test with explicit imports",
            ErrorType.RUNTIME_BROWSER: "Use Runtime Error Protocol:\n1. Check browser DevTools console\n2. Examine stack trace\n3. Verify component state\n4. Test with vue-devtools",
            ErrorType.BUILD_FAILURE: "Use Build Error Protocol:\n1. Run npm run build for details\n2. Check dependency resolution\n3. Verify configuration files\n4. Validate imports",
            ErrorType.LINTING_ERROR: "Use Linting Protocol:\n1. Run npm run lint for details\n2. Fix style issues systematically\n3. Update eslint configuration if needed\n4. Validate with npm run lint:fix",
            ErrorType.TEST_FAILURE: "Use Test Failure Protocol:\n1. Run npm run test for details\n2. Examine failing tests\n3. Fix implementation or update tests\n4. Validate with npm run test",
        }

        return protocols.get(error_info.type, "Use Production Debugging Framework for systematic error resolution")

    def generate_master_prompt(self, error_message: str, error_info: ErrorInfo) -> str:
        """Generate master debugging prompt for the error"""
        return f"""I have a {error_info.type.value} error in my Vue 3 + TypeScript project.

CONTEXT:
- Project: Pomo-Flow (Vue 3 + TypeScript + Vite + Pinia)
- Latest Working: [describe last working state]
- Current Error: {error_info.description}
- Error Pattern: {error_info.pattern}
- Error Location: [file:line or component]
- Recent Changes: [what changed since working state]

DEBUGGING REQUIREMENTS:
1. Use production-debugging-framework skill
2. Follow 7-phase zero-error verification
3. Apply error-specific protocol for {error_info.type.value}
4. Read full files for complete context
5. Document the fix and root cause
6. Verify fix with {error_info.suggested_command or 'appropriate validation command'}
7. Confirm return to working state

SUGGESTED SKILL: {error_info.suggested_skill or 'production-debugging-framework'}

DEBUGGING PROTOCOL:
{self.suggest_debugging_protocol(error_info)}

ERROR DETAILS:
{error_message}

EXPECTED OUTCOME:
- Single fix applied
- Zero errors remaining
- Core functionality working
- Build process successful"""

def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description="Error Detector - Production Debugging Framework")
    parser.add_argument("error_file", nargs="?", help="File containing error messages to analyze")
    parser.add_argument("--error", "-e", help="Single error message to analyze")
    parser.add_argument("--json", "-j", action="store_true", help="Output results in JSON format")
    parser.add_argument("--prompt", "-p", action="store_true", help="Generate master debugging prompt")
    parser.add_argument("--stdin", action="store_true", help="Read error messages from stdin")

    args = parser.parse_args()

    detector = ErrorDetector()

    # Read error input
    if args.stdin:
        error_text = sys.stdin.read()
    elif args.error:
        error_text = args.error
    elif args.error_file:
        try:
            with open(args.error_file, 'r') as f:
                error_text = f.read()
        except FileNotFoundError:
            print(f"Error: File '{args.error_file}' not found", file=sys.stderr)
            sys.exit(1)
    else:
        print("Usage: error-detector.py [error_file | --error MESSAGE | --stdin]")
        print("Use --help for more information")
        sys.exit(1)

    # Analyze errors
    errors = detector.analyze_multiple_errors(error_text)

    if not errors:
        print("No recognizable error patterns found")
        sys.exit(0)

    # Output results
    if args.json:
        results = []
        for error_msg, error_info in errors:
            results.append({
                "error_message": error_msg,
                "type": error_info.type.value,
                "severity": error_info.severity.value,
                "pattern": error_info.pattern,
                "description": error_info.description,
                "suggested_skill": error_info.suggested_skill,
                "suggested_command": error_info.suggested_command
            })
        print(json.dumps(results, indent=2))

    elif args.prompt and errors:
        # Generate master prompt for the first (most critical) error
        error_msg, error_info = errors[0]
        print(detector.generate_master_prompt(error_msg, error_info))

    else:
        # Human-readable output
        print(f"Error Analysis Results - Found {len(errors)} errors")
        print("=" * 50)

        for i, (error_msg, error_info) in enumerate(errors, 1):
            print(f"\n{i}. {error_info.type.value.upper()} ERROR")
            print(f"   Severity: {error_info.severity.value}")
            print(f"   Pattern: {error_info.pattern}")
            print(f"   Description: {error_info.description}")
            if error_info.suggested_skill:
                print(f"   Suggested Skill: {error_info.suggested_skill}")
            if error_info.suggested_command:
                print(f"   Suggested Command: {error_info.suggested_command}")
            print(f"   Message: {error_msg}")

if __name__ == "__main__":
    main()