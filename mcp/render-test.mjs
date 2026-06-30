// Real integration test: drive render_demo through the MCP client end-to-end
// against the existing repo (DVF_HOME set => no clone). Proves the server's
// brief-write -> music -> assemble -> remotion render -> path orchestration.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, existsSync } from "node:fs";

const HOME = "/Users/jonathanbar/corebee-commercial";
const brief = JSON.parse(readFileSync(`${HOME}/out/cal_brief.json`, "utf8"));
const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
  env: { ...process.env, DVF_HOME: HOME },
});
const client = new Client({ name: "render-test", version: "1.0.0" });
await client.connect(transport);
console.log("connected; calling render_demo(cal, pace=fast)...");
const res = await client.callTool(
  { name: "render_demo", arguments: { slug: "cal", brief, pace: "fast", mood: "auto" } },
  undefined,
  { timeout: 900000 }
);
const text = (res.content || []).map((c) => c.text).join("\n");
console.log("RESULT:", text, "isError:", res.isError === true);
const out = `${HOME}/out/demo_cal.mp4`;
console.log("MP4_EXISTS:", existsSync(out));
await client.close();
console.log("RENDER_TEST_DONE");
