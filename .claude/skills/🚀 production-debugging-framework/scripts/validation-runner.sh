#!/bin/bash

# Validation Runner - Sequential validation command execution
# Part of Production Debugging Framework

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")
            echo -e "${BLUE}ℹ️  INFO: ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ SUCCESS: ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  WARNING: ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ ERROR: ${message}${NC}"
            ;;
    esac
}

# Function to run command and capture result
run_validation() {
    local cmd=$1
    local description=$2

    print_status "INFO" "Running: $description"
    print_status "INFO" "Command: $cmd"

    if eval "$cmd"; then
        print_status "SUCCESS" "$description completed successfully"
        return 0
    else
        local exit_code=$?
        print_status "ERROR" "$description failed with exit code $exit_code"
        return $exit_code
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main validation sequence
main() {
    print_status "INFO" "Starting Production Debugging Framework Validation"
    print_status "INFO" "=============================================="

    # Check prerequisites
    print_status "INFO" "Checking prerequisites..."

    if ! command_exists npm; then
        print_status "ERROR" "npm is not installed or not in PATH"
        exit 1
    fi

    if ! command_exists node; then
        print_status "ERROR" "node is not installed or not in PATH"
        exit 1
    fi

    if [[ ! -f "package.json" ]]; then
        print_status "ERROR" "package.json not found in current directory"
        exit 1
    fi

    print_status "SUCCESS" "Prerequisites check passed"

    # Validation sequence
    local validations=(
        "npm run typecheck:TypeScript compilation check"
        "npm run validate:imports:Import validation check"
        "npm run validate:css:CSS validation check"
        "npm run validate:dependencies:Dependency validation check"
        "npm run lint:Linting check"
    )

    local failed_validations=()
    local successful_validations=()

    # Run each validation
    for validation in "${validations[@]}"; do
        IFS=':' read -r cmd description <<< "$validation"

        if run_validation "$cmd" "$description"; then
            successful_validations+=("$description")
        else
            failed_validations+=("$description")
        fi

        echo ""  # Add spacing between validations
    done

    # Summary report
    print_status "INFO" "Validation Summary"
    print_status "INFO" "=================="

    if [[ ${#successful_validations[@]} -gt 0 ]]; then
        print_status "SUCCESS" "Successful validations (${#successful_validations[@]}):"
        for validation in "${successful_validations[@]}"; do
            echo "  ✅ $validation"
        done
    fi

    if [[ ${#failed_validations[@]} -gt 0 ]]; then
        print_status "ERROR" "Failed validations (${#failed_validations[@]}):"
        for validation in "${failed_validations[@]}"; do
            echo "  ❌ $validation"
        done
    fi

    # Overall result
    if [[ ${#failed_validations[@]} -eq 0 ]]; then
        print_status "SUCCESS" "All validations passed! 🎉"
        echo ""
        print_status "INFO" "Ready for development and testing"
        return 0
    else
        print_status "ERROR" "Some validations failed. Please fix the issues before proceeding."
        echo ""
        print_status "INFO" "Use the production-debugging-framework skill to resolve failed validations"
        return 1
    fi
}

# Optional: Build validation if requested
build_validation() {
    print_status "INFO" "Running build validation..."
    if run_validation "npm run build" "Production build check"; then
        print_status "SUCCESS" "Build validation passed"
        return 0
    else
        print_status "ERROR" "Build validation failed"
        return 1
    fi
}

# Optional: Test validation if requested
test_validation() {
    print_status "INFO" "Running test validation..."
    if run_validation "npm run test" "Test suite check"; then
        print_status "SUCCESS" "Test validation passed"
        return 0
    else
        print_status "ERROR" "Test validation failed"
        return 1
    fi
}

# Command line argument handling
case "${1:-default}" in
    "default")
        main
        ;;
    "build")
        main && build_validation
        ;;
    "test")
        main && test_validation
        ;;
    "full")
        main && build_validation && test_validation
        ;;
    "help"|"-h"|"--help")
        echo "Production Debugging Framework Validation Runner"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  default    Run standard validation sequence (default)"
        echo "  build      Run validation + production build check"
        echo "  test       Run validation + test suite check"
        echo "  full       Run validation + build + test checks"
        echo "  help       Show this help message"
        echo ""
        echo "This script runs the complete validation sequence for the"
        echo "Production Debugging Framework to ensure zero-tolerance"
        echo "error resolution before development work."
        ;;
    *)
        print_status "ERROR" "Unknown option: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac