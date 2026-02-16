#!/usr/bin/env npx tsx --env-file=.env.local
/**
 * Pause Content Pipeline MCP Server
 *
 * Exposes pipeline stages as tools for interactive Claude Code use.
 *
 * Configure in Claude Code settings:
 * {
 *   "mcpServers": {
 *     "pause-pipeline": {
 *       "command": "npx",
 *       "args": ["tsx", "--env-file=.env.local", "mcp-server/index.ts"],
 *       "cwd": "/Users/daniellethompson/projects/pause-api"
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { research } from "../scripts/pipeline/stages/01-researcher";
import { write } from "../scripts/pipeline/stages/02-writer";
import { generateAudio } from "../scripts/pipeline/stages/03-audio-gen";
import { produce } from "../scripts/pipeline/stages/04-producer";
import { publish } from "../scripts/pipeline/stages/05-publisher";
import {
  getContentItem,
  getContentItems,
  getPipelineStatus,
  getPipelineSummary,
} from "../scripts/pipeline/lib/db";

const server = new Server(
  { name: "pause-pipeline", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool Definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pipeline_research",
      description: "Run the research stage for a content item. Searches PubMed and synthesizes findings with Claude.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_write",
      description: "Run the writer stage for a content item. Generates scripts, articles, or guides using Claude.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_audio",
      description: "Run the audio generation stage. Uses ElevenLabs for lessons/podcasts/affirmations, Wondercraft for meditations.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_produce",
      description: "Run post-production: normalize audio, add intro/outro, mix ambient music. Requires ffmpeg.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_publish",
      description: "Upload to R2 and update CMS. Sets status to 'ready' by default.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
          autoPublish: { type: "boolean", description: "Set to true to publish immediately instead of 'ready'" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_run",
      description: "Run the full pipeline (all 5 stages) for a content item.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
          autoPublish: { type: "boolean", description: "Auto-publish after processing" },
        },
        required: ["contentId"],
      },
    },
    {
      name: "pipeline_status",
      description: "Get pipeline status. If contentId provided, shows that item's stages. Otherwise shows overall dashboard.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Optional: specific content item ID" },
        },
      },
    },
    {
      name: "pipeline_list",
      description: "List content items with optional filters.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: { type: "string", description: "Filter by content type: podcast, lesson, meditation, affirmation, article, guide" },
          week: { type: "number", description: "Filter by program week (1-8)" },
          status: { type: "string", description: "Filter by status: draft, ready, published" },
        },
      },
    },
    {
      name: "pipeline_get_item",
      description: "Get detailed info about a single content item.",
      inputSchema: {
        type: "object" as const,
        properties: {
          contentId: { type: "number", description: "Content item ID" },
        },
        required: ["contentId"],
      },
    },
  ],
}));

// ── Tool Handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "pipeline_research": {
        const result = await research(args!.contentId as number);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }

      case "pipeline_write": {
        const result = await write(args!.contentId as number);
        return {
          content: [
            {
              type: "text" as const,
              text: `Written: "${result.title}" (${result.wordCount} words, ~${result.estimatedMinutes} min)\n\nPreview:\n${result.script.slice(0, 500)}...`,
            },
          ],
        };
      }

      case "pipeline_audio": {
        const result = await generateAudio(args!.contentId as number);
        return {
          content: [
            {
              type: "text" as const,
              text: `Audio generated: ${result.outputPath} (${(result.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)`,
            },
          ],
        };
      }

      case "pipeline_produce": {
        const outputPath = await produce(args!.contentId as number);
        return { content: [{ type: "text" as const, text: `Produced: ${outputPath}` }] };
      }

      case "pipeline_publish": {
        const result = await publish(args!.contentId as number, {
          autoPublish: args?.autoPublish as boolean,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }

      case "pipeline_run": {
        const contentId = args!.contentId as number;
        const item = await getContentItem(contentId);
        if (!item) return { content: [{ type: "text" as const, text: `Item ${contentId} not found` }] };

        const results: string[] = [`Running full pipeline for "${item.title}"...\n`];

        // Research
        if (item.contentType !== "affirmation") {
          await research(contentId);
          results.push("  Research: done");
        }

        // Write
        const written = await write(contentId);
        results.push(`  Write: done (${written.wordCount} words)`);

        // Audio
        if (item.format === "audio") {
          const audio = await generateAudio(contentId);
          results.push(`  Audio: done (${(audio.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)`);

          const produced = await produce(contentId);
          results.push(`  Produce: done`);
        }

        // Publish
        const published = await publish(contentId, { autoPublish: args?.autoPublish as boolean });
        results.push(`  Publish: done (status: ${published.status})`);

        return { content: [{ type: "text" as const, text: results.join("\n") }] };
      }

      case "pipeline_status": {
        const contentId = args?.contentId as number | undefined;

        if (contentId) {
          const item = await getContentItem(contentId);
          const stages = await getPipelineStatus(contentId);

          if (!item) return { content: [{ type: "text" as const, text: `Item ${contentId} not found` }] };

          let text = `"${item.title}" (${item.contentType})\nStatus: ${item.status}\n`;
          text += `Audio: ${item.audioUrl || "none"}\n`;
          text += `Body: ${item.bodyMarkdown ? `${item.bodyMarkdown.length} chars` : "none"}\n\n`;

          if (stages.length > 0) {
            text += "Stage         | Status        | Tool\n";
            text += "--------------|---------------|-----\n";
            for (const s of stages) {
              text += `${s.stage.padEnd(14)}| ${s.status.padEnd(14)}| ${s.tool || "-"}\n`;
            }
          } else {
            text += "No pipeline stages run yet.";
          }

          return { content: [{ type: "text" as const, text }] };
        }

        // Overall summary
        const summary = await getPipelineSummary();
        const items = await getContentItems();

        let text = `Content Pipeline Dashboard\n`;
        text += `Total items: ${items.length}\n\n`;

        const byStatus = items.reduce((acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        text += Object.entries(byStatus).map(([s, c]) => `  ${s}: ${c}`).join("\n");

        if (summary.length > 0) {
          text += "\n\nPipeline Stages:\n";
          const stageOrder = ["research", "writing", "audio", "production", "publishing"];
          for (const stage of stageOrder) {
            const rows = summary.filter((r) => r.stage === stage);
            const counts = rows.map((r) => `${r.status}:${r.count}`).join(", ");
            if (counts) text += `  ${stage}: ${counts}\n`;
          }
        }

        return { content: [{ type: "text" as const, text }] };
      }

      case "pipeline_list": {
        const items = await getContentItems({
          type: args?.type as string | undefined,
          week: args?.week as number | undefined,
          status: args?.status as string | undefined,
        } as any);

        let text = `${items.length} items:\n\n`;
        text += "ID  | Type        | Week | Status    | Title\n";
        text += "----|-------------|------|-----------|------\n";
        for (const item of items) {
          const week = item.programWeek ? String(item.programWeek) : "-";
          text += `${String(item.id).padEnd(4)}| ${item.contentType.padEnd(12)}| ${week.padEnd(5)}| ${item.status.padEnd(10)}| ${item.title}\n`;
        }

        return { content: [{ type: "text" as const, text }] };
      }

      case "pipeline_get_item": {
        const item = await getContentItem(args!.contentId as number);
        if (!item) return { content: [{ type: "text" as const, text: "Not found" }] };
        return { content: [{ type: "text" as const, text: JSON.stringify(item, null, 2) }] };
      }

      default:
        return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }] };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pause Pipeline MCP Server running on stdio");
}

main().catch(console.error);
