import {
  existsSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { ACTIVE_SYMLINK_NAME } from "../types/auth.js"

function getBaseDir(): string {
  return join(homedir(), ".antigravity-kit")
}

export function getActiveSymlinkPath(): string {
  return join(getBaseDir(), ACTIVE_SYMLINK_NAME)
}

export function setActiveProfile(profilePath: string): boolean {
  try {
    const symlinkPath = getActiveSymlinkPath()

    if (existsSync(symlinkPath)) {
      rmSync(symlinkPath, { recursive: true, force: true })
    }

    symlinkSync(profilePath, symlinkPath)
    return true
  } catch (error) {
    console.error("Failed to set active profile:", error)
    return false
  }
}

export function getActiveProfilePath(): string | null {
  try {
    const symlinkPath = getActiveSymlinkPath()

    if (!existsSync(symlinkPath)) {
      return null
    }

    const stats = lstatSync(symlinkPath)
    if (!stats.isSymbolicLink()) {
      return null
    }

    const target = readlinkSync(symlinkPath)
    return target
  } catch {
    return null
  }
}

export function getActiveProfileName(): string | null {
  const profilePath = getActiveProfilePath()
  if (!profilePath) {
    return null
  }
  return basename(profilePath)
}

export function isActiveProfile(profilePath: string): boolean {
  const activeProfilePath = getActiveProfilePath()
  if (!activeProfilePath) {
    return false
  }
  return (
    activeProfilePath === profilePath ||
    basename(activeProfilePath) === basename(profilePath)
  )
}

export function removeActiveSymlink(): boolean {
  try {
    const symlinkPath = getActiveSymlinkPath()
    if (existsSync(symlinkPath)) {
      rmSync(symlinkPath, { recursive: true, force: true })
    }
    return true
  } catch {
    return false
  }
}
