# HorizenBoat — Overview

**Canon locks for fan fiction, and for the agents that write it.**

HorizenBoat is a small, static platform for people who write derivative fiction — and for the LLM agents who help them. It packages a work's canon as machine-readable constraints: the rules that cannot bend, what each character is allowed to know at a given point in the timeline, and the lines they must never cross.

## Two halves, one dataset

**The site** is a dark-by-default reading and retrieval tool. Search across works, characters, tags and story hooks in real time. Switch the timeline and watch the knowledge boundaries, power ceiling and spoiler blacklist change underneath. Read `character seals` — drive, speech pattern, address matrix, dialogue anchors, forbidden behaviours — then compose a clean system prompt from the current timeline and the characters you selected, ready to paste into any model.

**The MCP server** is `horizenboat-mcp`, a single-file Python server (FastMCP + httpx, in-process TTL cache) that lets agents enforce the same canon:

| Tool | What it does |
| --- | --- |
| `search_horizenboat` | Find a work, character, tag or hook |
| `lock_canon_context` | Pull laws, timeline boundaries and character seals, ending in a numbered Guardrail Directive the agent must treat as state |
| `audit_plot_ooc` | Cross-check a plot outline against the blacklist, world laws and OOC taboos; return BLOCK / REVISE / PASS with evidence and one concrete fix per finding |
| `spark_world_divergence` | Force brainstorming through a three-stage butterfly-effect frame: rule collision → faction pushback → ecosystem mutation |

Plus two prompts (`hb-fanfic` lands the agent before it writes; `hb-brainstorm` drives the divergence loop) and MCP resources for the raw JSON.

## Why the API is static

There is no database, no backend and no auth. `/api/v1/index.json` plus one JSON file per work `is` the API — the site reads it, the MCP server reads it, and anything else can too. That keeps hosting free, makes the data forkable, and means a setting change is a pull request rather than a migration.

## What ships

Two complete, deliberately different datasets:

- **Lord of the Mysteries** (fan work) — three timelines from 1349 to 1368, four character seals, and the canon constraints that make the setting hard to fake: indestructible and conserved Beyonder characteristics, acting as the only way to digest a potion, and rank difference as literal contamination.
- **Carbon Tribulation** (original) — cyber-cultivation: qi is compute, tribulation is consensus validation, ascension is an upload. Built as a sandbox others can freely diverge from.

Together: 8 characters, 6 timelines, 12 world laws and 6 divergence hooks.

## What it deliberately does not do

The audit is keyword-driven, not semantic. It catches explicitly written canon violations — the character who knows a fact too early, the power that arrives with no cost, the line that breaks a speech pattern — and misses the ones phrased around the triggers. It is a gate before the first paragraph, not a final judge. That limit is documented rather than hidden.

## Stack

- **Site**: Vite 7 + React 19 + Tailwind CSS v4, static export, hash routing, no rewrites required
- **Server**: Python 3.10+, single file, two dependencies, works against HTTP or a local directory
- **License**: MIT for code, CC BY-NC-SA 4.0 for setting summaries; fan-work content credited to its original author

---

## Short versions

**One line (GitHub About):**
> Canon-locked setting library and MCP server for fan fiction: timeline-scoped knowledge, character seals, and a pre-writing canon audit for LLM agents.

**One paragraph:**
> HorizenBoat keeps AI-written fan fiction inside the canon. Each work ships as a static JSON package containing world laws that cannot bend, timeline-scoped knowledge boundaries and spoiler blacklists, character seals with speech patterns and forbidden behaviours, and divergence hooks for brainstorming. A static site turns that into search, timeline switching and one-click system prompts; a single-file MCP server lets agents lock the same canon, audit an outline before writing, and force brainstorming through a rule-driven three-stage framework.
