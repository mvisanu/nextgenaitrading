# Design System Strategy: High-Density Financial Precision

## 1. Overview & Creative North Star

**Creative North Star: The Sovereign Analyst**
This design system moves away from the "toy-like" feel of consumer fintech and toward the authoritative, high-stakes atmosphere of a private trading desk. The aesthetic is defined by **Tonal Depth** and **Editorial Precision**. We reject the standard "dashboard-in-a-box" approach in favor of a bespoke, layered environment that prioritizes information density without sacrificing visual breathing room.

The interface breaks the traditional grid through **Intentional Asymmetry**. Larger charting modules are balanced against high-density side-panels using a sophisticated layering system, mimicking the physical experience of stacked high-resolution monitors. By leveraging depth over borders, we create a UI that feels infinite yet contained.

## 2. Colors

Our palette is engineered for prolonged focus in low-light environments. It moves beyond simple "dark mode" into a multi-tiered tonal ecosystem.

*   **Primary Action (Emerald):** `#44dfa3` (Primary) for buy actions and gains.
*   **Tertiary Action (Ruby):** `#ff716a` (Tertiary) for sell actions and losses.
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background shifts. For example, a `surface-container-low` panel sits on a `background` base to create a natural, sophisticated edge.
*   **Surface Hierarchy & Nesting:** Use the `surface-container` tiers (Lowest to Highest) to create physical layering.
    *   *Base Layer:* `background` (#0b0e13)
    *   *Mid-Ground (Modules):* `surface-container-low` (#0f141a)
    *   *Top-Level (Active Cards):* `surface-container-high` (#18202b)
*   **The "Glass & Gradient" Rule:** Floating modals or dropdowns must utilize Glassmorphism. Use `surface-bright` with a 60% opacity and a `20px` backdrop-blur. 
*   **Signature Textures:** Main Trading CTAs should not be flat. Apply a subtle linear gradient from `primary` (#44dfa3) to `primary_container` (#005237) at a 135-degree angle to provide a premium "machined" look.

## 3. Typography

The typography system uses **Inter** to deliver a clear, neutral voice that allows the volatile data of the market to take center stage.

*   **Display (Scales):** Used for primary portfolio balances. `display-md` (2.75rem) provides an authoritative anchor for the user’s net worth.
*   **Headline & Title (Context):** Used for Ticker symbols and Market sectors. The scale shift between `headline-sm` (1.5rem) and `title-sm` (1rem) creates an editorial hierarchy that guides the eye from the "What" (Stock Symbol) to the "How" (Price Change).
*   **Label & Body (Data):** For high-density tables, utilize `label-md` (0.75rem) and `label-sm` (0.6875rem). The slightly smaller label size allows for maximum columns in the data grid while maintaining legibility through generous letter-spacing (+0.02em).

## 4. Elevation & Depth

We eschew traditional shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-lowest` card inside a `surface-container-low` section to create a "recessed" well for data entry.
*   **Ambient Shadows:** For floating elements (like the 'Classic Trade' window), use an extra-diffused shadow: `0px 24px 48px rgba(0, 0, 0, 0.4)`. The shadow color must never be pure black, but rather a tinted version of `on-surface`.
*   **The "Ghost Border" Fallback:** If a separator is required for accessibility in data tables, use a "Ghost Border": the `outline-variant` token at 15% opacity. 100% opaque borders are forbidden as they "choke" the data.
*   **Glassmorphism:** Use semi-transparent `surface_container_highest` for sidebar navigation overlays to maintain a sense of the "market pulse" happening behind the navigation.

## 5. Components

### Trading Buttons
*   **Primary (Buy):** Background `primary`, text `on_primary`. 0.25rem (DEFAULT) corner radius. 
*   **Tertiary (Sell):** Background `tertiary_container`, text `on_tertiary_container`.
*   **States:** Hover states should not lighten the color; instead, use a subtle 1px "Ghost Border" of `primary_fixed` to indicate focus.

### High-Density Data Tables
*   **Rows:** Forbid the use of dividers. Separate rows using a height of `spacing-8` (1.75rem) and alternating background shifts between `surface` and `surface_container_low`.
*   **Typography:** All numerical data must use tabular lining (monospaced numbers) to ensure decimal points align perfectly across rows.

### Advanced Charting Area
*   **Background:** Use `surface_container_lowest` (#000000) for the main chart area to maximize the contrast of the green and red candles.
*   **Grid Lines:** Use `outline_variant` at 5% opacity. They should be felt, not seen.

### Inputs & Trade Panels
*   **Field Style:** Use `surface_container_highest` for input backgrounds. Use `label-sm` for persistent floating labels to ensure the user never loses context during fast-paced execution.

## 6. Do's and Don'ts

### Do
*   **Do** use `spacing-2` and `spacing-3` for tight internal grouping of financial data.
*   **Do** use `secondary` (#9a9dac) for non-critical metadata (e.g., "Closed 03/26 17:16 EDT") to keep the UI from feeling cluttered.
*   **Do** prioritize the `primary` and `tertiary` colors solely for market movement; do not use them for decorative elements.

### Don't
*   **Don't** use `rounded-full` for anything other than status indicators or profile avatars. Professional tools require the structured feel of `rounded-sm` and `rounded-md`.
*   **Don't** use standard "drop shadows" on cards. Rely on the background color shifts (`surface-container` levels) to define the layout.
*   **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#dce6f9) to reduce eye strain during long-duration trading sessions.