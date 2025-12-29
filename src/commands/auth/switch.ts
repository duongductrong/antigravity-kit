import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
  isAntigravityRunning,
  openAntigravity,
  quitAntigravity,
} from "../../utils/antigravity-launcher.js";
import { printHeader } from "../../utils/branding.js";
import {
  AntigravityRunningError,
  listProfiles,
  restoreProfileToDefault,
} from "../../utils/profile-manager.js";
import {
  isActiveProfile,
  setActiveProfile,
} from "../../utils/symlink-manager.js";

export default defineCommand({
  meta: {
    name: "switch",
    description: "Switch between Google AntiGravity profiles",
  },
  async run() {
    printHeader("antigravity-kit auth switch");

    p.intro(pc.cyan("◆") + " " + pc.bold("Switch Profile"));

    const profiles = listProfiles();

    if (profiles.length === 0) {
      p.note(
        `No profiles found. Add one with:

  ${pc.cyan("antigravity-kit auth add")}`,
        "No Profiles"
      );
      p.cancel("No profiles to switch between");
      process.exit(1);
    }

    if (profiles.length === 1) {
      p.note(
        `Only one profile is available. Add another with:

  ${pc.cyan("antigravity-kit auth add")}`,
        "Single Profile"
      );
      p.outro(pc.dim("Nothing to switch"));
      return;
    }

    const currentActiveProfile = profiles.find((p) =>
      isActiveProfile(p.profilePath)
    );

    if (currentActiveProfile) {
      console.log();
      console.log(
        pc.dim("Current profile: ") + pc.cyan(currentActiveProfile.email)
      );
      console.log();
    }

    const options = profiles.map((profile) => {
      const isActive = isActiveProfile(profile.profilePath);
      const label = isActive
        ? `${profile.email} ${pc.green("(active)")}`
        : profile.email;
      const hint = profile.name !== profile.email ? profile.name : undefined;

      const option: { value: string; label: string; hint?: string } = {
        value: profile.profilePath,
        label,
      };

      if (hint) {
        option.hint = hint;
      }

      return option;
    });

    const selectedPath = await p.select({
      message: "Select a profile to switch to:",
      options,
      initialValue: currentActiveProfile?.profilePath,
    });

    if (p.isCancel(selectedPath)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const selectedProfile = profiles.find(
      (p) => p.profilePath === selectedPath
    );

    if (!selectedProfile) {
      p.cancel("Profile not found");
      process.exit(1);
    }

    if (isActiveProfile(selectedPath as string)) {
      p.outro(pc.dim("Profile unchanged"));
      return;
    }

    const isRunning = await isAntigravityRunning();
    if (isRunning) {
      const shouldContinue = await p.confirm({
        message: `${pc.yellow(
          "Antigravity is currently running."
        )} Close it to continue?`,
        initialValue: true,
      });

      if (p.isCancel(shouldContinue) || !shouldContinue) {
        p.cancel("Please close Antigravity manually and try again");
        process.exit(1);
      }

      const spinner = p.spinner();
      spinner.start("Closing Antigravity...");

      const quitSuccess = await quitAntigravity();

      if (!quitSuccess) {
        spinner.message("Waiting for Antigravity to close...");
      }

      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const stillRunning = await isAntigravityRunning();
        if (!stillRunning) {
          break;
        }
        attempts++;
      }

      const stillRunning = await isAntigravityRunning();
      if (stillRunning) {
        spinner.stop("Antigravity is still running");
        p.cancel("Please close Antigravity manually and try again");
        process.exit(1);
      }

      spinner.stop("Antigravity closed");
    }

    const success = setActiveProfile(selectedPath as string);

    if (!success) {
      p.cancel("Failed to switch profile");
      process.exit(1);
    }

    try {
      const restored = restoreProfileToDefault(selectedPath as string);

      if (!restored) {
        p.cancel("Failed to restore profile data");
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof AntigravityRunningError) {
        p.cancel(error.message);
        process.exit(1);
      }
      throw error;
    }

    console.log();

    const shouldLaunch = await p.confirm({
      message: "Launch Antigravity with the new profile?",
      initialValue: true,
    });

    if (p.isCancel(shouldLaunch)) {
      p.outro(`${pc.green("✔")} Switched to ${pc.cyan(selectedProfile.email)}`);
      return;
    }

    if (shouldLaunch) {
      try {
        const stillRunning = await isAntigravityRunning();
        if (stillRunning) {
          await quitAntigravity();
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        await openAntigravity(selectedPath as string);
        p.outro(
          `${pc.green("✔")} Switched to ${pc.cyan(
            selectedProfile.email
          )} and launched Antigravity`
        );
      } catch (error) {
        p.outro(
          `${pc.green("✔")} Switched to ${pc.cyan(
            selectedProfile.email
          )}\n${pc.yellow("⚠")} Failed to launch Antigravity`
        );
      }
    } else {
      p.outro(`${pc.green("✔")} Switched to ${pc.cyan(selectedProfile.email)}`);
    }
  },
});
