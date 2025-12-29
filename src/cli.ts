#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import authCommand from "./commands/auth/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
	version: string;
	name: string;
	description: string;
}

function getPackageJson(): PackageJson {
	try {
		const pkgPath = join(__dirname, "..", "package.json");
		const content = readFileSync(pkgPath, "utf-8");
		return JSON.parse(content) as PackageJson;
	} catch {
		return {
			version: "0.0.0",
			name: "antigravity-kit",
			description: "CLI toolkit to manage antigravity IDE rules and commands",
		};
	}
}

const pkg = getPackageJson();

const main = defineCommand({
	meta: {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
	},
	subCommands: {
		auth: authCommand,
	},
});

runMain(main);
