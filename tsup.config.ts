import { defineConfig } from "tsup"

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "server/index": "src/server/index.ts",
        "react/index": "src/react/index.tsx",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: false,
    splitting: true,
    treeshake: true,
    target: "es2022",
    external: ["react", "react/jsx-runtime"],
})
