# CodeCraft Upgrade Guide

This guide bundles everything Claudia (or any engineer) needs to implement the
**two‑stage generation + linting pipeline** we discussed.

---

## 1 · Prompt Design

### 1.1 Stage A – Diff → Structured JSON

```
System:
You are DiffSummarizer v2. 
Summarise git diffs for a software‑engineering audience.

User:
<entire git diff here>
```

**Expected JSON**

```jsonc
{
  "overview": "High‑level summary (35–60 words).",
  "key_changes": [
    { "file": "src/components/Badge.tsx",
      "change": "Refactored…",
      "risk": "Low",
      "test_impact": "BadgeSnapshot.test.tsx updated" }
  ],
  "risks": "Single sentence on regressions",
  "tests": "Bullet list of new / updated tests"
}
```

---

### 1.2 Stage B – JSON → Blog Post (MDX)

```
System:
You are TechWriterGPT. 
Write a blog post that follows our MDX template.

User:
Template:
"""{{blog_template.mdx}}"""

Data:
{{JSON_output_from_stage_A}}

Rules:
- 400–700 words.
- At least **two** code fences (≥ 5 lines each) taken from the diff.
- Include an **Overview**, **Key Changes**, **Trade‑offs**, **Next Steps** section.
- Use active voice, 2nd person (“you”), avoid passive.

Return only valid MDX.
```

---

## 2 · MDX Template (`blog_template.mdx`)

```mdx
---
title: "{title}"
date: "{date}"
tags: [release]
---

## Overview
{overview}

## Key Changes
{#foreach key_changes as c}
### {c.file}
{c.change}
{#/foreach}

```diff
{code_example}
```

## Trade‑offs
{trade_offs}

## Next Steps
{next_steps}
```

---

## 3 · TypeScript Flow Example

```ts
import { openai } from "@/lib/openai";
import { getLargestHunk } from "./diff-utils";
import template from "./blog_template.mdx?raw";

export async function generatePost(diff: string) {
  // Stage A
  const { choices: [{ message: { content: jsonStr } }] } = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are DiffSummarizer v2…" },
      { role: "user", content: diff }
    ]
  });
  const data = JSON.parse(jsonStr);

  // insert code example
  data.code_example = getLargestHunk(diff);

  // Stage B
  const prompt = `
Template:
"""${template}"""

Data:
${JSON.stringify(data, null, 2)}
  `;
  const mdx = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are TechWriterGPT. Follow the template." },
      { role: "user", content: prompt }
    ]
  });
  return mdx.choices[0].message.content;
}
```

---

## 4 · Lint & Formatting

### 4.1 remark‑lint config (`.remarkrc.json`)

```json
{
  "plugins": [
    ["remark-preset-lint-recommended"],
    ["remark-lint-heading-increment"],
    ["remark-lint-no-dead-urls", false],
    ["remark-lint-maximum-heading-length", [3, 60]],
    ["remark-lint-no-empty-url", true]
  ]
}
```

### 4.2 Vale Style (`.vale/styles/CodeCraft/Style.yml`)

```yaml
extends: existence
message: "Avoid passive voice."
level: warning
scope: doc
ignorecase: true
tokens:
  - '\\b(is|was|were|be|been|being) \\w+ed\\b'
```

Add to `vale.ini`:

```ini
StylesPath = .vale/styles
Min Alert Level = suggestion

[*]
BasedOnStyles = CodeCraft
```

### 4.3 Pre‑commit Hook

```bash
#!/bin/sh
npm run lint:md         # remark-lint
vale --minAlertLevel=warning **/*.mdx
```

---

## 5 · Cost Controls

* Skip Stage A/B if `diffLineCount < 20`; write a changelog bullet instead.
* Use `gpt-3.5-turbo` in dev, `gpt-4o` only on `main` branch merges.

---

⚔️ **Drop these files into `/scripts/codecraft/` and wire the `generatePost()` in your CI.**  
Your auto‑posts will be deeper, consistently formatted, and lint‑clean. Skål!
