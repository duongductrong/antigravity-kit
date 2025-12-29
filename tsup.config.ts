import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: {
			cli: "src/cli.ts",
		},
		format: ["esm"],
		dts: false,
		clean: true,
		sourcemap: true,
		splitting: false,
		shims: true,
	},
	{
		entry: {
			index: "src/index.ts",
		},
		format: ["esm", "cjs"],
		dts: true,
		clean: false,
		sourcemap: true,
		splitting: false,
		shims: true,
	},
]);
