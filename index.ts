import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { loadCatalog } from "./lib/catalog.ts";
import { CouncilError, renderMarkdown, runCouncil, type Receipt } from "./lib/council.ts";

const modelChoice = Type.Object({ provider: Type.Optional(Type.String({ minLength: 1 })), model: Type.Optional(Type.String({ minLength: 1 })) }, { additionalProperties: false });
const HELP = "Council of Intel 0.2.0: /council sats <question> or /council council <question>. At most one deliberation per user message within this process; 3–7 SATs or 3–9 Council seats. Uses configured/scoped Pi models; may incur multiple paid calls. Empty scope requires UI confirmation or blocks headless; configure --models or /scoped-models. Esc cancels; Pi sessions preserve the receipt and /export includes full Markdown evidence.";
const EMPTY_SCOPE = "Pi did not expose a resolved model scope. Configure --models or /scoped-models.";
const result = (receipt: Receipt) => ({ content: [{ type: "text" as const, text: renderMarkdown(receipt) }], details: receipt, usage: receipt.usage, terminate: true as const });

const consumedRequestsKey = Symbol.for("council-of-intel.consumed-requests");
function requestKey(ctx: ExtensionContext): string | undefined {
  const request = [...ctx.sessionManager.getBranch()].reverse().find((entry) => entry.type === "message" && entry.message.role === "user");
  return request ? JSON.stringify([ctx.sessionManager.getSessionId(), request.id]) : undefined;
}

export default function councilOfIntel(pi: ExtensionAPI): void {
  const catalog = loadCatalog();
  // ponytail: one key per attempted request until process exit; bounded retention needs a replay policy.
  const registry = globalThis as typeof globalThis & { [consumedRequestsKey]?: Set<string> };
  const consumedRequests = registry[consumedRequestsKey] ??= new Set<string>();
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "council_of_intel") return;
    const request = requestKey(ctx);
    if (!request) return { block: true, reason: "Council requires a user message before deliberation.", terminate: true };
    if (consumedRequests.has(request)) return { block: true, reason: "Council already consumed this user request. Send a new user message to deliberate again.", terminate: true };
    consumedRequests.add(request);
    if (!ctx.scopedModels.length && !ctx.hasUI) return { block: true, reason: EMPTY_SCOPE, terminate: true };
  });
  // Pi emits this even when schema validation fails before tool_call.
  pi.on("tool_execution_end", (event, ctx) => {
    if (event.toolName !== "council_of_intel") return;
    const request = requestKey(ctx);
    if (request) consumedRequests.add(request);
  });
  // Returned operational failures keep termination and usage; Pi marks them errors via this hook.
  pi.on("tool_result", (event) => {
    if (event.toolName === "council_of_intel" &&
        (event.details as Receipt | undefined)?.status === "failed") return { isError: true };
  });
  pi.registerTool({
    name: "council_of_intel",
    label: "Council of Intel",
    description: "Run one bounded intelligence deliberation ONLY after an explicit user request. Sends query and evidence to multiple configured Pi models and may incur paid calls. Returns a complete final Markdown report or terminal failure/cancellation receipt. Never call automatically or retry without a new user request.",
    promptGuidelines: ["Use council_of_intel only when the user explicitly requests a Council of Intel deliberation. Call exactly once, as the only tool call in its batch, then stop; never retry failures or start a follow-up deliberation automatically."],
    executionMode: "sequential",
    parameters: Type.Object({
      mode: Type.Optional(StringEnum(["sats", "council"] as const)),
      query: Type.String({ minLength: 1 }),
      seats: Type.Optional(Type.Array(Type.Object({ personality: Type.String({ minLength: 1 }),
        provider: Type.Optional(Type.String({ minLength: 1 })), model: Type.Optional(Type.String({ minLength: 1 })) }, { additionalProperties: false }), { minItems: 3, maxItems: 9 })),
      chairman: Type.Optional(modelChoice), counterfactual: Type.Optional(modelChoice),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!ctx.scopedModels.length) {
        if (!ctx.hasUI || !await ctx.ui.confirm("Council model scope", `${EMPTY_SCOPE} Continuing would use all configured available Pi models as candidates. Allow this deliberation?`, { signal })) {
          return { content: [{ type: "text", text: `Council cancelled before model selection. ${EMPTY_SCOPE}` }],
            details: { status: "cancelled" }, terminate: true,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        }
      }
      try {
        return result(await runCouncil(params, ctx, catalog, signal, (receipt) => onUpdate?.({
          content: [{ type: "text", text: [`Council Round ${receipt.phase}: ${receipt.status}; ${receipt.round1.length} analyses, ${receipt.round2.length} evaluations, ${receipt.failures.length} failures.`, ...receipt.warnings].join("\n") }],
          details: receipt,
        })));
      } catch (error) {
        if (error instanceof CouncilError && error.receipt) return result(error.receipt);
        throw error;
      }
    },
  });
  pi.registerCommand("council-help", {
    description: "Show Council of Intel usage without invoking a model",
    handler: async (_args, ctx) => { if (ctx.hasUI) ctx.ui.notify(HELP, "info"); else console.log(HELP); },
  });
}
