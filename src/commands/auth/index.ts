import * as p from "@clack/prompts"
import { defineCommand, runCommand } from "citty"
import pc from "picocolors"
import { printHeader } from "../../utils/branding.js"
import addCommand from "./add.js"
import listCommand from "./list.js"
import quotaCommand from "./quota.js"
import removeCommand from "./remove.js"
import switchCommand from "./switch.js"

const subCommands = {
  add: addCommand,
  list: listCommand,
  switch: switchCommand,
  remove: removeCommand,
  quota: quotaCommand,
}

type SubCommandKey = keyof typeof subCommands

interface SubCommandOption {
  value: SubCommandKey
  label: string
  hint: string
}

const subCommandOptions: SubCommandOption[] = [
  { value: "list", label: "list", hint: "List all saved profiles" },
  { value: "add", label: "add", hint: "Add a new account" },
  { value: "switch", label: "switch", hint: "Switch to a different profile" },
  { value: "remove", label: "remove", hint: "Remove a saved profile" },
  { value: "quota", label: "quota", hint: "Check account quota" },
]

const subCommandNames = Object.keys(subCommands)

export default defineCommand({
  meta: {
    name: "auth",
    description: "Manage Google AntiGravity authentication",
  },
  subCommands,
  async run({ rawArgs }) {
    // Only show interactive menu when no subcommand was explicitly provided
    // If a subcommand was provided, citty already executed it
    const hasSubCommand = rawArgs?.some((arg) => subCommandNames.includes(arg))
    if (hasSubCommand) {
      return // Subcommand was already executed by citty
    }

    // Show interactive menu when no subcommand is provided
    printHeader("antigravity-kit auth")

    p.intro(`${pc.cyan("◆")} ${pc.bold("Authentication Manager")}`)

    const selected = await p.select({
      message: "Select an action:",
      options: subCommandOptions,
    })

    if (p.isCancel(selected)) {
      p.cancel("Operation cancelled")
      process.exit(0)
    }

    console.log()

    // Run the selected subcommand
    const commandKey = selected as SubCommandKey
    // biome-ignore lint/suspicious/noExplicitAny: runCommand has strict typing that conflicts with dynamic command selection
    await runCommand(subCommands[commandKey] as any, { rawArgs: [] })
  },
})
