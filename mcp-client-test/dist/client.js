"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js"); // ✅ .js extension
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
const MCP_SERVER_URL = "http://localhost:3000/mcp"; // Updated to match the server's running port
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// Add logging to debug incoming requests
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    console.log(req.body);
    next();
});
const clientTransports = {};
app.post("/mcp/init", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        // Correcting the initialization of StreamableHTTPClientTransport
        const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
            requestInit: {
                headers: authHeader ? { Authorization: authHeader } : {},
            },
        });
        const client = new index_js_1.Client({
            name: "streamable-http-client",
            version: "1.0.0",
        });
        yield client.connect(transport);
        // Adjusting the handling of transport.send
        const initializeMessage = {
            jsonrpc: "2.0",
            method: "initialize",
            params: {
                client_name: "streamable-http-client", // Or from client's req.body if applicable
                client_version: "1.0.0", // Or from client's req.body
                // Include other necessary initialization parameters as per MCP spec or server needs
            },
            id: Date.now(), // Or a more robust unique ID
        };
        console.log("Transport sessionId before sending initialize message:", transport.sessionId);
        yield transport.send(initializeMessage);
        console.log("Transport sessionId after sending initialize message:", transport.sessionId);
        if (transport.sessionId) {
            const sessionId = transport.sessionId;
            clientTransports[sessionId] = { client, transport };
            res.json({ sessionId }); // Respond with the session ID
        }
        else {
            res.status(500).json({
                error: { message: "Failed to initialize session or get session ID" },
            });
        }
    }
    catch (error) {
        console.error("Initialization error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res
            .status(500)
            .json({ error: { message: `Initialization failed: ${errorMessage}` } });
    }
}));
// Update the endpoint to match the server's `/mcp` endpoint
app.post("/mcp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let sessionId = req.headers["mcp-session-id"];
    const message = req.body.message;
    const authHeader = req.headers.authorization;
    if (!sessionId) {
        try {
            const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
                requestInit: {
                    headers: authHeader ? { Authorization: authHeader } : {},
                },
            });
            const client = new index_js_1.Client({
                name: "streamable-http-client",
                version: "1.0.0",
            });
            yield client.connect(transport);
            const initializeMessage = {
                jsonrpc: "2.0",
                method: "initialize",
                params: {},
                id: Date.now(),
            };
            yield transport.send(initializeMessage);
            if (transport.sessionId) {
                sessionId = transport.sessionId;
                clientTransports[sessionId] = { client, transport };
            }
            else {
                res
                    .status(500)
                    .json({ error: { message: "Failed to initialize session" } });
                return;
            }
        }
        catch (error) {
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
            const tools = yield client.listTools();
            res.json({
                tools: tools.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    // inputSchema: tool.inputSchema,
                })),
            });
            return;
        }
        catch (error) {
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
            const toolResult = yield client.callTool({ name, arguments: toolArgs });
            // Respond with the tool's result
            res.json({ result: toolResult });
            return;
        }
        catch (error) {
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
            const toolResult = yield client.callTool({
                name: "get_pet_vaccination_info",
                arguments: { petId },
            });
            res.json({ result: toolResult });
            return;
        }
        catch (error) {
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
            const toolResult = yield client.callTool({
                name: "book_vet_appointment",
                arguments: { date, petId, reason, time },
            });
            res.json({ result: toolResult });
            return;
        }
        catch (error) {
            console.error("Error calling book_vet_appointment tool:", error);
            res.status(500).json({ error: { message: "Failed to book vet appointment" } });
            return;
        }
    }
    try {
        const { transport } = clientTransports[sessionId];
        const requestBody = {
            jsonrpc: "2.0",
            method: "text_completion",
            params: {
                prompt: message,
            },
            id: Date.now(),
        };
        yield transport.send(requestBody);
        res.json({ result: "Message processed successfully" });
    }
    catch (error) {
        console.error("MCP request error:", error);
        res.status(500).json({ error: { message: "MCP request failed" } });
    }
}));
app.listen(4000, () => {
    console.log(`MCP Client server running on port ${PORT}`);
    console.log(`MCP Server URL: ${MCP_SERVER_URL}`);
});
