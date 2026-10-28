import { defineConfig } from '@rslib/core';

export default defineConfig({
    lib: [
        {
            format: 'esm',
            syntax: 'esnext',
            bundle: true,
            dts: false,
            source: {
                entry: { index: './src/index.ts' },
                define: {
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
                },
            },
            output: {
                target: 'node',
                sourceMap: false,
                minify: true,
                cleanDistPath: true,
                autoExternal: true,
            },
        },
    ],
});
