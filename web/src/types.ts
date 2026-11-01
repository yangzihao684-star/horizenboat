export type Severity = "block" | "warn";
export type QuoteType = "canon" | "style";
export type WorkType = "fanfic" | "original";

export interface WorkLaw {
  id: string;
  title: string;
  law: string;
  enforcement: string;
  keywords: string[];
  severity: Severity;
}

export interface RequiredTerm {
  term: string;
  note: string;
}

export interface StyleGuide {
  voice: string;
  pacing: string;
  banned_words: string[];
  required_terms: RequiredTerm[];
  vocabulary_notes: string[];
}

export interface ForbiddenEvent {
  id: string;
  label: string;
  because: string;
  keywords: string[];
  severity: Severity;
}

export interface Timeline {
  id: string;
  label: string;
  range: string;
  order: number;
  status_quo: string;
  power_ceiling: string;
  power_ceiling_triggers: string[];
  knowledge_boundaries: string[];
  forbidden_events: ForbiddenEvent[];
  note?: string;
}

export interface AddressingRow {
  target: string;
  form: string;
  note?: string;
}

export interface DialogueSample {
  text: string;
  type: QuoteType;
  note?: string;
}

export interface OocTaboo {
  rule: string;
  triggers: string[];
  severity: Severity;
}

export interface Character {
  id: string;
  name: string;
  name_en?: string;
  aliases: string[];
  role: string;
  pathway: string;
  tags: string[];
  drive: string;
  personality_core: string[];
  speech_pattern: string;
  addressing_matrix: AddressingRow[];
  dialogue_samples: DialogueSample[];
  ooc_taboos: OocTaboo[];
}

export interface Hook {
  hook_id: string;
  title: string;
  premise: string;
  ripple_questions: string[];
}

export interface Integration {
  recommended_timeline: string;
  recommended_characters: string[];
  sample_audit_plot: string;
}

export interface Work {
  schema_version: string;
  work_id: string;
  title: string;
  title_en: string;
  type: WorkType;
  type_label: string;
  category: string;
  author: string;
  tagline: string;
  summary: string;
  tags: string[];
  difficulty: "low" | "medium" | "high";
  spoiler_warning: boolean;
  updated_at: string;
  rights_note: string;
  world_laws: WorkLaw[];
  style_guide: StyleGuide;
  timelines: Record<string, Timeline>;
  characters: Record<string, Character>;
  brainstorm_hooks: Hook[];
  integration?: Integration;
}

export interface CharacterBrief {
  id: string;
  name: string;
  name_en?: string;
  aliases?: string[];
  role: string;
  pathway: string;
}

export interface TimelineBrief {
  id: string;
  label: string;
  range: string;
}

export interface IndexWork {
  id: string;
  title: string;
  title_en: string;
  type: WorkType;
  type_label: string;
  category: string;
  author: string;
  tags: string[];
  summary: string;
  characters_list: CharacterBrief[];
  timelines_list: TimelineBrief[];
  hooks_list: { hook_id: string; title: string }[];
  search_terms: string[];
  stats: { characters: number; timelines: number; hooks: number; laws: number };
  difficulty: "low" | "medium" | "high";
  spoiler_warning: boolean;
  updated_at: string;
}

export interface WorkIndex {
  schema_version: string;
  generated_at: string;
  base: string;
  counts: { works: number; characters: number; timelines: number; hooks: number };
  tags: { tag: string; count: number }[];
  works: IndexWork[];
}
