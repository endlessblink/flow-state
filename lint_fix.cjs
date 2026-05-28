const fs = require('fs');

// AI Chat Message - unused CalendarDays
const chatMsgPath = 'src/components/ai/ChatMessage.vue';
if (fs.existsSync(chatMsgPath)) {
    let content = fs.readFileSync(chatMsgPath, 'utf8');
    content = content.replace(/CalendarDays,\s*/g, '');
    fs.writeFileSync(chatMsgPath, content);
}

// QuickSortCard - camelCase events
const quicksortPath = 'src/components/QuickSortCard.vue';
if (fs.existsSync(quicksortPath)) {
    let content = fs.readFileSync(quicksortPath, 'utf8');
    content = content.replace(/'swipe-right'/g, "'swipeRight'")
                     .replace(/'swipe-left'/g, "'swipeLeft'")
                     .replace(/'swipe-up'/g, "'swipeUp'")
                     .replace(/'swipe-down'/g, "'swipeDown'");
    fs.writeFileSync(quicksortPath, content);
}

// BaseInput - indentation
const baseInputPath = 'src/components/base/BaseInput.vue';
if (fs.existsSync(baseInputPath)) {
    let content = fs.readFileSync(baseInputPath, 'utf8');
    content = content.replace(/        :placeholder/g, '             :placeholder')
                     .replace(/        :type/g, '             :type')
                     .replace(/        :disabled/g, '             :disabled')
                     .replace(/        :id/g, '             :id');
    fs.writeFileSync(baseInputPath, content);
}

// AIMemoryHealthDashboard - singleline-html-element-content-newline
const healthDashPath = 'src/components/ai/AIMemoryHealthDashboard.vue';
if (fs.existsSync(healthDashPath)) {
    let content = fs.readFileSync(healthDashPath, 'utf8');
    content = content.replace(/<div class="stat-value">(\d+)<\/div>/g, '<div class="stat-value">\n          $1\n        </div>');
    fs.writeFileSync(healthDashPath, content);
}

// AIChatPanel - singleline-html-element-content-newline
const chatPanelPath = 'src/components/ai/AIChatPanel.vue';
if (fs.existsSync(chatPanelPath)) {
    let content = fs.readFileSync(chatPanelPath, 'utf8');
    content = content.replace(/<OverflowTooltip content="Knowledge Base">\s*<Database :size="16" \/>\s*<\/OverflowTooltip>/g, '<OverflowTooltip content="Knowledge Base">\n            <Database :size="16" />\n          </OverflowTooltip>');
    fs.writeFileSync(chatPanelPath, content);
}
