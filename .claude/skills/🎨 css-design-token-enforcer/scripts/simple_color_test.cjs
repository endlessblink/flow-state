#!/usr/bin/env node

/**
 * Simple color test using curl and cheerio
 * Tests the actual HTML and CSS to identify color issues
 */

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

class SimpleColorTester {
    constructor(appUrl = 'http://localhost:5547') {
        this.appUrl = appUrl;
        this.expectedColor = '#f59e0b';
        this.problematicColors = ['#feca57', '#fbbf24', '#f39c12'];
    }

    async testColors() {
        console.log(`🔍 Testing colors at ${this.appUrl}`);
        console.log('=====================================\n');

        // Test 1: Check if app is accessible
        const isAccessible = await this.checkAppAccessibility();
        if (!isAccessible) {
            console.log('❌ App not accessible. Providing manual testing instructions...\n');
            this.provideManualInstructions();
            return;
        }

        // Test 2: Fetch and analyze HTML
        await this.analyzeHTML();

        // Test 3: Provide browser-based testing
        this.provideBrowserTesting();
    }

    async checkAppAccessibility() {
        return new Promise((resolve) => {
            const url = new URL(this.appUrl);
            const client = url.protocol === 'https:' ? https : http;

            const req = client.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                timeout: 5000
            }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    async analyzeHTML() {
        console.log('📄 Analyzing HTML and CSS...\n');

        try {
            // Use curl to fetch the HTML
            const html = await this.fetchHTML();

            // Look for color-related patterns
            const issues = this.findColorIssues(html);

            this.reportHTMLAnalysis(issues);

        } catch (error) {
            console.log('❌ Could not analyze HTML:', error.message);
        }
    }

    async fetchHTML() {
        return new Promise((resolve, reject) => {
            exec(`curl -s "${this.appUrl}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    findColorIssues(html) {
        const issues = [];

        // Look for hardcoded hex values in inline styles
        const hexPattern = /#[0-9a-fA-F]{3,6}/g;
        const foundColors = html.match(hexPattern) || [];

        // Check for problematic colors
        foundColors.forEach(color => {
            if (this.problematicColors.includes(color.toLowerCase())) {
                issues.push({
                    type: 'hardcoded_problematic_color',
                    color: color,
                    severity: 'high'
                });
            }
        });

        // Look for CSS class patterns
        const priorityMediumCount = (html.match(/priority-medium/g) || []).length;
        const taskNodeCount = (html.match(/task-node/g) || []).length;

        return {
            hardcodedColors: foundColors,
            problematicColors: issues,
            priorityMediumElements: priorityMediumCount,
            taskNodeElements: taskNodeCount
        };
    }

    reportHTMLAnalysis(issues) {
        console.log('📊 HTML Analysis Results:');
        console.log(`   - Priority medium elements found: ${issues.priorityMediumElements}`);
        console.log(`   - Task node elements found: ${issues.taskNodeElements}`);
        console.log(`   - Hardcoded colors found: ${issues.hardcodedColors.length}`);

        if (issues.problematicColors.length > 0) {
            console.log(`   ⚠️  Problematic colors found: ${issues.problematicColors.length}`);
            issues.problematicColors.forEach(issue => {
                console.log(`      - ${issue.color} (${issue.severity} severity)`);
            });
        } else {
            console.log('   ✅ No problematic hardcoded colors found in HTML');
        }

        if (issues.hardcodedColors.length > 0) {
            console.log(`   📝 All hardcoded colors: ${[...new Set(issues.hardcodedColors)].join(', ')}`);
        }

        console.log('');
    }

    provideBrowserTesting() {
        console.log('🌐 Browser-Based Testing Required');
        console.log('==================================\n');

        console.log('Since we need to test actual rendered colors, please follow these steps:\n');

        console.log('1️⃣ Open the Application:');
        console.log(`   URL: ${this.appUrl}`);
        console.log('   Open in Chrome/Firefox with DevTools (F12)\n');

        console.log('2️⃣ Test Each View:');
        console.log('   a) Board View - Look at Kanban task cards');
        console.log('   b) Calendar View - Check calendar event colors');
        console.log('   c) Canvas View - Inspect task node colors');
        console.log('   d) Table View - Check task row badge colors\n');

        console.log('3️⃣ Find Medium Priority Elements:');
        console.log('   Look for tasks with "medium" priority or use this selector in DevTools:\n');

        console.log('   Console Command:');
        console.log('   ```javascript');
        console.log('   // Find all medium priority elements');
        console.log('   const mediumElements = document.querySelectorAll(".priority-medium, [class*=\'priority-medium\']");');
        console.log('   console.log("Found", mediumElements.length, "medium priority elements");');
        console.log('');
        console.log('   // Extract their colors');
        console.log('   const colors = new Set();');
        console.log('   mediumElements.forEach(el => {');
        console.log('     const style = window.getComputedStyle(el);');
        console.log('     const bgColor = style.backgroundColor;');
        console.log('     const color = style.color;');
        console.log('     const mainColor = bgColor !== "rgba(0, 0, 0, 0)" ? bgColor : color;');
        console.log('     ');
        console.log('     // Convert RGB to hex');
        console.log('     const rgb = mainColor.match(/\\d+/g);');
        console.log('     if (rgb && rgb.length >= 3) {');
        console.log('       const hex = "#" + [rgb[0], rgb[1], rgb[2]].map(x => {');
        console.log('         const h = parseInt(x).toString(16);');
        console.log('         return h.length === 1 ? "0" + h : h;');
        console.log('       }).join("");');
        console.log('       colors.add(hex);');
        console.log('     }');
        console.log('   });');
        console.log('   ');
        console.log('   console.log("Colors found:", Array.from(colors));');
        console.log('   console.log("Expected: #f59e0b (orange)");');
        console.log('   console.log("Problematic:", ["#feca57", "#fbbf24", "#f39c12"]);');
        console.log('   console.log("Issues found:", Array.from(colors).filter(c => c !== "#f59e0b"));');
        console.log('   ```\n');

        console.log('4️⃣ Expected Results:');
        console.log(`   ✅ Expected Color: ${this.expectedColor} (orange/amber)`);
        console.log(`   ❌ Problematic Colors: ${this.problematicColors.join(', ')} (yellow variants)`);
        console.log('   🎯 Goal: ALL medium priority elements should show #f59e0b\n');

        console.log('5️⃣ Report Your Findings:');
        console.log('   Please test and report:');
        console.log('   - Are medium priority colors consistent across views?');
        console.log('   - Do you see any yellow colors (#feca57, #fbbf24)?');
        console.log('   - Are all elements showing the expected orange color (#f59e0b)?\n');

        console.log('⚠️  If you still see YELLOW vs ORANGE inconsistency,');
        console.log('    the issue persists and needs further investigation!\n');
    }

    provideManualInstructions() {
        console.log('🔧 Manual Testing Instructions');
        console.log('============================\n');

        console.log('The app might not be running or accessible. Please:\n');
        console.log('1. Start the development server:');
        console.log('   cd /mnt/d/MY\\ PROJECTS/AI/LLM/AI\\ Code\\ Gen/my-builds/Productivity/pomo-flow');
        console.log('   npm run dev\n');
        console.log('2. Note the port shown (usually 5546 or 5547)');
        console.log('3. Open the app and follow the browser testing steps above\n');
        console.log(`4. Test at: http://localhost:PORT (replace PORT with actual port)\n`);
    }
}

// Run the test
if (require.main === module) {
    const appUrl = process.argv[2] || 'http://localhost:5547';
    const tester = new SimpleColorTester(appUrl);
    tester.testColors().catch(console.error);
}

module.exports = SimpleColorTester;