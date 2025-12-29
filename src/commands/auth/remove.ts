import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { printHeader } from "../../utils/branding.js";
import {
	formatSize,
	getProfileSize,
	listProfiles,
	removeProfile,
} from "../../utils/profile-manager.js";
import {
	isActiveProfile,
	removeActiveSymlink,
	setActiveProfile,
} from "../../utils/symlink-manager.js";

export default defineCommand({
	meta: {
		name: "remove",
		description: "Remove a Google AntiGravity profile",
	},
	async run() {
		printHeader("antigravity-kit auth remove");

		p.intro(pc.cyan("◆") + " " + pc.bold("Remove Profile"));

		const profiles = listProfiles();

		if (profiles.length === 0) {
			p.note(
				`No profiles found. Add one with:

  ${pc.cyan("antigravity-kit auth add")}`,
				"No Profiles",
			);
			p.cancel("No profiles to remove");
			process.exit(1);
		}

		const options = profiles.map((profile) => {
			const isActive = isActiveProfile(profile.profilePath);
			const size = formatSize(getProfileSize(profile.profilePath));
			const label = isActive
				? `${profile.email} ${pc.green("(active)")}`
				: profile.email;

			return {
				value: profile.profilePath,
				label,
				hint: size,
			};
		});

		const selectedPath = await p.select({
			message: "Select a profile to remove:",
			options,
		});

		if (p.isCancel(selectedPath)) {
			p.cancel("Operation cancelled");
			process.exit(0);
		}

		const selectedProfile = profiles.find(
			(p) => p.profilePath === selectedPath,
		);

		if (!selectedProfile) {
			p.cancel("Profile not found");
			process.exit(1);
		}

		const isActive = isActiveProfile(selectedPath as string);
		const profileSize = formatSize(getProfileSize(selectedPath as string));

		let warningMessage = `Are you sure you want to remove ${pc.cyan(selectedProfile.email)}?`;
		warningMessage += `\n${pc.dim(`This will free up ${profileSize} of disk space.`)}`;

		if (isActive) {
			warningMessage += `\n\n${pc.yellow("⚠")} This is your ${pc.yellow("active")} profile.`;
		}

		const confirmed = await p.confirm({
			message: warningMessage,
			initialValue: false,
		});

		if (p.isCancel(confirmed) || !confirmed) {
			p.cancel("Removal cancelled");
			process.exit(0);
		}

		const spinner = p.spinner();
		spinner.start("Removing profile...");

		const success = removeProfile(selectedPath as string);

		if (!success) {
			spinner.stop("Failed");
			p.cancel("Failed to remove profile");
			process.exit(1);
		}

		// If removed profile was active, update symlink
		if (isActive) {
			const remainingProfiles = listProfiles();
			if (remainingProfiles.length > 0 && remainingProfiles[0]) {
				setActiveProfile(remainingProfiles[0].profilePath);
				spinner.stop("Profile removed");
				console.log();
				p.note(
					`Active profile changed to: ${pc.cyan(remainingProfiles[0].email)}`,
					"New Active Profile",
				);
			} else {
				removeActiveSymlink();
				spinner.stop("Profile removed");
			}
		} else {
			spinner.stop("Profile removed");
		}

		console.log();
		p.outro(
			`${pc.green("✔")} Profile ${pc.cyan(selectedProfile.email)} removed`,
		);
	},
});
