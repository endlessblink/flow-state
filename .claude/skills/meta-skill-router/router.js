/**
 * Simple Skill Router
 * 
 * Usage: node router.js "user query string"
 * Output: Name of the best matching skill
 */

const fs = require('fs');
const path = require('path');

// --- Configuration ---

// Map keywords/patterns to Macro Skills
const ROUTING_TABLE = [
    {
        skill: "vue-flow-debug",
        patterns: [
            /vue flow/i, /nested node/i, /parent node/i, /graph debug/i, /coordinate/i,
            /computedPosition/i, /drag issue/i, /group node/i, /containment/i
        ]
    },
    {
        skill: "dev-frontend-master",
        patterns: [
            /vue/i, /component/i, /frontend/i, /ui/i, /ux/i, /pinia/i, /store/i, /state/i,
            /reactivity/i, /watch/i, /computed/i, /css/i, /style/i, /tailwind/i,
            /canvas/i, /node/i, /drag/i, /drop/i
        ]
    },
    {
        skill: "dev-backend-master",
        patterns: [
            /supabase/i, /database/i, /db/i, /sql/i, /api/i, /backend/i, /server/i,
            /auth/i, /login/i, /user/i
        ]
    },
    {
        skill: "qa-master",
        patterns: [
            /test/i, /testing/i, /verify/i, /audit/i, /check/i, /validate/i, /playwright/i,
            /e2e/i, /unit/i, /coverage/i, /quality/i, /review/i
        ]
    },

    {
        skill: "dev-bug-fixer",
        patterns: [
            /fix/i, /bug/i, /issue/i, /error/i, /broken/i, /fail/i, /crash/i,
            /debug/i, /timer/i, /keyboard/i, /shortcut/i
        ]
    },
    {
        skill: "arch-architect",
        patterns: [
            /plan/i, /architecture/i, /design/i, /refactor/i, /structure/i, /organize/i,
            /roadmap/i, /master plan/i
        ]
    }
];

// --- Logic ---

function route(query) {
    if (!query) return null;

    let bestMatch = { skill: null, score: 0 };

    for (const route of ROUTING_TABLE) {
        let score = 0;
        for (const pattern of route.patterns) {
            if (pattern.test(query)) {
                score += 1;
            }
        }

        // Boost score for exact keyword matches if query is short
        if (score > 0 && query.length < 50) {
            // Simple boosting heuristic
        }

        if (score > bestMatch.score) {
            bestMatch = { skill: route.skill, score };
        }
    }

    // Threshold
    if (bestMatch.score > 0) {
        return bestMatch.skill;
    }

    return null; // No match found
}

// --- CLI Execution ---

const userQuery = process.argv[2];

if (!userQuery) {
    console.error("Usage: node router.js <query>");
    process.exit(1);
}

const skill = route(userQuery);

if (skill) {
    console.log(skill);
} else {
    // If no specific skill matches, maybe default to planning or debugging depending on context?
    // For now, output nothing or a "help" skill if we had one.
    // We'll output 'dev-bug-fixer' as a safe default for "help me" queries if they contain "fix" or similar, 
    // but if it's truly unknown, we might want to return nothing to let the agent decide.
    console.log("");
}
