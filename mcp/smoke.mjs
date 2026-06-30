// Smoke test: connect to the server over stdio and list tools + prompts.
// Does NOT invoke handlers, so it won't clone the engine or render anything.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
  env: { ...process.env, DVF_HOME: "/Users/jonathanbar/corebee-commercial" },
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
const prompts = await client.listPrompts();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));
console.log("PROMPTS:", prompts.prompts.map((p) => p.name).join(", "));
await client.close();
console.log("SMOKE_OK");
