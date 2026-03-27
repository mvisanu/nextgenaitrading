# Design System Specification: High-Density Tactical Editorial

## 1. Overview & Creative North Star: "The Kinetic Ledger"
This design system is engineered for environments where information density is a requirement, not a choice. The Creative North Star is **The Kinetic Ledger**—a visual philosophy that treats data as a living, breathing architectural structure. 

While standard high-density UIs often feel "cramped," this system achieves clarity through **Intentional Asymmetry** and **Tonal Depth**. By moving away from traditional 1px borders and toward a layered, "stacked glass" aesthetic, we create a signature experience that feels like a premium terminal for high-stakes decision-making. We prioritize "Information per Pixel" without sacrificing the editorial soul of the interface.

---

## 2. Color & Surface Architecture

### Dual-Theme Logic
The system transitions between a deep, "Deep Titanium" default and a high-clarity "Clean Slate" light mode. The primary energy is driven by **Terminal Green**, used sparingly but with high intent.

*   **The "No-Line" Rule:** 1px solid borders for sectioning are strictly prohibited. Sectioning must be achieved through background shifts. For example, a `surface-container-low` side panel sitting on a `surface` background provides a cleaner, more sophisticated boundary than a stroke.
*   **Surface Hierarchy:** Use the container tiers to create "nested" depth.
    *   `surface-container-lowest`: Background for deepest-level data cells.
    *   `surface-container-low`: Main workspace background.
    *   `surface-container-high`: Hover states and active selections.
    *   `surface-container-highest`: Floating modals or context menus.
*   **The Glass & Gradient Rule:** To inject "soul" into the terminal, use Glassmorphism for floating overlays. Apply a `surface-variant` with 60% opacity and a `backdrop-blur` of 12px. Main CTAs should utilize a subtle linear gradient from `primary` (#67FCBE) to `primary-container` (#44DFA3) at 135°, giving buttons a machined, tactile quality.

---

## 3. Typography: The Inter Architecture
We utilize **Inter** exclusively, but we treat it with editorial rigor. All numerical data **must** use tabular figures (`font-variant-numeric: tabular-nums`) to ensure vertical alignment in high-density tables.

*   **Display & Headlines:** Used for dashboard titles and high-level KPIs. Use `headline-sm` (1.5rem) for most primary headers to save vertical space.
*   **The Data Tier:** `body-sm` (0.75rem) and `label-md` (0.75rem) are the workhorses of this system. In high-density views, use `label-sm` (0.6875rem) for metadata to maximize screen real estate.
*   **Hierarchy through Weight:** Because we lack borders, we use font weight and color contrast (e.g., `on-surface` vs `on-surface-variant`) to guide the eye through complex data sets.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too "soft" for this system's sharp 4px aesthetic. We achieve lift through **Tonal Stacking**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift. This mimics physical sheets of titanium or glass stacked on a desk.
*   **Ambient Shadows:** For floating elements (modals/popovers), use an extra-diffused shadow: `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12)`. The shadow color should be a tinted version of the background, never a generic gray.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **20% opacity**. Never use 100% opaque borders; they clutter the information-dense environment.

---

## 5. Components & Primitive Styling

### Buttons (Kinetic Style)
*   **Primary:** Sharp 4px corners. Gradient fill (`primary` to `primary-container`). Text is `on-primary` (Deep Green/Black) for maximum punch.
*   **Secondary/Tertiary:** No fill. Use "Ghost Borders" on hover. High-density padding: `0.3rem (y) / 0.75rem (x)`.

### Data Grids & Lists (The Divider-Free Rule)
*   **No Dividers:** Standard 1px horizontal lines are forbidden. Use alternating row colors (`surface` and `surface-container-low`) or 0.15rem vertical whitespace (`spacing-1`) to separate entries.
*   **High-Density Cells:** Use `body-sm` with tabular figures. Leading icons should be scaled to 14px to maintain the "Information per Pixel" priority.

### Input Fields
*   **Visual State:** Background set to `surface-container-lowest`. Bottom-only border (2px) using `primary` only on focus. Helper text uses `label-sm` to keep the vertical footprint small.

### Contextual Chips
*   **Tactical Chips:** 4px radius. Use `surface-variant` for the background with `on-surface-variant` text. For status (e.g., "Active"), use a 4px circular "LED" indicator of `primary` color rather than coloring the whole chip.

---

## 6. Do’s and Don’ts

### Do:
*   **Maximize Information Density:** Pack data tightly, but use precise alignment (tabular figures) to maintain scannability.
*   **Use Asymmetric Layouts:** Allow a 70/30 split in dashboard layouts to create a bespoke, non-templated look.
*   **Leverage Tonal Shifts:** Use background color changes to define "zones" of the application.

### Don’t:
*   **Don't use Rounded Corners > 4px:** This system is sharp and technical; avoid the "bubbly" consumer-tech look.
*   **Don't use 1px Borders:** It breaks the "Kinetic Ledger" flow and adds unnecessary visual noise.
*   **Don't use Standard Shadows:** Avoid heavy, dark drop shadows that feel like 2010-era design.
*   **Don't compromise on Tabular Figures:** Proportional numbers in a data-heavy terminal are a failure of the system.