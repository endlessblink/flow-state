# Example: Task Card Text Clipping Fix

## Problem

Task cards with Hebrew text are clipping content at top and bottom. Cards have fixed height with overflow: hidden.

## Input

```javascript
const input = {
  html: `
    <div class="planned-card">
      <div class="card-header">
        <h4 class="card-title">לעשות לעצמי סדר בתוכניות</h4>
        <div class="card-meta">
          <span class="badge-date">Jan 11</span>
          <span class="badge-priority">H</span>
        </div>
      </div>
    </div>
  `,
  css: `
    .planned-card {
      background: #1a2332;
      border: 1px solid #2a3a4a;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 8px;
      height: 60px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 500;
      margin: 0;
      color: #ffffff;
      line-height: 1.2;
    }

    .card-meta {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-shrink: 0;
    }

    .badge-date {
      font-size: 11px;
      color: #999;
    }

    .badge-priority {
      background: #c81530;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
  `,
  context: {
    issue_description:
      "The task card text is clipped at top and bottom, especially with Hebrew RTL text. The first line gets cut off at the top, and the card doesn't expand to show all content.",
    target_selector_hints: [
      ".planned-card",
      ".card-header",
      ".card-title",
      ".card-meta"
    ],
    constraints: [
      "Do not change colors (keep dark theme)",
      "Do not change badge styling",
      "Do not modify the flex layout structure",
      "Preserve the card's overall appearance"
    ],
    viewport_width: 360,
    viewport_height: 800
  }
};
```

## Output

```json
{
  "explanation": "The .planned-card has a fixed height of 60px combined with overflow: hidden and justify-content: center, which clips multi-line content and creates inconsistent vertical spacing. Changing to min-height, increasing padding, and adjusting line-height will allow the card to expand naturally while maintaining alignment.",
  "diagnosis": {
    "root_cause": "Fixed height (60px) with overflow: hidden prevents content from displaying; line-height: 1.2 is too tight for Hebrew text; vertical centering with justify-content: center causes alignment issues",
    "affected_selectors": [
      ".planned-card",
      ".card-title"
    ]
  },
  "css_patches": [
    {
      "selector": ".planned-card",
      "old_block": "    .planned-card {\n      background: #1a2332;\n      border: 1px solid #2a3a4a;\n      border-radius: 8px;\n      padding: 8px 12px;\n      margin-bottom: 8px;\n      height: 60px;\n      overflow: hidden;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n    }",
      "new_block": "    .planned-card {\n      background: #1a2332;\n      border: 1px solid #2a3a4a;\n      border-radius: 8px;\n      padding: 12px 12px;\n      margin-bottom: 8px;\n      min-height: 60px;\n      overflow: visible;\n      display: flex;\n      flex-direction: column;\n      justify-content: flex-start;\n    }",
      "rationale": "Changed height to min-height to allow card to expand with content; increased vertical padding from 8px to 12px for better spacing; removed overflow: hidden to show all content; changed justify-content from center to flex-start for proper top alignment"
    },
    {
      "selector": ".card-title",
      "old_block": "    .card-title {\n      font-size: 14px;\n      font-weight: 500;\n      margin: 0;\n      color: #ffffff;\n      line-height: 1.2;\n    }",
      "new_block": "    .card-title {\n      font-size: 14px;\n      font-weight: 500;\n      margin: 0;\n      color: #ffffff;\n      line-height: 1.5;\n    }",
      "rationale": "Increased line-height from 1.2 to 1.5 to provide better vertical spacing for Hebrew text and prevent line overlap on multi-line cards"
    }
  ],
  "html_patches": [],
  "testing_checklist": [
    "Inspect .planned-card in DevTools - verify min-height is applied instead of height",
    "Check padding is now 12px top/bottom with good spacing",
    "Confirm overflow: visible allows content to display fully without clipping",
    "Test with single-line Hebrew text - should display without clipping top/bottom",
    "Test with multi-line Hebrew text - card should expand to fit all lines",
    "Verify card height matches content (no empty space, no clipping)",
    "Check justify-content: flex-start provides proper top alignment",
    "Test on mobile (360px viewport) to ensure responsive behavior",
    "Verify badge dates and priority badges still display correctly aligned",
    "Check no regressions on other cards in the list"
  ]
}
```

## Fixed CSS

```css
.planned-card {
  background: #1a2332;
  border: 1px solid #2a3a4a;
  border-radius: 8px;
  padding: 12px 12px;           /* Changed: 8px -> 12px */
  margin-bottom: 8px;
  min-height: 60px;             /* Changed: height -> min-height */
  overflow: visible;            /* Changed: hidden -> visible */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;  /* Changed: center -> flex-start */
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #ffffff;
  line-height: 1.5;             /* Changed: 1.2 -> 1.5 */
}
```

## Result

- Hebrew text displays fully without clipping
- Multi-line cards expand to fit content
- Colors and fonts unchanged
- Card maintains dark theme appearance
- Badge styling preserved
- Responsive on mobile (360px)

## Key Takeaways

1. **Fixed height + overflow: hidden = clipping** - Use min-height instead
2. **line-height matters for RTL** - Increase to 1.5 for better spacing
3. **justify-content: center can cause issues** - Use flex-start for natural alignment
4. **Padding affects content visibility** - Increase padding for better spacing
