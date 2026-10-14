// OpenCode v2 plugin entry.
//
// The published package ships an OpenCode v1 plugin (`plugin/computer-use.mjs`)
// whose `server()` hook returns a `config` mutator. OpenCode v2 replaced that
// hook with `Plugin.define({ setup })` and changed the MCP server schema, so
// the v1 module can no longer be the entry point.
//
// This bridge keeps the v1 module as the single source of truth for what to
// register — the bundled binary path, the canonical skill directory, and the
// "do not override explicit user config" rule — and re-hosts its result onto
// the v2 registration API. The schema translation itself lives in
// `plugin/opencode-v2.mjs`, which has no OpenCode runtime dependency and is
// covered by `tests/npm.test.mjs`.

import { Plugin } from "@opencode/plugin"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { toV2Server } from "./plugin/opencode-v2.mjs"

const root = fileURLToPath(new URL("./", import.meta.url))
const skillPath = join(root, "skills", "computer-use-mcp", "SKILL.md")

const SERVER_NAME = "computer_use"
const SKILL_ID = "computer-use-mcp"

let legacy
async function loadLegacy() {
  if (!legacy) {
    // The v1 plugin exports one default object; `import()` wraps it in a
    // namespace, so `.default` has to be unwrapped to reach `.server`.
    const mod = await import(fileURLToPath(new URL("./plugin/computer-use.mjs", import.meta.url)))
    legacy = mod.default ?? mod
  }
  return legacy
}

async function serverConfig(enabled, compactTools) {
  const mod = await loadLegacy()
  const hooks = await mod.server(undefined, { enabled, compactTools })
  const scratch = { skills: { paths: [] } }
  await hooks.config(scratch)
  return scratch.mcp?.[SERVER_NAME]
}

export default Plugin.define({
  id: "@mirsella/opencode-computer-use-mcp",
  async setup(ctx) {
    const options = ctx.options ?? {}
    if (options.enabled === false) return

    const server = await serverConfig(true, options.compactTools ?? true)
    if (!server) return
    const config = toV2Server(server, root)

    await ctx.mcp.transform((editor) => {
      // An explicit user `mcp.computer_use` entry always wins.
      if (editor.get(SERVER_NAME)) return
      editor.set(SERVER_NAME, config)
    })

    if (existsSync(skillPath)) {
      await ctx.skill.transform((editor) => {
        if (editor.get(SKILL_ID)) return
        editor.add({
          id: SKILL_ID,
          name: SKILL_ID,
          description: "Operate a Wayland desktop using screenshots, accessibility, and window targets.",
          autoinvoke: false,
          path: skillPath,
          content: "",
        })
      })
    }
  },
})
