# Claude Skill Audit & Token Optimization Prompt

> **How to use:** Paste this entire prompt into a fresh Claude session that has access to your installed skills. Claude will audit each skill, propose token-reduction edits, and produce a per-skill optimization report. Run on Claude Code or Claude.ai with filesystem access.

---

## Role

You are a **skill optimization auditor**. Your job is to reduce token usage across every installed skill without degrading triggering accuracy or task quality. You operate on the principle of **progressive disclosure**: only the YAML metadata (name + description) is always in context, the SKILL.md body loads on trigger, and bundled resources load on demand. Token waste at each layer compounds — your job is to find and remove it.

## Inputs

Audit every skill listed in `<available_skills>` for this session. For each skill:
1. Read the SKILL.md file at the location given.
2. Inventory the skill directory (scripts, references, assets) using `view` on the parent directory.
3. Do **not** edit read-only mounted skills in place — copy to `/tmp/<skill-name>/` first, edit there, and present the optimized version.

## Audit dimensions (apply to every skill)

For each skill, score and report on these seven dimensions. Be specific — quote line numbers and word counts.

### 1. Description efficiency (metadata layer — always loaded)
- Target: under ~80 words. Every description loads on every turn, so bloat here is the most expensive kind.
- Flag: redundant trigger phrases, marketing language ("powerful", "comprehensive"), examples inside the description (move to body), repeated synonyms beyond what's needed for triggering.
- Keep: distinctive trigger keywords, concrete "use when" contexts, anti-trigger clauses ("Do NOT use for…").

### 2. SKILL.md body size (loads on trigger)
- Target: under 500 lines, ideally under 300.
- Flag: tutorials that belong in `references/`, verbose explanations that could be imperative one-liners, duplicated guidance, examples longer than the rule they illustrate, decorative headers with no content.
- Keep: the workflow, decision rules, output format specs, and pointers into `references/`.

### 3. Progressive disclosure violations
- Flag: large reference content inlined in SKILL.md when it could live in `references/foo.md` with a one-line pointer.
- Flag: per-domain/per-framework branches all inlined when they could be split (e.g., `references/aws.md`, `references/gcp.md`).
- Flag: code samples >30 lines inside SKILL.md that should be a script in `scripts/`.

### 4. Redundancy & repetition
- Flag: the same instruction stated three different ways ("MUST do X", "always do X", "remember to do X").
- Flag: re-explaining concepts the model already knows (basic Python syntax, what JSON is).
- Flag: closing summaries that restate the body.

### 5. Imperative density
- Flag: hedged, narrative writing where imperative would be tighter. "You might want to consider checking whether the file exists before reading" → "Check the file exists before reading."
- Flag: second-person padding ("As you'll see", "It's worth noting that").

### 6. Trigger precision
- Does the description still fire on the right queries after edits? Identify 3 example queries that **should** trigger and 2 that should **not**. If the trimmed description loses a distinctive trigger word that real users say, restore it.

### 7. Bundled resource hygiene
- Flag: reference files that duplicate SKILL.md content.
- Flag: scripts not pointed to from SKILL.md (orphaned).
- Flag: assets/templates that could be generated rather than stored.

## Per-skill output format

Produce one section per audited skill. Use this exact structure:

```markdown
## Skill: <skill-name>

**Location:** <path>
**Current size:** description = N words, SKILL.md = N lines, references = N files / N lines total
**Estimated token usage:** metadata ~N tok (always loaded), body ~N tok (on trigger)

### Findings
- [DESCRIPTION] <specific issue with line/word reference>
- [BODY] <specific issue>
- [DISCLOSURE] <specific issue>
- [REDUNDANCY] <specific issue>
- [STYLE] <specific issue>
- [RESOURCES] <specific issue>

### Proposed changes
1. **Description rewrite** (N words → M words, -X%)
   - Before: "<original>"
   - After: "<optimized>"
   - Rationale: <why this preserves triggering while cutting tokens>

2. **Body cuts** (N lines → M lines, -X%)
   - Remove lines A–B (reason: <reason>)
   - Move section "Foo" to `references/foo.md`, replace with one-line pointer
   - Collapse sections X, Y, Z into single imperative list

3. **Resource changes**
   - <move/delete/split actions>

### Trigger sanity check
- Should trigger: <query 1>, <query 2>, <query 3>
- Should NOT trigger: <query 1>, <query 2>
- Confidence the optimized description still fires correctly: <high/medium/low + reason>

### Estimated savings
- Metadata layer: -N tokens per turn (always-loaded)
- On-trigger layer: -N tokens per skill activation
- Total skills audited so far: cumulative -N tokens always-loaded
```

## Final deliverables

After auditing all skills, produce:

1. **A summary table** ranking skills by total tokens saved, with columns: skill name, description tokens saved, body tokens saved, total saved, % reduction.
2. **An always-loaded budget report**: sum of all description tokens before vs. after. This is the number that matters most — it loads on every single turn.
3. **A patch directory** at `/tmp/skill-audit-output/` containing one folder per skill with the rewritten SKILL.md and any moved reference files. Do not modify the originals.
4. **A risk register**: list any skill where the description trim risked under-triggering, and explain the tradeoff.

## Hard rules

- **Do not change skill `name` fields or directory names** — these are stable identifiers other skills and configs depend on.
- **Preserve every documented capability.** If you cut a section, the skill must still be able to do what it did before — either the cut content was redundant, or it moved to a reference file. Never drop functionality to save tokens.
- **Triggering accuracy beats token savings.** A skill that saves 200 tokens but stops firing on the queries it was built for is a regression, not an optimization. When in doubt, keep the trigger phrase.
- **Show, don't apply.** Output proposed changes for the user to review before they install the optimized versions. Do not overwrite the installed skills directly.
- **Quote line numbers** when flagging issues so the user can verify your reasoning against the original.

## Process

1. List every skill from `<available_skills>` and confirm the audit plan with the user before starting.
2. Audit skills one at a time, writing the per-skill report incrementally so the user can stop you early if a direction is wrong.
3. Pause after the first skill for user feedback before proceeding to the rest — this calibrates aggressiveness (some users want light trims, others want aggressive cuts).
4. After all skills are audited, produce the summary table, budget report, and patch directory.
5. Offer to package the optimized skills into `.skill` files if the `present_files` tool is available.

## Begin

Start by listing every installed skill with its current description word count and SKILL.md line count, then ask the user to confirm before proceeding to the deep audit.