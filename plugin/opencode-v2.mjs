// Schema translation from the OpenCode v1 MCP server shape to v2.
//
// The v1 plugin (`computer-use.mjs`) stays the single source of truth for what
// to register: the bundled binary, the compact-tools argument, and the
// "do not override explicit user config" rule. OpenCode v2 changed the MCP
// server schema, so the value it produces cannot be registered as-is.
//
// This module holds only that translation, with no OpenCode runtime import, so
// it can be tested directly against real v1 plugin output.
//
// Differences that matter:
//   v1: { timeout: 150_000 }            milliseconds, flat
//   v2: { timeout: { execution: 150 } } seconds, split by phase
//   v1: { environment?: {...} }         optional, may be absent
//   v2: `environment` must be a string map; an absent value is omitted rather
//       than sent as `undefined`, which the schema rejects.

// The v1 plugin's flat `timeout` is milliseconds. v2 splits timeouts by phase;
// the tool-call budget is the one the v1 value described.
export const EXECUTION_TIMEOUT_SECONDS = 150;

/**
 * @param {{ command: string | string[], cwd?: string, environment?: Record<string, string> }} server
 *   A `mcp.computer_use` value produced by the v1 plugin.
 * @param {string} fallbackCwd Directory to use when the v1 value carries none.
 */
export function toV2Server(server, fallbackCwd) {
  if (!server || typeof server !== "object") {
    throw new TypeError("v1 server config must be an object");
  }
  const command = typeof server.command === "string" ? [server.command] : server.command;
  if (!Array.isArray(command) || command.length === 0) {
    throw new TypeError("v1 server config must carry a command");
  }
  const config = {
    type: "local",
    command,
    enabled: true,
    timeout: { execution: EXECUTION_TIMEOUT_SECONDS },
  };
  // `cwd` and `environment` are optional in v2; omit them instead of sending
  // `undefined`.
  const cwd = server.cwd ?? fallbackCwd;
  if (typeof cwd === "string" && cwd.length > 0) config.cwd = cwd;
  if (server.environment && Object.keys(server.environment).length > 0) {
    config.environment = server.environment;
  }
  return config;
}
