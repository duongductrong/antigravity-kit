import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { printHeader } from "../../utils/branding.js";
import {
	formatSize,
	getProfileSize,
	listProfiles,
} from "../../utils/profile-manager.js";
import { isActiveProfile } from "../../utils/symlink-manager.js";

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return `${str.slice(0, maxLength - 3)}...`;
}

export default defineCommand({
	meta: {
		name: "list",
		description: "List all saved Google AntiGravity profiles",
	},
	async run() {
		printHeader("antigravity-kit auth list");

		p.intro(pc.cyan("◆") + " " + pc.bold("Saved Profiles"));

		const profiles = listProfiles();

		if (profiles.length === 0) {
			p.note(
				`No profiles found. Add one with:

  ${pc.cyan("antigravity-kit auth add")}`,
				"Empty",
			);
			p.outro(pc.dim("No profiles to display"));
			return;
		}

		console.log();

		const header = [
			pc.dim("  "),
			pc.dim("Email".padEnd(35)),
			pc.dim("Size".padEnd(10)),
			pc.dim("Created"),
		].join("  ");

		const separator = pc.dim("─".repeat(70));

		console.log(header);
		console.log(separator);

		for (const profile of profiles) {
			const isActive = isActiveProfile(profile.profilePath);
			const indicator = isActive ? pc.green("● ") : pc.dim("○ ");
			const email = isActive
				? pc.green(truncate(profile.email, 35).padEnd(35))
				: truncate(profile.email, 35).padEnd(35);
			const size = formatSize(getProfileSize(profile.profilePath)).padEnd(10);
			const created = pc.dim(formatDate(profile.createdAt));

			console.log(`${indicator}${email}  ${size}  ${created}`);
		}

		console.log(separator);
		console.log();

		const activeProfile = profiles.find((p) => isActiveProfile(p.profilePath));
		if (activeProfile) {
			console.log(pc.dim("Active profile: ") + pc.green(activeProfile.email));
		}

		console.log(
			pc.dim(
				`Total: ${profiles.length} profile${profiles.length === 1 ? "" : "s"}`,
			),
		);
		console.log();

		p.outro(pc.dim("Use 'auth switch' to change the active profile"));
	},
});
