# MDIS Design System & Visual Guidelines
## Maharashtra Drought Intelligence System

This document specifies the design tokens, strict brand palette, typography, responsive layout rules, and component styling applied across the MDIS Next.js frontend.

---

### 1. Brand Palette & Color Tokens

The visual design is grounded in an ocean-abyss dark theme with energetic jade and pink accents, while separating semantic drought severity status colors to avoid cognitive confusion.

#### 1.1 Core Brand Colors
| Token Name | Hex Code | Role in Interface |
|---|---|---|
| **Midnight Abyss** | `#071D2C` | Root canvas ground, app-shell background, map background canvas. |
| **Deep Ocean** | `#102C3C` | Cards, panels, dropdowns, modal containers, and table surface. |
| **Raised Ocean** | `#193B4A` | Interactive hover states, secondary controls, table header rows. |
| **Border Tone** | `#28505C` | Structural card borders, grid dividers, and table cell borders. |
| **Control Border** | `#3B6670` | Input outlines, active focus indicators, and control bounds. |
| **Aqua Jade** | `#54D6BD` | Primary interactive buttons, active rail navigation indicator, key metrics. |
| **Baby Pink** | `#F4BBD0` | Secondary data series, selected district highlight, formula code tokens. |

#### 1.2 Text Hierarchy
| Token Name | Hex Code | Usage |
|---|---|---|
| **Primary Text** | `#EAF4F3` | Page titles, primary numbers, active navigation labels. |
| **Secondary Text** | `#A5BEC3` | Descriptions, table values, metadata subtitles. |
| **Subtle Text** | `#78959D` | Helper text, disabled states, date stamps, units. |

#### 1.3 Independent Semantic Drought Severity Colors
Drought severity semantic colors are kept strictly distinct from the brand palette:
| Severity Category | Hex Code | Status Tag | Meaning |
|---|---|---|---|
| **Near Normal / Wet** | `#10B981` | Green | Index $\ge -0.99$; adequate soil moisture. |
| **Drought Watch** | `#FBBF24` | Yellow | $-1.00 \le \text{Index} \le -1.49$; developing moisture deficit. |
| **Moderate Drought** | `#F97316` | Amber | $-1.50 \le \text{Index} \le -1.99$; vegetative stress. |
| **Severe Drought / High Risk** | `#EF4444` | Red | Critical drought threshold exceeded. |
| **Extreme Emergency** | `#7F1D1D` / `#FCA5A5` | Dark Red | Widespread failure of rainfed crops; fodder crisis. |

---

### 2. Typography

- **Primary Interface Font:** `Public Sans` (Weights: 400, 500, 600, 700) for all headings, body copy, and UI controls.
- **Tabular & Code Font:** `JetBrains Mono` (Weight: 400) for changing numerical indicators, coordinates, timestamps, formulas, and dataset collection IDs (`font-variant-numeric: tabular-nums`).

---

### 3. Layout Architecture

- **App Shell:** Fixed 56px left navigation rail on desktop (`position: fixed; inset: 0 auto 0 0; width: 56px`), with brand monogram `MH`, categorized icons, active indicators, and service health status dot.
- **Content Area:** Offset by 56px on desktop (`.shell-body { margin-left: 56px; }`).
- **Mobile Responsiveness (`< 680px`):** Rail converts smoothly to a 64px bottom fixed navigation bar (`.rail { inset: auto 0 0; height: 64px; flex-direction: row; }`), `.shell-body` padding-bottom 64px, eliminating horizontal overflow across all viewports.
- **Cards & Radii:** Uniform 6px border radius (`--radius-card: 6px;`).
