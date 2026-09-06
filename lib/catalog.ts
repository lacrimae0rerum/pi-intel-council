import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Personality {
  id: string;
  name: string;
  family: "A" | "B" | "C" | "D";
  polarity: string;
  recommended_model: string;
  sat_layer: string;
  can_be_chairman: boolean;
  requires_anti_recursion: boolean;
  description: string;
  prompt: string;
}

const fields = ["id", "name", "family", "polarity", "recommended_model", "sat_layer",
  "can_be_chairman", "requires_anti_recursion", "description"];

export function parsePersonality(directory: string, agent: string, skill: string, knowledge: string): Personality {
  const match = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]+)$/.exec(agent);
  if (!match || !skill.trim() || !knowledge.trim()) throw new Error(`Invalid personality resources: ${directory}`);
  const data: Record<string, string | boolean> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([a-z_]+): (.+)$/.exec(line);
    if (!entry || !fields.includes(entry[1]) || Object.hasOwn(data, entry[1])) {
      throw new Error(`Invalid frontmatter: ${directory}`);
    }
    const [, key, raw] = entry;
    if (key === "can_be_chairman" || key === "requires_anti_recursion") {
      if (raw !== "true" && raw !== "false") throw new Error(`Invalid boolean: ${directory}/${key}`);
      data[key] = raw === "true";
    } else {
      const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
      if (typeof value !== "string" || !value.trim() || /^[\[\]{>&*!]/.test(value)) {
        throw new Error(`Invalid scalar: ${directory}/${key}`);
      }
      data[key] = value;
    }
  }
  if (fields.some((key) => !Object.hasOwn(data, key)) || data.id !== directory ||
      !/^[a-z][a-z-]+$/.test(directory) || !/^[ABCD]$/.test(String(data.family)) ||
      !/^[^\s/]+\/\S+$/.test(String(data.recommended_model)) ||
      data.can_be_chairman !== (directory === "mclaughlin") ||
      (data.family === "D") !== (directory === "mclaughlin")) {
    throw new Error(`Invalid personality metadata: ${directory}`);
  }
  return { ...data, prompt: [match[2].trim(), skill.trim(), knowledge.trim()].join("\n\n") } as unknown as Personality;
}

export function loadCatalog(root = fileURLToPath(new URL("../personalities/", import.meta.url))): Map<string, Personality> {
  const catalog = new Map<string, Personality>();
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) throw new Error(`Unexpected personality entry: ${entry.name}`);
    const resources = ["agent.md", "skill.md", "knowledge.md"].map((file) => readFileSync(join(root, entry.name, file), "utf8"));
    catalog.set(entry.name, parsePersonality(entry.name, resources[0], resources[1], resources[2]));
  }
  const count = (family: string) => [...catalog.values()].filter((p) => p.family === family).length;
  if (catalog.size !== 17 || count("A") !== 7 || count("B") !== 5 || count("C") !== 4 || count("D") !== 1) {
    throw new Error("Personality catalog must contain 17 resources in families 7/5/4/1");
  }
  return catalog;
}
