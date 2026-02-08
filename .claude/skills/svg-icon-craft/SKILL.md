---
name: svg-icon-craft
description: "Custom SVG icon design and graphics generation for FlowState's Cyberflow RPG. Encodes cyberpunk icon design principles (sharp angles, circuit motifs, neon-ready), icon categories (achievements, classes, corruption, bosses, shop, stats), Vue inline SVG component patterns, Nano Banana Pro AI graphics generation integration, SVGO optimization, and animated SVG patterns. Use when creating custom game icons or generating visual assets."
---

# SVG Icon Craft — Cyberflow RPG Icon Design System

## 1. Cyberpunk SVG Icon Design Principles

### Visual Language

- **Sharp angles** — No rounded, friendly shapes. Use 45-degree and 60-degree angles, angular silhouettes
- **Circuit board motifs** — Thin lines connecting elements, node dots at intersections
- **Geometric precision** — Hexagons, triangles, diamonds — avoid circles (too soft)
- **Negative space** — Use cutouts and voids to create depth
- **Neon-ready** — Icons work as outlines with glow applied via CSS (stroke only, no fills)
- **Monochrome base** — Design in single color (`currentColor`), let CSS handle color and glow

### Grid System

| Property | Value |
|----------|-------|
| Base size | `viewBox="0 0 24 24"` |
| Stroke width | 1.5px default, 2px for emphasis |
| Corner radius | 0px (sharp) for most, 1px max for functional elements |
| Min detail size | 2px (readable at 16px render) |

### Style Hierarchy

| Purpose | Style | Example |
|---------|-------|---------|
| UI elements | Clean geometric | Navigation, toggles, controls |
| Achievement icons | Detailed symbolic | Trophy with circuit pattern, skull with data lines |
| Class icons | Character silhouette | Hooded figure, mech arm, neural implant |
| Boss icons | Aggressive angular | Virus shape, digital beast, corrupted entity |
| Corruption icons | Glitched/broken | Cracked hexagon, corrupted data stream |
| Stat icons | Abstract geometric | Brain (focus), lightning (speed), chain (consistency) |

### SVG Template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Icon content here -->
</svg>
```

**Rules:**
- Always `viewBox="0 0 24 24"`
- Always `stroke="currentColor"` (CSS controls color)
- Always `fill="none"` (outline style, fills via CSS if needed)
- `stroke-linecap="square"` for cyberpunk sharpness (NOT round)
- `stroke-linejoin="miter"` for sharp corners (NOT round)
- No inline styles — all styling via CSS
- Use `<path>` over `<polygon>`/`<circle>` when possible (smaller output)

---

## 2. Complete Icon Library — SVG Code

### Achievement Icons

#### First Task — Digital Initiation (upload arrow in hexagon)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Hexagon frame -->
  <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
  <!-- Upload arrow -->
  <path d="M12 16 V8" />
  <path d="M8 12 L12 8 L16 12" />
  <!-- Circuit node dots -->
  <circle cx="12" cy="2" r="0.8" fill="currentColor" stroke="none" />
  <circle cx="12" cy="22" r="0.8" fill="currentColor" stroke="none" />
</svg>
```

#### Task Streak 7 Days — Fire Circuit (flame with circuit lines)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Flame silhouette (angular) -->
  <path d="M12 2 L8 10 L10 9 L9 14 L11 12 L10 18 L14 11 L12 13 L14 8 L12 10 Z" />
  <!-- Circuit traces from base -->
  <path d="M7 22 L7 18 L10 18" />
  <path d="M17 22 L17 18 L14 18" />
  <!-- Node dots -->
  <circle cx="7" cy="22" r="0.8" fill="currentColor" stroke="none" />
  <circle cx="17" cy="22" r="0.8" fill="currentColor" stroke="none" />
  <circle cx="12" cy="2" r="0.8" fill="currentColor" stroke="none" />
</svg>
```

#### 100 Tasks — Century Hack (digital counter in frame)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Angular frame -->
  <path d="M4 4 L20 4 L20 20 L4 20 Z" />
  <!-- Cutout corners (cyberpunk detail) -->
  <path d="M4 4 L7 4 L4 7" />
  <path d="M20 4 L17 4 L20 7" />
  <path d="M4 20 L7 20 L4 17" />
  <path d="M20 20 L17 20 L20 17" />
  <!-- "1" digit -->
  <path d="M8 9 L10 8 L10 16" />
  <!-- "0" first digit -->
  <path d="M12 8 L15 8 L15 16 L12 16 Z" />
  <!-- "0" second digit -->
  <path d="M17 8 L20 8 L20 16 L17 16 Z" stroke-width="1" />
  <!-- Circuit line at bottom -->
  <path d="M1 22 L23 22" stroke-width="0.75" stroke-dasharray="2 2" />
</svg>
```

#### Speed Demon — Lightning Bolt (angular bolt with data trail)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Angular lightning bolt -->
  <path d="M13 2 L7 12 L11 12 L9 22 L19 10 L14 10 L17 2 Z" />
  <!-- Data trail particles -->
  <path d="M4 6 L6 6" stroke-width="1" />
  <path d="M3 9 L5 9" stroke-width="1" />
  <path d="M2 12 L4 12" stroke-width="1" />
  <!-- Node at impact point -->
  <circle cx="9" cy="22" r="0.8" fill="currentColor" stroke="none" />
</svg>
```

#### Focus Master — Brain Circuit (brain outline with node connections)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Brain outline (angular/geometric) -->
  <path d="M12 2 L8 4 L6 7 L5 11 L6 14 L8 16 L10 17 L12 22" />
  <path d="M12 2 L16 4 L18 7 L19 11 L18 14 L16 16 L14 17 L12 22" />
  <!-- Central division -->
  <path d="M12 4 L12 20" stroke-dasharray="2 1" stroke-width="0.75" />
  <!-- Circuit nodes inside brain -->
  <circle cx="9" cy="8" r="1" fill="currentColor" stroke="none" />
  <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
  <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
  <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
  <!-- Node connections -->
  <path d="M9 8 L15 8" stroke-width="0.75" />
  <path d="M9 13 L15 13" stroke-width="0.75" />
  <path d="M9 8 L9 13" stroke-width="0.75" />
  <path d="M15 8 L15 13" stroke-width="0.75" />
  <path d="M9 8 L15 13" stroke-width="0.75" />
</svg>
```

#### Night Owl — Cyber Eye (eye shape with scan lines)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Eye shape (angular) -->
  <path d="M2 12 L6 7 L12 5 L18 7 L22 12 L18 17 L12 19 L6 17 Z" />
  <!-- Inner diamond pupil -->
  <path d="M12 8 L15 12 L12 16 L9 12 Z" />
  <!-- Center dot -->
  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  <!-- Scan lines -->
  <path d="M2 12 L22 12" stroke-width="0.5" stroke-dasharray="1 2" />
  <!-- Moon crescent (night) -->
  <path d="M18 3 L20 5 L18 7" stroke-width="1" />
  <circle cx="19" cy="5" r="0.5" fill="currentColor" stroke="none" />
</svg>
```

#### Explorer — Hexagonal Radar (compass with scan sweep)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Outer hexagon -->
  <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
  <!-- Inner hexagon -->
  <path d="M12 7 L16.5 9.5 L16.5 14.5 L12 17 L7.5 14.5 L7.5 9.5 Z" />
  <!-- Compass needle -->
  <path d="M12 7 L12 2" stroke-width="2" />
  <path d="M12 17 L12 22" stroke-width="0.75" />
  <!-- Cross hairs -->
  <path d="M7.5 12 L3 12" stroke-width="0.75" />
  <path d="M21 12 L16.5 12" stroke-width="0.75" />
  <!-- Center node -->
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  <!-- Scan blip -->
  <circle cx="15" cy="9" r="0.8" fill="currentColor" stroke="none" />
</svg>
```

### Corruption Tier Icons

#### Tier 1: Clean (0-20) — Pristine Signal

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Perfect hexagon -->
  <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
  <!-- Inner clean diamond -->
  <path d="M12 7 L17 12 L12 17 L7 12 Z" />
  <!-- Bright center node -->
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  <!-- Clean signal lines radiating outward -->
  <path d="M12 2 L12 0" stroke-width="1" />
  <path d="M21 7 L23 6" stroke-width="1" />
  <path d="M21 17 L23 18" stroke-width="1" />
  <path d="M12 22 L12 24" stroke-width="1" />
  <path d="M3 17 L1 18" stroke-width="1" />
  <path d="M3 7 L1 6" stroke-width="1" />
</svg>
```

#### Tier 2: Mild (21-40) — Minor Interference

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Hexagon with 2 glitch cuts -->
  <path d="M12 2 L21 7 L21 12" />
  <!-- Glitch gap -->
  <path d="M21 13 L21 17 L12 22 L3 17 L3 12" />
  <!-- Glitch gap -->
  <path d="M3 11 L3 7 L12 2" />
  <!-- Inner diamond with slight offset -->
  <path d="M12 7 L17 12 L12 17 L7 12 Z" />
  <!-- Center node -->
  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  <!-- Interference lines (subtle noise) -->
  <path d="M20 12 L22 12.5 L21 13" stroke-width="0.75" />
  <path d="M2 11 L4 11.5 L3 12" stroke-width="0.75" />
</svg>
```

#### Tier 3: Moderate (41-60) — Degrading Data

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Hexagon cracking - broken into segments -->
  <path d="M12 2 L21 7 L21 10" />
  <path d="M21 11 L21 14" stroke-dasharray="1 1" />
  <path d="M21 15 L21 17 L16 19.5" />
  <path d="M14 21 L12 22 L3 17 L3 14" />
  <path d="M3 12 L3 7 L12 2" stroke-dasharray="3 1" />
  <!-- Cracked inner diamond -->
  <path d="M12 7 L17 12 L12 17" />
  <path d="M12 17 L7 12 L12 7" stroke-dasharray="2 1" />
  <!-- Degraded center -->
  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  <!-- Noise/corruption lines -->
  <path d="M5 5 L6 6" stroke-width="0.75" />
  <path d="M19 16 L20 17.5" stroke-width="0.75" />
  <path d="M8 19 L9 20" stroke-width="0.75" />
  <!-- Data fragments -->
  <path d="M22 9 L23 8" stroke-width="1" />
  <path d="M1 15 L2 16" stroke-width="1" />
</svg>
```

#### Tier 4: Heavy (61-80) — System Failure

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Broken hexagon - major fractures -->
  <path d="M12 2 L21 7 L21 9" />
  <path d="M20 12 L21 17 L17 19" />
  <path d="M12 22 L8 20" />
  <path d="M5 18 L3 17 L3 13" />
  <path d="M3 10 L3 7 L8 4" />
  <!-- Warning triangle -->
  <path d="M12 7 L17 16 L7 16 Z" stroke-width="2" />
  <!-- Exclamation mark -->
  <path d="M12 10 L12 13" stroke-width="2" />
  <circle cx="12" cy="15" r="0.5" fill="currentColor" stroke="none" />
  <!-- Scattered corruption fragments -->
  <path d="M2 5 L3 4" stroke-width="1" />
  <path d="M22 6 L23 5" stroke-width="1" />
  <path d="M1 19 L2 20" stroke-width="1" />
  <path d="M22 18 L23 19" stroke-width="1" />
  <!-- Noise static -->
  <path d="M6 3 L7 2.5" stroke-width="0.5" />
  <path d="M18 21 L19 20.5" stroke-width="0.5" />
</svg>
```

#### Tier 5: Critical (81-100) — Total Corruption

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Shattered hexagon fragments -->
  <path d="M12 1 L15 3" />
  <path d="M18 5 L21 7" />
  <path d="M21 9 L20 11" />
  <path d="M21 14 L21 16" />
  <path d="M19 19 L16 21" />
  <path d="M10 22 L7 20" />
  <path d="M4 18 L3 16" />
  <path d="M3 12 L3 10" />
  <path d="M4 7 L7 4" />
  <!-- Skull overlay (angular) -->
  <path d="M8 7 L16 7 L17 12 L16 15 L8 15 L7 12 Z" />
  <!-- Eye sockets (angular) -->
  <path d="M9.5 9 L11 9 L11 11 L9.5 11 Z" />
  <path d="M13 9 L14.5 9 L14.5 11 L13 11 Z" />
  <!-- Teeth -->
  <path d="M9 15 L9 17" stroke-width="1" />
  <path d="M11 15 L11 17" stroke-width="1" />
  <path d="M13 15 L13 17" stroke-width="1" />
  <path d="M15 15 L15 17" stroke-width="1" />
  <!-- Heavy corruption static -->
  <path d="M1 3 L3 1" stroke-width="1" />
  <path d="M21 2 L23 4" stroke-width="1" />
  <path d="M0 20 L2 22" stroke-width="1" />
  <path d="M22 21 L24 23" stroke-width="1" />
  <path d="M5 1 L6 0" stroke-width="0.5" />
  <path d="M19 23 L20 24" stroke-width="0.5" />
</svg>
```

### Stat Icons (Radar Chart Labels)

#### Focus — Crosshair Brain

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Crosshair outer -->
  <path d="M12 2 V6" />
  <path d="M12 18 V22" />
  <path d="M2 12 H6" />
  <path d="M18 12 H22" />
  <!-- Diamond target ring -->
  <path d="M12 6 L18 12 L12 18 L6 12 Z" />
  <!-- Brain silhouette (simplified angular) -->
  <path d="M10 8 L9 10 L10 12 L9 14 L10 16" stroke-width="1" />
  <path d="M14 8 L15 10 L14 12 L15 14 L14 16" stroke-width="1" />
  <!-- Center dot -->
  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  <!-- Neural connections -->
  <path d="M10 10 L14 10" stroke-width="0.75" />
  <path d="M10 14 L14 14" stroke-width="0.75" />
</svg>
```

#### Speed — Angular Speedometer

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Gauge arc (angular) -->
  <path d="M4 18 L2 12 L4 6 L8 3 L12 2 L16 3 L20 6 L22 12 L20 18" />
  <!-- Base line -->
  <path d="M4 18 L20 18" />
  <!-- Needle pointing to fast zone -->
  <path d="M12 17 L18 6" stroke-width="2" />
  <!-- Needle pivot -->
  <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
  <!-- Speed tick marks -->
  <path d="M4 6 L5 7" stroke-width="1" />
  <path d="M8 3 L8.5 4.5" stroke-width="1" />
  <path d="M16 3 L15.5 4.5" stroke-width="1" />
  <path d="M20 6 L19 7" stroke-width="1" />
  <!-- Data trail behind needle -->
  <path d="M12 17 L6 8" stroke-width="0.5" stroke-dasharray="1 2" />
</svg>
```

#### Consistency — Linked Chain

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Chain link 1 (angular) -->
  <path d="M2 9 L6 9 L7 10 L7 14 L6 15 L2 15 L1 14 L1 10 Z" />
  <!-- Chain link 2 (interlocked) -->
  <path d="M6 7 L11 7 L12 8 L12 12 L11 13 L6 13 L5 12 L5 8 Z" />
  <!-- Chain link 3 -->
  <path d="M11 9 L16 9 L17 10 L17 14 L16 15 L11 15 L10 14 L10 10 Z" />
  <!-- Chain link 4 -->
  <path d="M16 7 L21 7 L22 8 L22 12 L21 13 L16 13 L15 12 L15 8 Z" />
  <!-- Connecting tension line -->
  <path d="M1 12 L23 12" stroke-width="0.5" stroke-dasharray="1 3" />
  <!-- Strength nodes -->
  <circle cx="4" cy="12" r="0.5" fill="currentColor" stroke="none" />
  <circle cx="8.5" cy="10" r="0.5" fill="currentColor" stroke="none" />
  <circle cx="13.5" cy="12" r="0.5" fill="currentColor" stroke="none" />
  <circle cx="18.5" cy="10" r="0.5" fill="currentColor" stroke="none" />
  <!-- Heartbeat line below -->
  <path d="M2 20 L6 20 L8 17 L10 22 L12 19 L14 20 L22 20" stroke-width="1" />
</svg>
```

#### Depth — Stacked Layers

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Back layer (smallest, offset up-left) -->
  <path d="M6 3 L18 3 L18 11 L6 11 Z" stroke-width="0.75" />
  <!-- Middle layer -->
  <path d="M4 6 L16 6 L16 14 L4 14 Z" stroke-width="1" />
  <!-- Front layer (largest, offset down-right) -->
  <path d="M2 9 L14 9 L14 17 L2 17 Z" stroke-width="1.5" />
  <!-- Perspective lines connecting layers -->
  <path d="M14 9 L18 3" stroke-width="0.5" stroke-dasharray="1 1" />
  <path d="M14 17 L18 11" stroke-width="0.5" stroke-dasharray="1 1" />
  <path d="M2 17 L6 11" stroke-width="0.5" stroke-dasharray="1 1" />
  <!-- Depth indicator arrow -->
  <path d="M19 14 L22 8" stroke-width="1" />
  <path d="M22 8 L20 9" stroke-width="1" />
  <path d="M22 8 L21 10" stroke-width="1" />
  <!-- Content dots on front layer -->
  <circle cx="5" cy="11" r="0.5" fill="currentColor" stroke="none" />
  <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
  <circle cx="11" cy="11" r="0.5" fill="currentColor" stroke="none" />
</svg>
```

#### Endurance — Shield Battery

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Shield outline (angular) -->
  <path d="M12 2 L20 6 L20 14 L12 22 L4 14 L4 6 Z" />
  <!-- Battery charge bars inside shield -->
  <path d="M8 16 L16 16" stroke-width="2" />
  <path d="M8 13 L16 13" stroke-width="2" />
  <path d="M8 10 L16 10" stroke-width="2" />
  <path d="M10 7 L14 7" stroke-width="2" />
  <!-- Shield circuit accent -->
  <path d="M12 2 L12 4" stroke-width="1" />
  <circle cx="12" cy="2" r="0.8" fill="currentColor" stroke="none" />
  <!-- Power indicator nodes -->
  <circle cx="20" cy="6" r="0.6" fill="currentColor" stroke="none" />
  <circle cx="4" cy="6" r="0.6" fill="currentColor" stroke="none" />
</svg>
```

### Class Icons

#### Netrunner — Digital Infiltrator (hooded figure with data streams)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Hood silhouette (angular) -->
  <path d="M7 3 L12 1 L17 3 L18 8 L17 12 L15 14 L9 14 L7 12 L6 8 Z" />
  <!-- Face visor slit -->
  <path d="M9 8 L15 8" stroke-width="2" />
  <!-- Shoulder outline -->
  <path d="M9 14 L4 18 L4 22" />
  <path d="M15 14 L20 18 L20 22" />
  <!-- Data streams flowing from hands -->
  <path d="M4 22 L2 20 L1 22 L0 20" stroke-width="0.75" />
  <path d="M20 22 L22 20 L23 22 L24 20" stroke-width="0.75" />
  <!-- Circuit traces on hood -->
  <path d="M10 4 L10 6" stroke-width="0.75" />
  <path d="M14 4 L14 6" stroke-width="0.75" />
  <path d="M10 6 L14 6" stroke-width="0.75" />
  <!-- Glowing eye dots -->
  <circle cx="10" cy="8" r="0.6" fill="currentColor" stroke="none" />
  <circle cx="14" cy="8" r="0.6" fill="currentColor" stroke="none" />
</svg>
```

#### Chrono — Time Manipulator (clock with circuit internals)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Octagonal clock face (angular, not circular) -->
  <path d="M9 2 L15 2 L20 5 L22 9 L22 15 L20 19 L15 22 L9 22 L4 19 L2 15 L2 9 L4 5 Z" />
  <!-- Hour markers (angular ticks) -->
  <path d="M12 2 L12 5" stroke-width="1" />
  <path d="M22 12 L19 12" stroke-width="1" />
  <path d="M12 22 L12 19" stroke-width="1" />
  <path d="M2 12 L5 12" stroke-width="1" />
  <!-- Clock hands (angular) -->
  <path d="M12 12 L12 6" stroke-width="2" />
  <path d="M12 12 L17 12" stroke-width="1.5" />
  <!-- Circuit pattern inside -->
  <path d="M8 8 L12 12 L16 8" stroke-width="0.75" />
  <path d="M8 16 L12 12 L16 16" stroke-width="0.75" />
  <!-- Center node -->
  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  <!-- Time distortion waves -->
  <path d="M0 9 L2 9" stroke-width="0.5" />
  <path d="M0 15 L2 15" stroke-width="0.5" />
  <path d="M22 9 L24 9" stroke-width="0.5" />
  <path d="M22 15 L24 15" stroke-width="0.5" />
</svg>
```

### Boss Type Icons

#### Virus — Spiky Entity

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Central body (angular) -->
  <path d="M9 9 L15 9 L15 15 L9 15 Z" />
  <!-- Spikes radiating outward -->
  <path d="M12 9 L12 2" stroke-width="2" />
  <path d="M15 12 L22 12" stroke-width="2" />
  <path d="M12 15 L12 22" stroke-width="2" />
  <path d="M9 12 L2 12" stroke-width="2" />
  <!-- Diagonal spikes -->
  <path d="M15 9 L20 4" stroke-width="1.5" />
  <path d="M15 15 L20 20" stroke-width="1.5" />
  <path d="M9 15 L4 20" stroke-width="1.5" />
  <path d="M9 9 L4 4" stroke-width="1.5" />
  <!-- Spike tips (nodes) -->
  <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
  <circle cx="22" cy="12" r="1" fill="currentColor" stroke="none" />
  <circle cx="12" cy="22" r="1" fill="currentColor" stroke="none" />
  <circle cx="2" cy="12" r="1" fill="currentColor" stroke="none" />
  <!-- Evil eye in center -->
  <path d="M10.5 11 L13.5 11 L12 13 Z" fill="currentColor" stroke="none" />
</svg>
```

#### Firewall — Cracked Barrier

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Wall segments -->
  <path d="M2 4 L10 4 L10 10 L2 10 Z" />
  <path d="M14 4 L22 4 L22 10 L14 10 Z" />
  <path d="M2 14 L10 14 L10 20 L2 20 Z" />
  <path d="M14 14 L22 14 L22 20 L14 20 Z" />
  <!-- Cracks through center -->
  <path d="M10 4 L12 7 L14 4" stroke-width="2" />
  <path d="M10 10 L11 12 L13 12 L14 10" stroke-width="2" />
  <path d="M10 14 L12 17 L14 14" stroke-width="2" />
  <!-- Fire glow lines -->
  <path d="M11 1 L12 3 L13 1" stroke-width="1" />
  <path d="M11 21 L12 23 L13 21" stroke-width="1" />
</svg>
```

### Shop Item Icons

#### Theme — Color Palette

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Hexagonal palette frame -->
  <path d="M12 2 L20 6 L20 18 L12 22 L4 18 L4 6 Z" />
  <!-- Color segment dividers -->
  <path d="M12 2 L12 22" stroke-width="0.75" />
  <path d="M4 12 L20 12" stroke-width="0.75" />
  <!-- Color dot indicators -->
  <circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="16" cy="7" r="1.5" />
  <circle cx="8" cy="17" r="1.5" />
  <circle cx="16" cy="17" r="1.5" fill="currentColor" stroke="none" />
</svg>
```

#### Badge — Hexagonal Frame

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <!-- Outer hexagon -->
  <path d="M12 1 L22 6.5 L22 17.5 L12 23 L2 17.5 L2 6.5 Z" stroke-width="2" />
  <!-- Inner hexagon -->
  <path d="M12 6 L17 9 L17 15 L12 18 L7 15 L7 9 Z" />
  <!-- Star/rank symbol inside -->
  <path d="M12 8 L13.5 11 L12 10 L10.5 11 Z" fill="currentColor" stroke="none" />
  <path d="M12 16 L10.5 13 L12 14 L13.5 13 Z" fill="currentColor" stroke="none" />
</svg>
```

---

## 3. Vue Inline SVG Component Pattern

### CyberIcon.vue — Universal Icon Wrapper

```vue
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="square"
    stroke-linejoin="miter"
    class="cyber-icon"
    :class="[
      variant ? `cyber-icon--${variant}` : '',
      { 'cyber-icon--animated': animated }
    ]"
    role="img"
    :aria-label="label"
  >
    <slot />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
  strokeWidth?: number
  variant?: 'default' | 'glow' | 'pulse' | 'glitch' | 'corrupt' | 'scanning' | 'draw'
  animated?: boolean
  label?: string
}>(), {
  size: 24,
  strokeWidth: 1.5,
  variant: 'default',
  animated: false,
  label: 'icon',
})
</script>

<style scoped>
.cyber-icon {
  transition: color 0.2s, filter 0.2s;
}

.cyber-icon--glow {
  filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px currentColor);
}

.cyber-icon--pulse {
  animation: icon-pulse 2s ease-in-out infinite;
}

.cyber-icon--glitch {
  animation: icon-glitch 3s infinite;
}

.cyber-icon--corrupt {
  animation: icon-corrupt 4s infinite;
}

.cyber-icon--draw :deep(path) {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: icon-draw 1s ease forwards;
}

@keyframes icon-pulse {
  0%, 100% { filter: drop-shadow(0 0 2px currentColor); }
  50% { filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor); }
}

@keyframes icon-glitch {
  0%, 95%, 100% { transform: none; filter: none; }
  96% { transform: translate(2px, -1px); filter: hue-rotate(90deg); }
  97% { transform: translate(-2px, 1px); filter: hue-rotate(-90deg); }
  98% { transform: translate(1px, 2px); }
}

@keyframes icon-corrupt {
  0%, 90%, 100% { opacity: 1; transform: none; }
  91% { opacity: 0.8; transform: skewX(5deg); }
  93% { opacity: 0.6; transform: skewX(-3deg) translateX(2px); }
  95% { opacity: 0.9; transform: none; }
}

@keyframes icon-draw {
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cyber-icon--pulse,
  .cyber-icon--glitch,
  .cyber-icon--corrupt,
  .cyber-icon--draw :deep(path) {
    animation: none;
  }
}
</style>
```

### Usage Examples

```vue
<!-- Basic usage with slot content -->
<CyberIcon size="32" variant="glow" label="Focus stat">
  <path d="M12 2 V6" />
  <path d="M12 18 V22" />
  <path d="M12 6 L18 12 L12 18 L6 12 Z" />
  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
</CyberIcon>

<!-- Corruption icon with glitch animation -->
<CyberIcon size="24" variant="corrupt" label="System corruption">
  <!-- Paste corruption tier SVG paths here -->
</CyberIcon>

<!-- Achievement unlock with draw animation -->
<CyberIcon size="48" variant="draw" label="Achievement unlocked">
  <!-- Paste achievement SVG paths here -->
</CyberIcon>
```

### Icon Registry Pattern (for many icons)

```typescript
// src/components/gamification/cyber/iconRegistry.ts

const icons: Record<string, string> = {
  // Achievements
  'achievement-first-task':
    '<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />' +
    '<path d="M12 16 V8" /><path d="M8 12 L12 8 L16 12" />' +
    '<circle cx="12" cy="2" r="0.8" fill="currentColor" stroke="none" />' +
    '<circle cx="12" cy="22" r="0.8" fill="currentColor" stroke="none" />',

  'achievement-streak-7':
    '<path d="M12 2 L8 10 L10 9 L9 14 L11 12 L10 18 L14 11 L12 13 L14 8 L12 10 Z" />' +
    '<path d="M7 22 L7 18 L10 18" /><path d="M17 22 L17 18 L14 18" />' +
    '<circle cx="7" cy="22" r="0.8" fill="currentColor" stroke="none" />' +
    '<circle cx="17" cy="22" r="0.8" fill="currentColor" stroke="none" />',

  'achievement-100-tasks':
    '<path d="M4 4 L20 4 L20 20 L4 20 Z" />' +
    '<path d="M4 4 L7 4 L4 7" /><path d="M20 4 L17 4 L20 7" />' +
    '<path d="M4 20 L7 20 L4 17" /><path d="M20 20 L17 20 L20 17" />' +
    '<path d="M8 9 L10 8 L10 16" /><path d="M12 8 L15 8 L15 16 L12 16 Z" />',

  'achievement-speed-demon':
    '<path d="M13 2 L7 12 L11 12 L9 22 L19 10 L14 10 L17 2 Z" />' +
    '<path d="M4 6 L6 6" stroke-width="1" /><path d="M3 9 L5 9" stroke-width="1" />' +
    '<circle cx="9" cy="22" r="0.8" fill="currentColor" stroke="none" />',

  'achievement-focus-master':
    '<path d="M12 2 L8 4 L6 7 L5 11 L6 14 L8 16 L10 17 L12 22" />' +
    '<path d="M12 2 L16 4 L18 7 L19 11 L18 14 L16 16 L14 17 L12 22" />' +
    '<circle cx="9" cy="8" r="1" fill="currentColor" stroke="none" />' +
    '<circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />' +
    '<circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />' +
    '<circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />' +
    '<path d="M9 8 L15 8" stroke-width="0.75" /><path d="M9 13 L15 13" stroke-width="0.75" />',

  // Corruption tiers
  'corruption-clean':
    '<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />' +
    '<path d="M12 7 L17 12 L12 17 L7 12 Z" />' +
    '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />',

  'corruption-mild':
    '<path d="M12 2 L21 7 L21 12" /><path d="M21 13 L21 17 L12 22 L3 17 L3 12" />' +
    '<path d="M3 11 L3 7 L12 2" /><path d="M12 7 L17 12 L12 17 L7 12 Z" />',

  'corruption-moderate':
    '<path d="M12 2 L21 7 L21 10" /><path d="M21 11 L21 14" stroke-dasharray="1 1" />' +
    '<path d="M21 15 L21 17 L16 19.5" /><path d="M14 21 L12 22 L3 17 L3 14" />' +
    '<path d="M3 12 L3 7 L12 2" stroke-dasharray="3 1" />',

  'corruption-heavy':
    '<path d="M12 2 L21 7 L21 9" /><path d="M20 12 L21 17 L17 19" />' +
    '<path d="M12 22 L8 20" /><path d="M5 18 L3 17 L3 13" />' +
    '<path d="M12 7 L17 16 L7 16 Z" stroke-width="2" />' +
    '<path d="M12 10 L12 13" stroke-width="2" />',

  'corruption-critical':
    '<path d="M12 1 L15 3" /><path d="M18 5 L21 7" /><path d="M21 9 L20 11" />' +
    '<path d="M8 7 L16 7 L17 12 L16 15 L8 15 L7 12 Z" />' +
    '<path d="M9.5 9 L11 9 L11 11 L9.5 11 Z" /><path d="M13 9 L14.5 9 L14.5 11 L13 11 Z" />' +
    '<path d="M9 15 L9 17" stroke-width="1" /><path d="M11 15 L11 17" stroke-width="1" />' +
    '<path d="M13 15 L13 17" stroke-width="1" /><path d="M15 15 L15 17" stroke-width="1" />',

  // Stats
  'stat-focus':
    '<path d="M12 2 V6" /><path d="M12 18 V22" /><path d="M2 12 H6" /><path d="M18 12 H22" />' +
    '<path d="M12 6 L18 12 L12 18 L6 12 Z" />' +
    '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />',

  'stat-speed':
    '<path d="M4 18 L2 12 L4 6 L8 3 L12 2 L16 3 L20 6 L22 12 L20 18" />' +
    '<path d="M4 18 L20 18" /><path d="M12 17 L18 6" stroke-width="2" />' +
    '<circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />',

  'stat-consistency':
    '<path d="M2 9 L6 9 L7 10 L7 14 L6 15 L2 15 L1 14 L1 10 Z" />' +
    '<path d="M6 7 L11 7 L12 8 L12 12 L11 13 L6 13 L5 12 L5 8 Z" />' +
    '<path d="M11 9 L16 9 L17 10 L17 14 L16 15 L11 15 L10 14 L10 10 Z" />' +
    '<path d="M2 20 L6 20 L8 17 L10 22 L12 19 L14 20 L22 20" stroke-width="1" />',

  'stat-depth':
    '<path d="M6 3 L18 3 L18 11 L6 11 Z" stroke-width="0.75" />' +
    '<path d="M4 6 L16 6 L16 14 L4 14 Z" stroke-width="1" />' +
    '<path d="M2 9 L14 9 L14 17 L2 17 Z" stroke-width="1.5" />',

  'stat-endurance':
    '<path d="M12 2 L20 6 L20 14 L12 22 L4 14 L4 6 Z" />' +
    '<path d="M8 16 L16 16" stroke-width="2" /><path d="M8 13 L16 13" stroke-width="2" />' +
    '<path d="M8 10 L16 10" stroke-width="2" /><path d="M10 7 L14 7" stroke-width="2" />',

  // Classes
  'class-netrunner':
    '<path d="M7 3 L12 1 L17 3 L18 8 L17 12 L15 14 L9 14 L7 12 L6 8 Z" />' +
    '<path d="M9 8 L15 8" stroke-width="2" />' +
    '<path d="M9 14 L4 18 L4 22" /><path d="M15 14 L20 18 L20 22" />' +
    '<circle cx="10" cy="8" r="0.6" fill="currentColor" stroke="none" />' +
    '<circle cx="14" cy="8" r="0.6" fill="currentColor" stroke="none" />',

  'class-chrono':
    '<path d="M9 2 L15 2 L20 5 L22 9 L22 15 L20 19 L15 22 L9 22 L4 19 L2 15 L2 9 L4 5 Z" />' +
    '<path d="M12 2 L12 5" stroke-width="1" /><path d="M22 12 L19 12" stroke-width="1" />' +
    '<path d="M12 12 L12 6" stroke-width="2" /><path d="M12 12 L17 12" stroke-width="1.5" />' +
    '<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />',

  // Bosses
  'boss-virus':
    '<path d="M9 9 L15 9 L15 15 L9 15 Z" />' +
    '<path d="M12 9 L12 2" stroke-width="2" /><path d="M15 12 L22 12" stroke-width="2" />' +
    '<path d="M12 15 L12 22" stroke-width="2" /><path d="M9 12 L2 12" stroke-width="2" />' +
    '<path d="M15 9 L20 4" stroke-width="1.5" /><path d="M15 15 L20 20" stroke-width="1.5" />' +
    '<path d="M9 15 L4 20" stroke-width="1.5" /><path d="M9 9 L4 4" stroke-width="1.5" />',

  'boss-firewall':
    '<path d="M2 4 L10 4 L10 10 L2 10 Z" /><path d="M14 4 L22 4 L22 10 L14 10 Z" />' +
    '<path d="M2 14 L10 14 L10 20 L2 20 Z" /><path d="M14 14 L22 14 L22 20 L14 20 Z" />' +
    '<path d="M10 4 L12 7 L14 4" stroke-width="2" />' +
    '<path d="M10 10 L11 12 L13 12 L14 10" stroke-width="2" />',

  // Shop
  'shop-theme':
    '<path d="M12 2 L20 6 L20 18 L12 22 L4 18 L4 6 Z" />' +
    '<path d="M12 2 L12 22" stroke-width="0.75" /><path d="M4 12 L20 12" stroke-width="0.75" />' +
    '<circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />' +
    '<circle cx="16" cy="17" r="1.5" fill="currentColor" stroke="none" />',

  'shop-badge':
    '<path d="M12 1 L22 6.5 L22 17.5 L12 23 L2 17.5 L2 6.5 Z" stroke-width="2" />' +
    '<path d="M12 6 L17 9 L17 15 L12 18 L7 15 L7 9 Z" />' +
    '<path d="M12 8 L13.5 11 L12 10 L10.5 11 Z" fill="currentColor" stroke="none" />',
}

export function getIconPaths(name: string): string {
  return icons[name] || icons['achievement-first-task']
}

export function getIconNames(): string[] {
  return Object.keys(icons)
}

export type CyberIconName = keyof typeof icons
```

### Using the Registry in Components

```vue
<template>
  <CyberIcon :size="size" :variant="variant" :label="iconName">
    <g v-html="iconPaths" />
  </CyberIcon>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CyberIcon from './CyberIcon.vue'
import { getIconPaths } from './iconRegistry'

const props = defineProps<{
  name: string
  size?: number
  variant?: 'default' | 'glow' | 'pulse' | 'glitch' | 'corrupt'
}>()

const iconPaths = computed(() => getIconPaths(props.name))
const iconName = computed(() => props.name.replace(/-/g, ' '))
</script>
```

---

## 4. Nano Banana Pro Integration for AI Graphics Generation

### What Nano Banana Pro Can Generate

- Base concept art for icons (cyberpunk style prompts)
- Background textures (circuit patterns, digital noise, grid patterns)
- Character/boss concept art (to be traced into SVG)
- UI frame decorations and panel borders

### Workflow

1. **Generate concept** with Nano Banana Pro using cyberpunk-specific prompts
2. **Trace to SVG** — Use AI output as reference, manually create clean SVG paths
3. **Optimize** — Run through SVGO
4. **Integrate** — Add to icon registry

### Prompt Templates

| Asset Type | Prompt Pattern |
|------------|---------------|
| Achievement icon | `cyberpunk achievement badge, [concept], circuit board texture, neon [color], dark background, flat vector, minimal` |
| Boss portrait | `cyberpunk digital entity, [boss type], menacing, angular, neon highlights, dark background, portrait` |
| Background texture | `seamless cyberpunk texture, circuit board pattern, dark, subtle neon grid lines, tileable` |
| Panel decoration | `sci-fi UI frame corner decoration, angular, neon [color], transparent background, vector style` |

### Example Prompts

```
# Achievement: First Task
"cyberpunk achievement badge, upload arrow inside hexagonal frame, circuit board lines, neon cyan glow, dark background, flat vector icon style, minimal detail, 24x24 pixel grid"

# Boss: Virus
"cyberpunk digital virus entity, spiky aggressive shape with data tendrils, neon magenta highlights on black background, angular sharp design, portrait view"

# Texture: Circuit Board
"seamless dark circuit board texture, thin neon cyan grid lines, node dots at intersections, tileable pattern, 512x512, digital cyberpunk aesthetic"
```

### Limitations

- AI-generated art needs manual cleanup for SVG conversion
- Generated assets may not match exact 24x24 grid — always redraw for icons
- Best for conceptual reference and texture generation, not final icons
- Always optimize the final SVG output

---

## 5. SVGO Optimization Pipeline

### Setup

```bash
npm install -D svgo
```

### Commands

```bash
# Optimize single file
npx svgo input.svg -o output.svg

# Optimize directory
npx svgo -f src/assets/icons/cyber/ -o src/assets/icons/cyber/

# Preview optimization (dry run)
npx svgo input.svg --pretty --indent=2 -o -
```

### SVGO Config (`svgo.config.js`)

```javascript
module.exports = {
  plugins: [
    'preset-default',
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: ['data-name', 'class'] } },
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          { fill: 'none' },
          { stroke: 'currentColor' },
        ],
      },
    },
    { name: 'sortAttrs' },
    { name: 'removeViewBox', active: false },
  ],
}
```

### Target Sizes

| Icon complexity | Max file size | Path commands |
|-----------------|--------------|---------------|
| Simple (UI) | <300 bytes | 1-3 paths |
| Medium (achievements) | <500 bytes | 3-6 paths |
| Complex (bosses) | <1KB | 6-12 paths |

---

## 6. Animated SVG Patterns

### Pulse Glow (active/selected icons)

```css
.cyber-icon--active {
  animation: icon-glow-pulse 2s ease-in-out infinite;
}

@keyframes icon-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(var(--neon-cyan), 1)); }
  50% { filter: drop-shadow(0 0 6px rgba(var(--neon-cyan), 1)) drop-shadow(0 0 12px rgba(var(--neon-cyan), 0.6)); }
}
```

### Glitch Flicker (corruption icons)

```css
.cyber-icon--corrupt {
  animation: icon-corrupt 4s infinite;
}

@keyframes icon-corrupt {
  0%, 90%, 100% { opacity: 1; transform: none; }
  91% { opacity: 0.8; transform: skewX(5deg); }
  93% { opacity: 0.6; transform: skewX(-3deg) translateX(2px); }
  95% { opacity: 0.9; transform: none; }
}
```

### Scan Line Sweep (loading/scanning states)

```css
.cyber-icon--scanning {
  position: relative;
  overflow: hidden;
}

.cyber-icon--scanning::after {
  content: '';
  position: absolute;
  top: -100%;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(transparent, rgba(var(--neon-cyan), 0.3), transparent);
  animation: icon-scan 2s linear infinite;
}

@keyframes icon-scan {
  from { top: -50%; }
  to { top: 150%; }
}
```

### Draw-on Animation (achievement unlock)

```css
.cyber-icon--draw path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: icon-draw 1s ease forwards;
}

@keyframes icon-draw {
  to { stroke-dashoffset: 0; }
}
```

### XP Gain Flash

```css
.cyber-icon--xp-flash {
  animation: icon-xp 0.6s ease-out;
}

@keyframes icon-xp {
  0% { filter: brightness(1); transform: scale(1); }
  30% { filter: brightness(2) drop-shadow(0 0 8px rgba(var(--neon-cyan), 1)); transform: scale(1.2); }
  100% { filter: brightness(1); transform: scale(1); }
}
```

### Reduced Motion

All animated icons MUST respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .cyber-icon--active,
  .cyber-icon--corrupt,
  .cyber-icon--scanning::after,
  .cyber-icon--draw path,
  .cyber-icon--xp-flash {
    animation: none;
  }
}
```

---

## 7. Icon Color System

Icons inherit color from parent via `currentColor`. Apply semantic colors using FlowState's design tokens:

```css
/* Achievement tier colors (using design tokens) */
.icon-tier-bronze { color: rgb(var(--tier-bronze)); }
.icon-tier-silver { color: rgb(var(--tier-silver)); }
.icon-tier-gold { color: rgb(var(--tier-gold)); }
.icon-tier-platinum { color: rgb(var(--tier-platinum)); }

/* Tier glow effects */
.icon-tier-bronze.icon-glow { filter: var(--tier-glow-bronze); }
.icon-tier-silver.icon-glow { filter: var(--tier-glow-silver); }
.icon-tier-gold.icon-glow { filter: var(--tier-glow-gold); }
.icon-tier-platinum.icon-glow { filter: var(--tier-glow-platinum); }

/* Semantic neon colors */
.icon-success { color: rgb(var(--neon-lime)); }
.icon-danger { color: rgb(var(--neon-magenta)); }
.icon-warning { color: rgb(var(--neon-orange)); }
.icon-info { color: rgb(var(--neon-cyan)); }
.icon-xp { color: rgb(var(--neon-purple)); }

/* Neon glow effects */
.icon-info.icon-glow { filter: var(--neon-glow-cyan); }
.icon-danger.icon-glow { filter: var(--neon-glow-magenta); }
.icon-success.icon-glow { filter: var(--neon-glow-lime); }
```

---

## 8. Accessibility

- All icons MUST have `role="img"` and `aria-label` describing the icon
- Decorative icons: use `aria-hidden="true"` instead of `aria-label`
- Icons paired with text: `aria-hidden="true"` on icon (text carries meaning)
- Animated icons: respect `prefers-reduced-motion` (see section 6)
- Minimum touch target: 24x24px (icon can be smaller inside padding)

```vue
<!-- Meaningful icon (standalone) -->
<CyberIcon label="Focus stat: 85%" variant="glow">
  <!-- focus icon paths -->
</CyberIcon>

<!-- Decorative icon (paired with text) -->
<span class="stat-label">
  <CyberIcon :label="undefined" aria-hidden="true">
    <!-- icon paths -->
  </CyberIcon>
  Focus: 85%
</span>
```

---

## 9. Directory Structure

```
src/assets/icons/cyber/
  achievements/          # Achievement SVG files
  classes/               # Class system SVG files
  corruption/            # Corruption tier SVG files
  stats/                 # Radar chart stat SVG files
  bosses/                # Boss type SVG files
  shop/                  # Shop category SVG files
  ui/                    # General UI icons

src/components/gamification/cyber/
  CyberIcon.vue          # Universal icon wrapper component
  CyberIconDisplay.vue   # Registry-based icon renderer
  iconRegistry.ts        # Icon path string registry
```

---

## 10. Icon Categories Reference

### Full Category Map

| Category | Count Needed | Priority | Status |
|----------|-------------|----------|--------|
| Achievement icons | 20+ | High | 7 provided in this skill |
| Corruption tiers | 5 | High | All 5 provided |
| Stat icons | 5 | High | All 5 provided |
| Class icons | 4 | Medium | 2 provided |
| Boss type icons | 4 | Medium | 2 provided |
| Shop items | 4 | Low | 2 provided |

### Missing Icons (to be created)

**Achievements still needed:**
- Early Bird (rising signal / upward arrows)
- Collector (data vault / stacked hexagons)
- Task Streak 30d (inferno / nested circuits)
- Perfectionist (checkmark in diamond)
- Marathon (finish line / distance markers)
- Social (network nodes / connected users)
- Completionist (filled progress bar)
- Overachiever (crown with circuit)
- Time Lord (hourglass with data)
- Weekend Warrior (shield with calendar)
- Zen Master (meditation pose, angular)
- Multitasker (overlapping task cards)
- Comeback Kid (arrow reversing direction)

**Classes still needed:**
- Architect (blueprint grid with nodes)
- Phantom (fading silhouette with glitch)

**Bosses still needed:**
- Phantom (ghost with data streams)
- Overload (explosion/burst pattern)

**Shop still needed:**
- Animation (motion lines / sparkle)
- Sound (waveform / speaker)
