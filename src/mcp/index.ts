import { randomUUID } from "node:crypto";
import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { eventStore, preferenceStore, actionHistory } from "../server/api.js";
import { ApprovalService } from "../services/approval-service.js";
import type { VisitorCategory, Preferences } from "../services/types.js";

const router = Router();

const transports = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "doorbell-without-ears",
    version: "1.0.0"
  });

  const approval = new ApprovalService(
    eventStore,
    preferenceStore,
    actionHistory
  );

  server.registerTool(
    "get_visitor_events",
    {
      description: "Get recent simulated visitor events and their statuses.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        status: z.enum(["new", "proposed", "confirmed", "dismissed"]).optional()
      }
    },
    async ({ limit, status }) => {
      let events = eventStore.list(limit ?? 20);
      if (status) events = events.filter(event => event.status === status);

      return {
        content: [{ type: "text", text: JSON.stringify(events, null, 2) }]
      };
    }
  );

  server.registerTool(
    "get_preferences",
    {
      description: "Read the user's saved accessibility and visitor preferences.",
      inputSchema: {}
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify(preferenceStore.get(), null, 2)
      }]
    })
  );

  server.registerTool(
    "update_preference",
    {
      description: "Update one user-approved visitor or accessibility preference.",
      inputSchema: {
        key: z.enum([
          "deliveryInstruction",
          "unknownVisitorInstruction",
          "textSize",
          "highContrast",
          "flashAlerts",
          "retainTranscripts"
        ]),
        value: z.union([z.string(), z.boolean()])
      }
    },
    async ({ key, value }) => {
      try {
        let updated: Preferences;

        switch (key) {
          case "deliveryInstruction":
          case "unknownVisitorInstruction":
            if (typeof value !== "string") throw new Error("This preference requires text.");
            updated = preferenceStore.update(key, value);
            break;

          case "textSize":
            if (value !== "medium" && value !== "large" && value !== "xlarge") {
              throw new Error("textSize must be medium, large, or xlarge.");
            }
            updated = preferenceStore.update("textSize", value);
            break;

          case "highContrast":
          case "flashAlerts":
          case "retainTranscripts":
            if (typeof value !== "boolean") throw new Error("This preference requires true or false.");
            updated = preferenceStore.update(key, value);
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(updated, null, 2) }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Preference update failed."
          }]
        };
      }
    }
  );

  server.registerTool(
    "propose_reply",
    {
      description: "Propose a reply using saved preferences. This does not deliver it.",
      inputSchema: {
        eventId: z.string().min(1)
      }
    },
    async ({ eventId }) => {
      try {
        const reply = approval.propose(eventId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(reply, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Could not propose reply."
          }]
        };
      }
    }
  );

  server.registerTool(
    "confirm_reply",
    {
      description: "Deliver a simulated reply only when the user explicitly confirms true.",
      inputSchema: {
        replyId: z.string().min(1),
        confirmed: z.boolean()
      }
    },
    async ({ replyId, confirmed }) => {
      try {
        const result = approval.confirm(replyId, confirmed);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Confirmation failed."
          }]
        };
      }
    }
  );

  server.registerTool(
    "correct_inference",
    {
      description: "Record the user's correction to a visitor category inference.",
      inputSchema: {
        eventId: z.string().min(1),
        category: z.enum(["delivery", "neighbor", "unknown", "service"])
      }
    },
    async ({ eventId, category }) => {
      try {
        approval.correctCategory(eventId, category as VisitorCategory);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ ok: true, eventId, category })
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Correction failed."
          }]
        };
      }
    }
  );

  server.registerTool(
    "dismiss_event",
    {
      description: "Dismiss a visitor event and record the action.",
      inputSchema: {
        eventId: z.string().min(1)
      }
    },
    async ({ eventId }) => {
      try {
        approval.dismiss(eventId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ ok: true, eventId, status: "dismissed" })
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Dismissal failed."
          }]
        };
      }
    }
  );

  return server;
}

router.post("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = typeof sessionId === "string"
    ? transports.get(sessionId)
    : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: id => {
        transports.set(id, transport!);
      }
    });

    transport.onclose = () => {
      if (transport?.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
  }

  if (!transport) {
    res.status(400).json({
      error: "No valid MCP session. Initialize the connection first."
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

router.get("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = typeof sessionId === "string"
    ? transports.get(sessionId)
    : undefined;

  if (!transport) {
    res.status(400).json({ error: "Valid MCP session required." });
    return;
  }

  await transport.handleRequest(req, res);
});

router.delete("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = typeof sessionId === "string"
    ? transports.get(sessionId)
    : undefined;

  if (!transport) {
    res.status(400).json({ error: "Valid MCP session required." });
    return;
  }

  await transport.handleRequest(req, res);
});

export const mcpRouter = router;
