import express, { Express, Request, Response } from "express";
import { config } from "dotenv";
import cors from "cors";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"; // ✅ .js extension

config();

const app: Express = express();
const PORT: string | number = process.env.PORT || 4000;
const MCP_SERVER_URL: string = "http://localhost:3000/mcp"; // Updated to match the server's running port

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

// Add logging to debug incoming requests
app.use((req: Request, res: Response, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  console.log(req.body);
  next();
});

interface ClientTransportMap {
  [sessionId: string]: {
    client: Client;
    transport: StreamableHTTPClientTransport;
  };
}

const clientTransports: ClientTransportMap = {};

app.post("/mcp/init", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    // Correcting the initialization of StreamableHTTPClientTransport
    const transport = new StreamableHTTPClientTransport(
      new URL(MCP_SERVER_URL),
      {
        requestInit: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    const client = new Client({
      name: "streamable-http-client",
      version: "1.0.0",
    });

    await client.connect(transport);
    // Adjusting the handling of transport.send
    const initializeMessage = {
      jsonrpc: "2.0" as const,
      method: "initialize",
      params: {
        client_name: "streamable-http-client", // Or from client's req.body if applicable
        client_version: "1.0.0", // Or from client's req.body
        // Include other necessary initialization parameters as per MCP spec or server needs
      },
      id: Date.now(), // Or a more robust unique ID
    };

    console.log(
      "Transport sessionId before sending initialize message:",
      transport.sessionId
    );

    await transport.send(initializeMessage);

    console.log(
      "Transport sessionId after sending initialize message:",
      transport.sessionId
    );

    if (transport.sessionId) {
      const sessionId = transport.sessionId;
      clientTransports[sessionId] = { client, transport };
      res.json({ sessionId }); // Respond with the session ID
    } else {
      res.status(500).json({
        error: { message: "Failed to initialize session or get session ID" },
      });
    }
  } catch (error) {
    console.error("Initialization error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .json({ error: { message: `Initialization failed: ${errorMessage}` } });
  }
});

// Update the endpoint to match the server's `/mcp` endpoint
app.post("/mcp", async (req: Request, res: Response): Promise<void> => {
  let sessionId = req.headers["mcp-session-id"] as string | undefined;
  const message = req.body.message as string | undefined;
  const authHeader = req.headers.authorization;

  if (!sessionId) {
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(MCP_SERVER_URL),
        {
          requestInit: {
            headers: authHeader ? { Authorization: authHeader } : {},
          },
        }
      );

      const client = new Client({
        name: "streamable-http-client",
        version: "1.0.0",
      });

      await client.connect(transport);

      const initializeMessage = {
        jsonrpc: "2.0" as const,
        method: "initialize",
        params: {},
        id: Date.now(),
      };

      await transport.send(initializeMessage);

      if (transport.sessionId) {
        sessionId = transport.sessionId;
        clientTransports[sessionId] = { client, transport };
      } else {
        res
          .status(500)
          .json({ error: { message: "Failed to initialize session" } });
        return;
      }
    } catch (error) {
      console.error("Session initialization error:", error);
      res
        .status(500)
        .json({ error: { message: "Session initialization failed" } });
      return;
    }
  }

  if (!message) {
    res.status(400).json({ error: { message: "Message text is required" } });
    return;
  }

  if (message.toLowerCase() === "list tools") {
    try {
      const { client } = clientTransports[sessionId];
      const tools = await client.listTools();
      res.json({
        tools: tools.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          // inputSchema: tool.inputSchema,
        })),
      });
      return;
    } catch (error) {
      console.error("Error listing tools:", error);
      res.status(500).json({ error: { message: "Failed to list tools" } });
      return;
    }
  }

  if (message.toLowerCase().startsWith("call tool")) {
    try {
      const { client } = clientTransports[sessionId];

      // Extract tool name and arguments from the message
      const toolCall = JSON.parse(message.slice("call tool".length).trim());
      const { name, arguments: toolArgs } = toolCall;

      // Call the tool using the client
      const toolResult = await client.callTool({ name, arguments: toolArgs });

      // Respond with the tool's result
      res.json({ result: toolResult });
      return;
    } catch (error) {
      console.error("Error calling tool:", error);
      res.status(500).json({ error: { message: "Failed to call tool" } });
      return;
    }
  }

  if (message.toLowerCase().startsWith("info")) {
    try {
      const { client } = clientTransports[sessionId];

      // Extract petId from the message
      const petId = message.split(" ")[1];
      if (!petId) {
        res.status(400).json({ error: { message: "Pet ID is required for info" } });
        return;
      }

      // Call the get_pet_vaccination_info tool
      const toolResult = await client.callTool({
        name: "get_pet_vaccination_info",
        arguments: { petId },
      });

      res.json({ result: toolResult });
      return;
    } catch (error) {
      console.error("Error calling get_pet_vaccination_info tool:", error);
      res.status(500).json({ error: { message: "Failed to retrieve pet vaccination info" } });
      return;
    }
  }

  if (message.toLowerCase().startsWith("book")) {
    try {
      const { client } = clientTransports[sessionId];

      // Extract booking details from the message
      const [_, date, petId, reason, time] = message.split(" ");
      if (!date || !petId || !reason || !time) {
        res.status(400).json({ error: { message: "Date, Pet ID, Reason, and Time are required for booking" } });
        return;
      }

      // Call the book_vet_appointment tool
      const toolResult = await client.callTool({
        name: "book_vet_appointment",
        arguments: { date, petId, reason, time },
      });

      res.json({ result: toolResult });
      return;
    } catch (error) {
      console.error("Error calling book_vet_appointment tool:", error);
      res.status(500).json({ error: { message: "Failed to book vet appointment" } });
      return;
    }
  }

  try {
    const { transport } = clientTransports[sessionId];

    const requestBody = {
      jsonrpc: "2.0" as const,
      method: "text_completion",
      params: {
        prompt: message,
      },
      id: Date.now(),
    };

    await transport.send(requestBody);
    res.json({ result: "Message processed successfully" });
  } catch (error) {
    console.error("MCP request error:", error);
    res.status(500).json({ error: { message: "MCP request failed" } });
  }
});

app.listen(4000, () => {
  console.log(`MCP Client server running on port ${PORT}`);
  console.log(`MCP Server URL: ${MCP_SERVER_URL}`);
});
