import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  handleSearchLeads, handleGetLead, handleGetStats,
  handleGetActivityLog, handleGetSequences, handleGetCampaigns,
  handleGetClients, handleImportLeads, handleGetMessages,
} from "./handlers.js";

const TOOLS = [
  {
    name: "search_leads",
    description: "Search and filter leads by keyword, industry, score, source, seniority, job function, company size, country, email status, and date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search across name, title, company, industry, location, email" },
        industries: { type: "array", items: { type: "string" }, description: "Filter by industry (e.g., 'Computer Software', 'Internet')" },
        minScore: { type: "number", minimum: 0, maximum: 100, description: "Minimum lead score (0-100)" },
        sources: { type: "array", items: { type: "string", enum: ["linkedin", "gmaps", "amazon"] }, description: "Filter by data source" },
        seniority: { type: "array", items: { type: "string", enum: ["Owner / Founder", "C-Suite", "VP", "Director", "Manager", "Senior / Head"] }, description: "Filter by seniority level" },
        jobFunction: { type: "array", items: { type: "string", enum: ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "HR / People", "Business Dev"] }, description: "Filter by job function" },
        companySizes: { type: "array", items: { type: "string" }, description: "Filter by company size (e.g., '11-50', '51-200')" },
        countries: { type: "array", items: { type: "string" }, description: "Filter by country (e.g., 'United States')" },
        emailStatus: { type: "array", items: { type: "string", enum: ["verified", "risky", "not_found"] }, description: "Filter by email verification status" },
        dateFrom: { type: "string", format: "date", description: "Earliest save date (ISO YYYY-MM-DD)" },
        dateTo: { type: "string", format: "date", description: "Latest save date (ISO YYYY-MM-DD)" },
        limit: { type: "number", default: 50, minimum: 1, maximum: 200, description: "Max results to return" },
      },
    },
  },
  {
    name: "get_lead",
    description: "Get a single lead by ID with full details and associated messages",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Lead ID" } },
      required: ["id"],
    },
  },
  {
    name: "get_stats",
    description: "Get lead statistics — totals, email verification rate, average score, top industry, source breakdown",
    inputSchema: {
      type: "object" as const,
      properties: { filterBySource: { type: "string", enum: ["linkedin", "gmaps", "amazon"], description: "Optional: limit stats to one source" } },
    },
  },
  {
    name: "get_activity_log",
    description: "Get recent activity log entries — lead additions, messages sent, pipeline moves, etc.",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "number", default: 20, minimum: 1, maximum: 100, description: "Number of entries to return" } },
    },
  },
  {
    name: "get_sequences",
    description: "List all outreach sequences with step counts and assigned leads",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_campaigns",
    description: "List all campaigns with status, target industry, and lead counts",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_clients",
    description: "List all clients with retainer amounts, industry, and status",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "import_leads",
    description: "Import leads from past Apify scraper runs into the database. Call with no arguments to import ALL past runs, or provide a runId for a specific run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        runId: { type: "string", description: "Optional: specific Apify run ID to import from. If omitted, imports from all past successful runs." },
      },
    },
  },
  {
    name: "get_messages",
    description: "Get AI-generated outreach messages, optionally filtered by lead ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        leadId: { type: "string", description: "Optional: filter messages by lead ID" },
        limit: { type: "number", default: 50, minimum: 1, maximum: 200, description: "Max messages to return" },
      },
    },
  },
];

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  search_leads:     handleSearchLeads,
  get_lead:         handleGetLead,
  get_stats:        handleGetStats,
  get_activity_log: handleGetActivityLog,
  get_sequences:    handleGetSequences,
  get_campaigns:    handleGetCampaigns,
  get_clients:      handleGetClients,
  import_leads:     handleImportLeads,
  get_messages:     handleGetMessages,
};

export function registerTools(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
    }
    try {
      return await handler(args ?? {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  });
}
