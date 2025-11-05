# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:vue] [vue/compiler-sfc] Identifier 'closeCanvasContextMenu' has already been declared. (1269:6) /mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/src/views/CanvasView.vue 1588| 1589| // Canvas context menu handlers 1590| const closeCanvasContextMenu = () => { 1591| console.log('🔧 CanvasView: Closing context menu, resetting canvasContextSection') 1592| showCanvasContextMenu.value = false"
  - generic [ref=e5]: /mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/src/views/CanvasView.vue:1269:6
  - generic [ref=e6]: "1260 | let nodeElement: HTMLElement | null = null 1261 | 1262 | // If there's only one section node, use it; otherwise try to match by selection state | ^ 1263 | if (allSectionNodes.length === 1) { 1264 | nodeElement = allSectionNodes[0] as HTMLElement"
  - generic [ref=e7]: at constructor (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:367:19) at TypeScriptParserMixin.raise (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:6630:19) at TypeScriptScopeHandler.checkRedeclarationInScope (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:1647:19) at TypeScriptScopeHandler.declareName (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:1613:12) at TypeScriptScopeHandler.declareName (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:4913:11) at TypeScriptParserMixin.declareNameFromIdentifier (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:7594:16) at TypeScriptParserMixin.checkIdentifier (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:7590:12) at TypeScriptParserMixin.checkLVal (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:7529:12) at TypeScriptParserMixin.parseVarId (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:13421:10) at TypeScriptParserMixin.parseVarId (/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/node_modules/@babel/parser/lib/index.js:9772:11)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```