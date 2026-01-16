#!/bin/sh
set -e

echo "🔍 Detecting competing systems before commit..."

# Get the root directory of the project
ROOT_DIR="$(git rev-parse --show-toplevel)"
SKILL_DIR="$ROOT_DIR/.claude-skills/detect-competing-systems"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo "${color}${message}${NC}"
}

# Function to check if Node.js is available
check_node() {
    if ! command -v node &> /dev/null; then
        print_status $RED "❌ Node.js is not installed or not in PATH"
        print_status $YELLOW "Please install Node.js to run conflict detection"
        exit 1
    fi
}

# Function to run conflict analysis
run_conflict_analysis() {
    local report_file="/tmp/competing-systems-report.json"
    local summary_file="/tmp/competing-systems-summary.txt"

    print_status $BLUE "🔄 Running competing systems analysis..."

    # Run the analysis engine
    cd "$ROOT_DIR"
    node "$SKILL_DIR/analysis-engine.js" \
        --reportFormat=json \
        --outputFile="$report_file" \
        --threshold=0.75 || {
        print_status $RED "❌ Analysis engine failed to run"
        exit 1
    }

    # Check if analysis found any conflicts
    if [ ! -f "$report_file" ]; then
        print_status $RED "❌ Analysis report not generated"
        exit 1
    fi

    # Parse and summarize the report
    node -e "
        const fs = require('fs');
        const report = JSON.parse(fs.readFileSync('$report_file', 'utf8'));

        console.log('\\n📊 Analysis Summary:');
        console.log('==================');
        console.log('Total conflicts found:', report.summary.total);
        console.log('HIGH severity:', report.summary.bySeverity.HIGH || 0);
        console.log('MEDIUM severity:', report.summary.bySeverity.MEDIUM || 0);
        console.log('LOW severity:', report.summary.bySeverity.LOW || 0);

        if (report.conflicts.length > 0) {
            console.log('\\n⚠️  Conflicts by type:');
            const byType = {};
            report.conflicts.forEach(conflict => {
                byType[conflict.type] = (byType[conflict.type] || 0) + 1;
            });
            Object.entries(byType).forEach(([type, count]) => {
                console.log('  ' + type + ':', count);
            });

            console.log('\\n🚨 HIGH severity conflicts:');
            const highConflicts = report.conflicts.filter(c => c.severity === 'HIGH');
            if (highConflicts.length > 0) {
                highConflicts.forEach(conflict => {
                    console.log('  - ' + conflict.subtype + ' (' + conflict.files.length + ' files)');
                });
            }

            console.log('\\n💾 Full report saved to: $report_file');
        } else {
            console.log('\\n✅ No competing systems detected!');
        }
    " > "$summary_file"

    cat "$summary_file"

    # Check for HIGH severity conflicts
    local high_conflicts=$(node -e "
        const fs = require('fs');
        const report = JSON.parse(fs.readFileSync('$report_file', 'utf8'));
        const highConflicts = report.conflicts.filter(c => c.severity === 'HIGH');
        console.log(highConflicts.length);
    ")

    if [ "$high_conflicts" -gt 0 ]; then
        print_status $RED "❌ HIGH severity competing systems detected!"
        print_status $YELLOW "Please resolve these conflicts before committing:"
        print_status $YELLOW "   Review the full report at: $report_file"
        print_status $YELLOW "   Or run: node $SKILL_DIR/analysis-engine.js --help"
        print_status $YELLOW ""
        print_status $YELLOW "Common fixes:"
        print_status $YELLOW "   - Consolidate duplicate stores into single store"
        print_status $YELLOW "   - Merge similar composables with configuration options"
        print_status $YELLOW "   - Move data fetching from components to stores"
        print_status $YELLOW "   - Standardize on single reactive pattern"
        print_status $YELLOW ""
        print_status $YELLOW "To bypass this check (not recommended):"
        print_status $YELLOW "   git commit --no-verify"

        exit 1
    fi

    # Check for MEDIUM severity conflicts (warning only)
    local medium_conflicts=$(node -e "
        const fs = require('fs');
        const report = JSON.parse(fs.readFileSync('$report_file', 'uf8'));
        const mediumConflicts = report.conflicts.filter(c => c.severity === 'MEDIUM');
        console.log(mediumConflicts.length);
    ")

    if [ "$medium_conflicts" -gt 0 ]; then
        print_status $YELLOW "⚠️  MEDIUM severity conflicts found - consider resolving:"
        print_status $YELLOW "   Review the report for recommendations"
        print_status $YELLOW "   These don't block commit but should be addressed"
    fi

    print_status $GREEN "✅ No blocking conflicts detected - commit allowed"

    # Clean up temporary files
    rm -f "$summary_file"
}

# Function to check for specific patterns that indicate conflicts
quick_pattern_check() {
    print_status $BLUE "🔍 Running quick pattern checks..."

    local issues=0

    # Check for multiple stores with similar names
    local store_conflicts=$(git diff --cached --name-only | grep -E "stores/.*\.ts$" | wc -l || echo "0")
    if [ "$store_conflicts" -gt 1 ]; then
        print_status $YELLOW "⚠️  Multiple store files being committed:"
        git diff --cached --name-only | grep -E "stores/.*\.ts$" | sed 's/^/   /'
        issues=$((issues + 1))
    fi

    # Check for multiple composables with similar patterns
    local composable_files=$(git diff --cached --name-only | grep -E "composables/.*\.ts$" | wc -l || echo "0")
    if [ "$composable_files" -gt 1 ]; then
        print_status $YELLOW "⚠️  Multiple composable files being committed - check for duplicates"
        issues=$((issues + 1))
    fi

    # Check for fetch patterns in components
    local fetch_files=$(git diff --cached --name-only | grep -E "components/.*\.vue$" | xargs grep -l "fetch(" 2>/dev/null | wc -l || echo "0")
    if [ "$fetch_files" -gt 0 ]; then
        print_status $YELLOW "⚠️  Components with fetch() detected - consider moving to stores"
        issues=$((issues + 1))
    fi

    # Check for reactive pattern inconsistencies
    local reactive_files=$(git diff --cached --name-only | xargs grep -l "shallowReactive\|reactive({.*})" 2>/dev/null | wc -l || echo "0")
    if [ "$reactive_files" -gt 0 ]; then
        print_status $YELLOW "⚠️  Files with reactive patterns found - ensure consistency"
        issues=$((issues + 1))
    fi

    if [ "$issues" -gt 0 ]; then
        print_status $YELLOW "⚠️  Pattern check found $issues potential issues (not blocking)"
    fi
}

# Function to check file size for very large files
check_file_sizes() {
    print_status $BLUE "📏 Checking file sizes..."

    local large_files=$(git diff --cached --name-only | xargs ls -la 2>/dev/null | awk '$5 > 1048576 { print $5, $9 }' || echo "")

    if [ -n "$large_files" ]; then
        print_status $YELLOW "⚠️  Large files being committed:"
        echo "$large_files" | sed 's/^/   /'
        print_status $YELLOW "   Consider if these files should be committed or if they can be optimized"
    fi
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting pre-commit conflict detection..."

    # Check prerequisites
    check_node

    # Run quick checks first
    quick_pattern_check
    check_file_sizes

    # Run full analysis
    run_conflict_analysis

    print_status $GREEN "✅ Pre-commit checks completed successfully"
}

# Handle help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Pre-commit hook for detecting competing systems"
    echo ""
    echo "This hook prevents commits that introduce conflicting systems such as:"
    echo "  - Duplicate Pinia stores managing same data"
    echo "  - Multiple composables with similar functionality"
    echo "  - Components fetching data that should be in stores"
    echo "  - Inconsistent reactive patterns"
    echo "  - Multiple implementations of same utilities"
    echo ""
    echo "To bypass this hook (not recommended):"
    echo "  git commit --no-verify"
    echo ""
    echo "To run manually:"
    echo "  .git/hooks/pre-commit"
    echo ""
    exit 0
fi

# Run main function
main "$@"