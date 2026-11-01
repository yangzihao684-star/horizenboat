#!/usr/bin/env node
/**
 * 静态 API 结构校验器。
 * 用法: npm run check:api
 *
 * 它保证 index.json 与 works/*.json 之间不会出现"索引说有、数据里没有"的漂移，
 * 也保证 MCP Server 依赖的关键词数组不为空——否则审查工具会静默失效。
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = join(ROOT, "public", "api", "v1");

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function need(condition, message) {
  if (!condition) fail(message);
  return condition;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function needString(scope, value, label) {
  need(isNonEmptyString(value), scope + " -> " + label + " 必须是非空字符串");
}

function needArray(scope, value, label, min = 1) {
  const ok = Array.isArray(value) && value.length >= min;
  need(ok, scope + " -> " + label + " 必须是数组且至少 " + min + " 项");
  return ok ? value : [];
}

async function readJson(relative) {
  const raw = await readFile(join(API, relative), "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(relative + " 不是合法 JSON: " + error.message);
    return null;
  }
}

const index = await readJson("index.json");
if (!index) {
  console.error(errors.join("\n"));
  process.exit(1);
}

needString("index.json", index.schema_version, "schema_version");
need(index.schema_version === "1.0", "index.json -> schema_version 必须是 1.0");
needArray("index.json", index.works, "works", 1);
needArray("index.json", index.tags, "tags", 1);

const ids = new Set();
for (const work of index.works) {
  const scope = "index.json/" + (work.id || "(missing id)");
  needString(scope, work.id, "id");
  need(!ids.has(work.id), scope + " -> id 重复");
  ids.add(work.id);
  needString(scope, work.title, "title");
  needString(scope, work.type, "type");
  need(work.type === "fanfic" || work.type === "original", scope + " -> type 必须是 fanfic 或 original");
  needString(scope, work.summary, "summary");
  needArray(scope, work.tags, "tags");
  needArray(scope, work.characters_list, "characters_list");
  needArray(scope, work.timelines_list, "timelines_list");
  needArray(scope, work.hooks_list, "hooks_list");
}

const workFiles = (await readdir(join(API, "works"))).filter((name) => name.endsWith(".json"));
need(workFiles.length === index.works.length, "works/ 下的文件数（" + workFiles.length + "）与索引条目数（" + index.works.length + "）不一致");

let characterCount = 0;
let timelineCount = 0;
let hookCount = 0;
let lawCount = 0;

for (const entry of index.works) {
  const file = "works/" + entry.id + ".json";
  const work = await readJson(file);
  if (!work) continue;
  const scope = file;

  needString(scope, work.work_id, "work_id");
  need(work.work_id === entry.id, scope + " -> work_id 与文件名不一致");
  needString(scope, work.title, "title");
  needString(scope, work.category, "category");
  needString(scope, work.summary, "summary");
  needArray(scope, work.tags, "tags");
  needArray(scope, work.world_laws, "world_laws", 3);

  for (const law of work.world_laws) {
    needString(scope, law.id, "world_laws[].id");
    needString(scope, law.title, "world_laws[].title");
    needString(scope, law.law, "world_laws[].law");
    needString(scope, law.enforcement, "world_laws[].enforcement");
    needArray(scope, law.keywords, "world_laws[].keywords");
    need(law.severity === "block" || law.severity === "warn", scope + " -> world_laws[].severity 必须是 block 或 warn");
    lawCount += 1;
  }

  needString(scope, work.style_guide?.voice, "style_guide.voice");
  needArray(scope, work.style_guide?.banned_words, "style_guide.banned_words");
  needArray(scope, work.style_guide?.required_terms, "style_guide.required_terms");

  const timelineIds = Object.keys(work.timelines ?? {});
  need(timelineIds.length >= 2, scope + " -> timelines 至少需要 2 条");
  for (const [key, timeline] of Object.entries(work.timelines ?? {})) {
    const tscope = scope + "/timelines." + key;
    needString(tscope, timeline.id, "id");
    need(timeline.id === key, tscope + " -> id 与键名不一致");
    needString(tscope, timeline.label, "label");
    needString(tscope, timeline.range, "range");
    need(typeof timeline.order === "number", tscope + " -> order 必须是数字");
    needString(tscope, timeline.status_quo, "status_quo");
    needString(tscope, timeline.power_ceiling, "power_ceiling");
    needArray(tscope, timeline.knowledge_boundaries, "knowledge_boundaries");
    needArray(tscope, timeline.forbidden_events, "forbidden_events");

    for (const event of timeline.forbidden_events) {
      needString(tscope, event.id, "forbidden_events[].id");
      needString(tscope, event.label, "forbidden_events[].label");
      needString(tscope, event.because, "forbidden_events[].because");
      needArray(tscope, event.keywords, "forbidden_events[].keywords");
    }
    timelineCount += 1;
  }

  const characterIds = Object.keys(work.characters ?? {});
  need(characterIds.length >= 2, scope + " -> characters 至少需要 2 位");
  for (const [key, character] of Object.entries(work.characters ?? {})) {
    const cscope = scope + "/characters." + key;
    needString(cscope, character.id, "id");
    need(character.id === key, cscope + " -> id 与键名不一致");
    needString(cscope, character.name, "name");
    needString(cscope, character.role, "role");
    needString(cscope, character.pathway, "pathway");
    needString(cscope, character.drive, "drive");
    needString(cscope, character.speech_pattern, "speech_pattern");
    needArray(cscope, character.personality_core, "personality_core");
    needArray(cscope, character.addressing_matrix, "addressing_matrix");
    const samples = needArray(cscope, character.dialogue_samples, "dialogue_samples", 3);
    if (samples.length > 5) warn(cscope + " -> dialogue_samples 建议 3-5 句，当前 " + samples.length);
    for (const sample of samples) {
      needString(cscope, sample.text, "dialogue_samples[].text");
      need(sample.type === "canon" || sample.type === "style", cscope + " -> dialogue_samples[].type 必须是 canon 或 style");
    }
    const taboos = needArray(cscope, character.ooc_taboos, "ooc_taboos");
    for (const taboo of taboos) {
      needString(cscope, taboo.rule, "ooc_taboos[].rule");
      needArray(cscope, taboo.triggers, "ooc_taboos[].triggers");
    }
    characterCount += 1;
  }

  const hooks = needArray(scope, work.brainstorm_hooks, "brainstorm_hooks");
  for (const hook of hooks) {
    needString(scope, hook.hook_id, "brainstorm_hooks[].hook_id");
    needString(scope, hook.title, "brainstorm_hooks[].title");
    needString(scope, hook.premise, "brainstorm_hooks[].premise");
    const questions = needArray(scope, hook.ripple_questions, "brainstorm_hooks[].ripple_questions", 3);
    need(questions.length === 3, scope + " -> " + hook.hook_id + " 的 ripple_questions 必须正好 3 个");
    hookCount += 1;
  }

  // 索引 <-> 数据包 一致性
  const indexCharIds = new Set(entry.characters_list.map((character) => character.id));
  for (const id of indexCharIds) {
    need(characterIds.includes(id), scope + " -> 索引里的角色 " + id + " 在数据包中不存在");
  }
  for (const id of characterIds) {
    need(indexCharIds.has(id), scope + " -> 数据包角色 " + id + " 没有进入索引 characters_list");
  }

  const indexTimelineIds = new Set(entry.timelines_list.map((timeline) => timeline.id));
  for (const id of timelineIds) {
    need(indexTimelineIds.has(id), scope + " -> 时间线 " + id + " 没有进入索引 timelines_list");
  }

  const indexHookIds = new Set(entry.hooks_list.map((hook) => hook.hook_id));
  for (const hook of hooks) {
    need(indexHookIds.has(hook.hook_id), scope + " -> 钩子 " + hook.hook_id + " 没有进入索引 hooks_list");
  }

  // 索引统计与实际数据对齐
  const stats = entry.stats ?? {};
  need(stats.characters === characterIds.length, scope + " -> stats.characters 与实际角色数不一致");
  need(stats.timelines === timelineIds.length, scope + " -> stats.timelines 与实际时间线数不一致");
  need(stats.hooks === hooks.length, scope + " -> stats.hooks 与实际钩子数不一致");
  need(stats.laws === work.world_laws.length, scope + " -> stats.laws 与实际铁律数不一致");
}

need(index.counts?.characters === characterCount, "index.json -> counts.characters 与实际（" + characterCount + "）不一致");
need(index.counts?.timelines === timelineCount, "index.json -> counts.timelines 与实际（" + timelineCount + "）不一致");
need(index.counts?.hooks === hookCount, "index.json -> counts.hooks 与实际（" + hookCount + "）不一致");
need(index.counts?.works === index.works.length, "index.json -> counts.works 与实际不一致");

const tagCounts = new Map();
for (const work of index.works) {
  for (const tag of work.tags) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
}
for (const tag of index.tags) {
  const actual = tagCounts.get(tag.tag) ?? 0;
  need(actual === tag.count, "index.json -> 标签 " + tag.tag + " 的 count（" + tag.count + "）与实际（" + actual + "）不一致");
}

console.log("HorizonBoat API check");
console.log("  works       " + index.works.length);
console.log("  characters  " + characterCount);
console.log("  timelines   " + timelineCount);
console.log("  laws        " + lawCount);
console.log("  hooks       " + hookCount);
console.log("  tags        " + index.tags.length);

if (warnings.length) {
  console.log("");
  console.log("warnings:");
  for (const message of warnings) console.log("  ! " + message);
}

if (errors.length) {
  console.log("");
  console.log("errors:");
  for (const message of errors) console.log("  x " + message);
  console.log("");
  console.log("FAILED with " + errors.length + " error(s)");
  process.exit(1);
}

console.log("");
console.log("OK · schema 1.0 valid");
