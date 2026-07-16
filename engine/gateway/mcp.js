// @sare/gateway/mcp — vendor-neutral MCP (Model Context Protocol) tool client (SARE-026).
//
// Domain-free and vendor-neutral BY DESIGN (founder decision Q3: general MCP, not
// locked to any one provider). It speaks the open MCP wire format — JSON-RPC 2.0
// `tools/list` + `tools/call` — and the TRANSPORT is injected per server, so the
// same client reaches an Anthropic MCP server, a self-hosted one, or a third
// party without any code change. No SDK, no vendor field, no secrets in engine.
//
// A transport is any `async (rpcRequest) => rpcResponse` — HTTP POST, SSE, or a
// stub. The client handles framing, id correlation, tool discovery across
// multiple servers, and fail-closed error handling.

let idSeq = 0;
function nextId() { idSeq += 1; return idSeq; }

function rpc(method, params) {
  return { jsonrpc: '2.0', id: nextId(), method, params: params || {} };
}

/**
 * @param {object} opts
 *   opts.servers  { [name]: { transport: async (rpcReq) => rpcRes } }
 * @returns client { listTools, callTool, resolveServer, servers }
 */
export function createMcpClient(opts = {}) {
  const servers = opts.servers || {};
  // name → server cache, populated by listTools()
  const toolIndex = new Map();

  async function callServer(name, method, params) {
    const server = servers[name];
    if (!server || typeof server.transport !== 'function') {
      return { ok: false, reason: 'no_transport', server: name };
    }
    let res;
    try {
      res = await server.transport(rpc(method, params));
    } catch (e) {
      return { ok: false, reason: 'transport_error', error: String((e && e.message) || e), server: name };
    }
    if (!res || res.error) {
      return { ok: false, reason: 'rpc_error', error: res && res.error, server: name };
    }
    return { ok: true, result: res.result, server: name };
  }

  const api = {
    servers,

    /** Aggregate tool definitions across all servers (or one). Builds the name→server index. */
    async listTools(serverName) {
      const names = serverName ? [serverName] : Object.keys(servers);
      const tools = [];
      for (const name of names) {
        const r = await callServer(name, 'tools/list', {});
        if (!r.ok) { tools.push({ server: name, error: r.reason }); continue; }
        for (const t of (r.result && r.result.tools) || []) {
          toolIndex.set(t.name, name);
          tools.push({ server: name, name: t.name, description: t.description, inputSchema: t.inputSchema });
        }
      }
      return tools;
    },

    /** Which server exposes a tool (from the last listTools, or an explicit hint). */
    resolveServer(toolName, hint) {
      if (hint && servers[hint]) return hint;
      return toolIndex.get(toolName) || null;
    },

    /**
     * Call a tool by name. Returns { ok, content, isError, server } or
     * { ok:false, reason }. Fails closed on unknown tool / transport / rpc error.
     * If the server is unknown (listTools not run), pass opts.server.
     */
    async callTool(toolName, args = {}, callOpts = {}) {
      let server = api.resolveServer(toolName, callOpts.server);
      if (!server) {
        // discover then retry once
        await api.listTools();
        server = api.resolveServer(toolName, callOpts.server);
      }
      if (!server) return { ok: false, reason: 'unknown_tool', tool: toolName };
      const r = await callServer(server, 'tools/call', { name: toolName, arguments: args });
      if (!r.ok) return { ok: false, reason: r.reason, error: r.error, server: r.server, tool: toolName };
      // MCP tools return { content:[...], isError?:bool }
      return {
        ok: true,
        content: (r.result && r.result.content) || [],
        isError: Boolean(r.result && r.result.isError),
        server,
        tool: toolName,
      };
    },
  };

  return api;
}

export default createMcpClient;
