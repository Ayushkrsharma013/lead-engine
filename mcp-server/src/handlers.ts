import {
  fetchLeadsFromDB, searchLeadsInDB, computeStatsFromLeads,
  getMessages, getSequences, getCampaigns, getClients, getActivityLog,
} from "./db.js";
import { importFromAllApifyRuns, importFromSingleApifyRun } from "./import-leads.js";
import { sortLeads } from "./filters.js";
import type { FilterState, SortState } from "./types.js";

type Content = Array<{ type: "text"; text: string }>;
type ToolResult = { content: Content; isError?: boolean };

function fmtLeadRow(l: { name: string; title: string; company: string; score: number; emailStatus: string; source: string; email: string; industry: string; id: string }): string {
  return `| ${l.name} | ${l.title} | ${l.company} | ${l.score} | ${l.emailStatus} | ${l.source} |`;
}

// ─── search_leads ──────────────────────────────────────────────────────────────

export async function handleSearchLeads(args: Record<string, unknown>): Promise<ToolResult> {
  const filters: FilterState = {
    keyword: typeof args.keyword === "string" ? args.keyword : "",
    seniority: Array.isArray(args.seniority) ? args.seniority.map(String) : [],
    jobFunction: Array.isArray(args.jobFunction) ? args.jobFunction.map(String) : [],
    industries: Array.isArray(args.industries) ? args.industries.map(String) : [],
    companySizes: Array.isArray(args.companySizes) ? args.companySizes.map(String) : [],
    countries: Array.isArray(args.countries) ? args.countries.map(String) : [],
    emailStatus: Array.isArray(args.emailStatus) ? args.emailStatus.map(String) : [],
    minScore: typeof args.minScore === "number" ? args.minScore : 0,
    sources: Array.isArray(args.sources) ? args.sources.map(String) : [],
    dateFrom: typeof args.dateFrom === "string" ? args.dateFrom : "",
    dateTo: typeof args.dateTo === "string" ? args.dateTo : "",
  };

  const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 200) : 50;

  const results = await searchLeadsInDB(filters);

  const sort: SortState = { field: "score", dir: "desc" };
  const sorted = sortLeads(results, sort).slice(0, limit);

  if (sorted.length === 0) {
    return { content: [{ type: "text", text: "No leads found matching those filters." }] };
  }

  const rows = sorted.map(l => fmtLeadRow(l));
  const lines = [
    `Found ${results.length} leads${results.length > limit ? ` (showing top ${limit} by score)` : ""}.`,
    "",
    "| Name | Title | Company | Score | Email | Source |",
    "|------|-------|---------|-------|-------|--------|",
    ...rows,
    "",
    ...sorted.slice(0, 5).map((l, i) =>
      `${i + 1}. **${l.name}** — ${l.title} at ${l.company} — Score: ${l.score} — ${l.email || "no email"} — [LinkedIn](${l.linkedin})`
    ),
  ];

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_lead ──────────────────────────────────────────────────────────────────

export async function handleGetLead(args: Record<string, unknown>): Promise<ToolResult> {
  const id = String(args.id ?? "");
  if (!id) return { content: [{ type: "text", text: "Error: id is required" }] };

  const leads = await fetchLeadsFromDB();
  const lead = leads.find(l => l.id === id);

  if (!lead) return { content: [{ type: "text", text: `Lead not found: ${id}` }] };

  const msgs = await getMessages(id);

  const lines = [
    `## ${lead.name}`,
    `- **ID**: ${lead.id}`,
    `- **Title**: ${lead.title}`,
    `- **Company**: ${lead.company}`,
    `- **Industry**: ${lead.industry}`,
    `- **Location**: ${lead.location}`,
    `- **Email**: ${lead.email} (${lead.emailStatus})`,
    `- **LinkedIn**: ${lead.linkedin || "—"}`,
    `- **Website**: ${lead.website || "—"}`,
    `- **Company Size**: ${lead.companySize || "—"}`,
    `- **Score**: ${lead.score}/100`,
    `- **Source**: ${lead.source}`,
    `- **Kanban Column**: ${lead.kanbanColumn || "New"}`,
    `- **Status**: ${lead.status || "—"}`,
    `- **Last Touched**: ${lead.lastTouched || "—"}`,
    lead.notes ? `- **Notes**: ${lead.notes}` : "",
  ].filter(Boolean);

  if (msgs.length > 0) {
    lines.push("", `### Messages (${msgs.length})`);
    for (const m of msgs.slice(0, 10)) {
      lines.push(`- [${m.createdAt?.slice(0, 10) || "?"}] ${m.messageType} — "${m.subject}"`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_stats ─────────────────────────────────────────────────────────────────

export async function handleGetStats(args: Record<string, unknown>): Promise<ToolResult> {
  const source = typeof args.filterBySource === "string" ? args.filterBySource : null;

  const allLeads = await fetchLeadsFromDB();
  const leads = source ? allLeads.filter(l => l.source === source) : allLeads;

  const stats = await computeStatsFromLeads(leads);
  const verifiedPct = stats.total > 0 ? ((stats.withEmail / stats.total) * 100).toFixed(1) : "0.0";

  const lines = [
    `## Lead Statistics${source ? ` (${source})` : ""}`,
    `- **Total leads**: ${stats.total.toLocaleString()}`,
    `- **Verified emails**: ${stats.withEmail.toLocaleString()} (${verifiedPct}%)`,
    `- **Average score**: ${stats.avgScore}`,
    `- **Top industry**: ${stats.topIndustry} (${leads.filter(l => l.industry === stats.topIndustry).length} leads)`,
  ];

  // Source breakdown
  if (!source) {
    const bySource = { linkedin: 0, gmaps: 0, amazon: 0 };
    for (const l of allLeads) {
      if (l.source in bySource) bySource[l.source as keyof typeof bySource]++;
    }
    lines.push("", "### By Source", ...Object.entries(bySource).map(([k, v]) => `- ${k}: ${v}`));
  }

  // Email status breakdown
  const byStatus: Record<string, number> = {};
  for (const l of leads) {
    byStatus[l.emailStatus] = (byStatus[l.emailStatus] || 0) + 1;
  }
  lines.push("", "### Email Status", ...Object.entries(byStatus).map(([k, v]) => `- ${k}: ${v}`));

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_activity_log ──────────────────────────────────────────────────────────

export async function handleGetActivityLog(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 100) : 20;
  const entries = await getActivityLog(limit);

  if (entries.length === 0) {
    return { content: [{ type: "text", text: "No activity recorded yet." }] };
  }

  const lines = [`## Recent Activity (${entries.length})`, ""];
  for (const e of entries) {
    const ts = e.createdAt ? new Date(e.createdAt).toLocaleString() : "?";
    lines.push(`- **[${ts}]** ${e.type}: ${e.text}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_sequences ─────────────────────────────────────────────────────────────

export async function handleGetSequences(_args: Record<string, unknown>): Promise<ToolResult> {
  const sequences = await getSequences();

  if (sequences.length === 0) {
    return { content: [{ type: "text", text: "No sequences found." }] };
  }

  const lines = [`## Sequences (${sequences.length})`, ""];
  for (const s of sequences) {
    const steps = s.steps || [];
    const activeSteps = steps.filter(st => st.active).length;
    lines.push(`- **${s.name}** — ${steps.length} steps (${activeSteps} active), ${s.assignedLeadIds.length} leads assigned`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_campaigns ─────────────────────────────────────────────────────────────

export async function handleGetCampaigns(_args: Record<string, unknown>): Promise<ToolResult> {
  const campaigns = await getCampaigns();

  if (campaigns.length === 0) {
    return { content: [{ type: "text", text: "No campaigns found." }] };
  }

  const lines = [`## Campaigns (${campaigns.length})`, ""];
  for (const c of campaigns) {
    lines.push(`- **${c.name}** — ${c.status} — ${c.targetIndustry} — ${c.leadIds.length} leads`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── get_clients ───────────────────────────────────────────────────────────────

export async function handleGetClients(_args: Record<string, unknown>): Promise<ToolResult> {
  const clients = await getClients();

  if (clients.length === 0) {
    return { content: [{ type: "text", text: "No clients found." }] };
  }

  const lines = [`## Clients (${clients.length})`, ""];
  const totalMRR = clients.reduce((sum, c) => sum + c.monthlyRetainer, 0);
  for (const c of clients) {
    lines.push(`- **${c.name}** (${c.company}) — ${c.industry} — $${c.monthlyRetainer.toLocaleString()}/mo — ${c.status}`);
  }
  lines.push("", `**Total MRR**: $${totalMRR.toLocaleString()}/mo`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── import_leads ──────────────────────────────────────────────────────────────

export async function handleImportLeads(args: Record<string, unknown>): Promise<ToolResult> {
  const runId = typeof args.runId === "string" ? args.runId : "";

  try {
    if (runId) {
      const result = await importFromSingleApifyRun(runId);
      return { content: [{ type: "text", text: `Import complete from run \`${runId}\`.\n- Added: ${result.added}\n- Updated: ${result.updated}\n- Total: ${result.total}` }] };
    }

    const result = await importFromAllApifyRuns();
    const lines = [
      `## Import Results`,
      result.message,
      "",
      `| Run | Leads |`,
      `|-----|-------|`,
      ...(result.runs || []).map(r => `| \`${r.runId.slice(0, 12)}…\` | ${r.count} |`),
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return { content: [{ type: "text", text: `Import failed: ${msg}` }], isError: true };
  }
}

// ─── get_messages ──────────────────────────────────────────────────────────────

export async function handleGetMessages(args: Record<string, unknown>): Promise<ToolResult> {
  const leadId = typeof args.leadId === "string" ? args.leadId : undefined;
  const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 200) : 50;

  const messages = await getMessages(leadId);
  const sliced = messages.slice(0, limit);

  if (sliced.length === 0) {
    return { content: [{ type: "text", text: leadId ? `No messages for lead ${leadId}.` : "No messages found." }] };
  }

  const lines = [
    `## Messages (${sliced.length}${messages.length > limit ? ` of ${messages.length}` : ""})`,
    "",
  ];

  for (const m of sliced) {
    const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : "?";
    lines.push(`### ${m.subject}`);
    lines.push(`- **Type**: ${m.messageType} | **Tone**: ${m.tone} | **Date**: ${ts}`);
    lines.push(`- **Lead**: ${m.leadId}`);
    lines.push("", m.body.slice(0, 500), "");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}
