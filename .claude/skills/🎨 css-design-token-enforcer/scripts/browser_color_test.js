#!/usr/bin/env node

/**
 * Browser-based color consistency test
 * Uses Puppeteer to visit the app and inspect actual rendered colors
 */

const puppeteer = require('puppeteer');
const path = require('path');

class BrowserColorTester {
    constructor(appUrl = 'http://localhost:5547') {
        this.appUrl = appUrl;
        this.expectedColor = '#f59e0b'; // Orange/amber
        this.problematicColors = ['#feca57', '#fbbf24', '#f39c12']; // Yellow variants
        this.results = [];
    }

    async testColors() {
        console.log(`🔍 Testing colors at ${this.appUrl}`);

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: false, // Show browser for visual verification
                defaultViewport: { width: 1200, height: 800 }
            });

            const page = await browser.newPage();

            // Test different views
            await this.testView(page, 'board', '/board');
            await this.testView(page, 'calendar', '/calendar');
            await this.testView(page, 'canvas', '/canvas');
            await this.testView(page, 'table', '/all-tasks');

            // Generate summary
            this.generateSummary();

        } catch (error) {
            console.error('❌ Error during testing:', error.message);
            // Fallback to instructions if Puppeteer fails
            this.generateManualTestInstructions();
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async testView(page, viewName, path) {
        console.log(`\n📋 Testing ${viewName} view...`);

        try {
            await page.goto(`${this.appUrl}${path}`, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(2000); // Wait for dynamic content

            // Extract colors from medium priority elements
            const colors = await page.evaluate(() => {
                const selectors = [
                    '.priority-medium',
                    '[class*="priority-medium"]',
                    '.task-node.priority-medium',
                    '.task-row__badge--medium',
                    '.task-card .priority-badge.priority-medium',
                    '.calendar-event .priority-stripe.priority-medium'
                ];

                const elements = [];
                selectors.forEach(selector => {
                    const found = document.querySelectorAll(selector);
                    found.forEach((element, index) => {
                        const style = window.getComputedStyle(element);
                        const bgColor = style.backgroundColor;
                        const color = style.color;

                        // Get the main color
                        const mainColor = bgColor !== 'rgba(0, 0, 0, 0)' ? bgColor : color;

                        // Convert RGB to hex
                        const rgb = mainColor.match(/\d+/g);
                        let hexColor = mainColor;
                        if (rgb && rgb.length >= 3) {
                            hexColor = '#' + [rgb[0], rgb[1], rgb[2]].map(x => {
                                const hex = parseInt(x).toString(16);
                                return hex.length === 1 ? '0' + hex : hex;
                            }).join('');
                        }

                        elements.push({
                            selector: selector,
                            element: element.tagName.toLowerCase(),
                            classes: element.className,
                            computedColor: mainColor,
                            hexColor: hexColor,
                            textContent: element.textContent?.substring(0, 30) || 'N/A'
                        });
                    });
                });

                return elements;
            });

            console.log(`  Found ${colors.length} medium priority elements in ${viewName} view`);

            // Analyze colors
            const viewResults = {
                view: viewName,
                elements: colors,
                issues: []
            };

            colors.forEach(color => {
                if (color.hexColor === '#f59e0b') {
                    console.log(`  ✅ ${color.element}: ${color.hexColor} (correct)`);
                } else if (this.problematicColors.includes(color.hexColor)) {
                    console.log(`  ⚠️  ${color.element}: ${color.hexColor} (problematic yellow variant)`);
                    viewResults.issues.push({
                        element: color,
                        type: 'problematic_color',
                        severity: 'high'
                    });
                } else if (color.hexColor !== 'transparent' && color.hexColor !== '#000000') {
                    console.log(`  ❓ ${color.element}: ${color.hexColor} (unexpected)`);
                    viewResults.issues.push({
                        element: color,
                        type: 'unexpected_color',
                        severity: 'medium'
                    });
                }
            });

            this.results.push(viewResults);

            // Take screenshot for visual verification
            await page.screenshot({
                path: `color-test-${viewName}-view.png`,
                fullPage: false
            });

        } catch (error) {
            console.error(`  ❌ Error testing ${viewName} view:`, error.message);
            this.results.push({
                view: viewName,
                error: error.message,
                elements: [],
                issues: []
            });
        }
    }

    generateSummary() {
        console.log('\n🎯 Color Test Summary');
        console.log('===================');

        let totalElements = 0;
        let totalIssues = 0;
        let problematicColorCount = 0;
        const allColors = new Set();

        this.results.forEach(result => {
            if (result.error) {
                console.log(`❌ ${result.view}: ${result.error}`);
                return;
            }

            totalElements += result.elements.length;
            totalIssues += result.issues.length;

            result.elements.forEach(el => {
                if (el.hexColor && el.hexColor !== 'transparent' && el.hexColor !== '#000000') {
                    allColors.add(el.hexColor);
                }
            });

            result.issues.forEach(issue => {
                if (issue.type === 'problematic_color') {
                    problematicColorCount++;
                }
            });

            const status = result.issues.length === 0 ? '✅' : '❌';
            console.log(`${status} ${result.view}: ${result.elements.length} elements, ${result.issues.length} issues`);
        });

        console.log('\n📊 Overall Statistics:');
        console.log(`  Total Elements Tested: ${totalElements}`);
        console.log(`  Total Issues Found: ${totalIssues}`);
        console.log(`  Problematic Colors: ${problematicColorCount}`);
        console.log(`  Unique Colors Found: ${Array.from(allColors).join(', ')}`);

        console.log('\n🎨 Color Analysis:');
        console.log(`  Expected Color: ${this.expectedColor} (orange/amber)`);
        console.log(`  Problematic Colors: ${this.problematicColors.join(', ')} (yellow variants)`);

        const hasExpectedColor = allColors.has(this.expectedColor);
        const hasProblematicColors = this.problematicColors.some(color => allColors.has(color));

        console.log(`  Uses Expected Color: ${hasExpectedColor ? '✅ Yes' : '❌ No'}`);
        console.log(`  Has Problematic Colors: ${hasProblematicColors ? '⚠️ Yes' : '✅ No'}`);

        const overallStatus = totalIssues === 0 && hasExpectedColor ? '✅ PERFECT' : '❌ ISSUES FOUND';
        console.log(`\n🏆 Overall Status: ${overallStatus}`);

        // Save detailed report
        this.saveReport();
    }

    generateManualTestInstructions() {
        console.log('\n🔧 Manual Testing Instructions');
        console.log('============================');
        console.log('Puppeteer not available. Please test manually:');
        console.log(`1. Open ${this.appUrl} in your browser`);
        console.log('2. Navigate to each view (Board, Calendar, Canvas, Table)');
        console.log('3. Look for medium priority tasks/elements');
        console.log('4. Use DevTools to inspect their colors');
        console.log(`5. Expected color: ${this.expectedColor} (orange/amber)`);
        console.log(`6. Problematic colors: ${this.problematicColors.join(', ')} (yellow variants)`);
        console.log('\n📝 DevTools Command:');
        console.log('Copy and paste this into browser console:');
        console.log(`
const mediumElements = document.querySelectorAll('.priority-medium, [class*="priority-medium"]');
const colors = new Set();

mediumElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const bgColor = style.backgroundColor;
    const color = style.color;
    const mainColor = bgColor !== 'rgba(0, 0, 0, 0)' ? bgColor : color;

    const rgb = mainColor.match(/\\d+/g);
    if (rgb && rgb.length >= 3) {
        const hex = '#' + [rgb[0], rgb[1], rgb[2]].map(x => {
            const h = parseInt(x).toString(16);
            return h.length === 1 ? '0' + h : h;
        }).join('');
        colors.add(hex);
    }
});

console.log('Colors found:', Array.from(colors));
console.log('Expected: #f59e0b, Problematic: #feca57, #fbbf24, #f39c12');
        `);
    }

    saveReport() {
        const report = {
            timestamp: new Date().toISOString(),
            appUrl: this.appUrl,
            expectedColor: this.expectedColor,
            problematicColors: this.problematicColors,
            results: this.results,
            summary: {
                totalElements: this.results.reduce((sum, r) => sum + (r.elements?.length || 0), 0),
                totalIssues: this.results.reduce((sum, r) => sum + (r.issues?.length || 0), 0),
                viewsTested: this.results.length
            }
        };

        const fs = require('fs');
        fs.writeFileSync('browser_color_test_report.json', JSON.stringify(report, null, 2));
        console.log('\n📊 Detailed report saved to: browser_color_test_report.json');
    }
}

// Run the test
if (require.main === module) {
    const appUrl = process.argv[2] || 'http://localhost:5547';
    const tester = new BrowserColorTester(appUrl);
    tester.testColors().catch(console.error);
}

module.exports = BrowserColorTester;