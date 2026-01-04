import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import figlet from "figlet"
import gradient from "gradient-string"
import pc from "picocolors"

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  version: string
  name: string
}

function getPackageJson(): PackageJson {
  try {
    const pkgPath = join(__dirname, "..", "package.json")
    const content = readFileSync(pkgPath, "utf-8")
    return JSON.parse(content) as PackageJson
  } catch {
    return { version: "0.0.0", name: "antigravity-kit" }
  }
}

const antigravityGradient = gradient([
  { color: "#98FB98", pos: 0 },
  { color: "#7FFFD4", pos: 0.3 },
  { color: "#40E0D0", pos: 0.5 },
  { color: "#4169E1", pos: 1 },
])

export function printBanner(): void {
  const banner = figlet.textSync("ANTIGRAVITY", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted",
  })

  console.log(antigravityGradient.multiline(banner))
}

export function printVersion(): void {
  const pkg = getPackageJson()
  console.log(pc.dim(`v${pkg.version} • Made with ${pc.red("♥")}`))
  console.log()
}

export function printCommand(cmd: string): void {
  const boxChar = {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  }

  const padding = 2
  const innerWidth = cmd.length + padding * 2
  const top = `${boxChar.topLeft}${boxChar.horizontal.repeat(innerWidth)}${boxChar.topRight}`
  const bottom = `${boxChar.bottomLeft}${boxChar.horizontal.repeat(innerWidth)}${boxChar.bottomRight}`
  const middle = `${boxChar.vertical}${" ".repeat(padding)}${pc.cyan(cmd)}${" ".repeat(padding)}${boxChar.vertical}`

  console.log(pc.dim(top))
  console.log(pc.dim(middle))
  console.log(pc.dim(bottom))
  console.log()
}

export function printHeader(command?: string): void {
  console.log()
  printBanner()
  printVersion()
  if (command) {
    printCommand(command)
  }
}

export function printSuccess(message: string): void {
  console.log(`${pc.green("✔")} ${message}`)
}

export function printError(message: string): void {
  console.log(`${pc.red("✖")} ${message}`)
}

export function printInfo(message: string): void {
  console.log(`${pc.blue("ℹ")} ${message}`)
}

export function printWarning(message: string): void {
  console.log(`${pc.yellow("⚠")} ${message}`)
}
