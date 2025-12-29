import { defineCommand } from "citty";
import addCommand from "./add.js";
import listCommand from "./list.js";
import removeCommand from "./remove.js";
import switchCommand from "./switch.js";

export default defineCommand({
	meta: {
		name: "auth",
		description: "Manage Google AntiGravity authentication",
	},
	subCommands: {
		add: addCommand,
		list: listCommand,
		switch: switchCommand,
		remove: removeCommand,
	},
});
