import { resolve } from 'path'
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import tsconfigPaths from 'vite-tsconfig-paths'

function pagePath(pageName: string) {
  return resolve(__dirname, `src/pages/${pageName}/index.html`)
}

export default defineConfig(() => {
  return {
    root: './src',
    publicDir: resolve(__dirname, 'public'),
    base: '/webgpu-demo/',
    plugins: [tsconfigPaths(), glsl()],
    server: {
      host: true,
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    build: {
      outDir: resolve(__dirname, 'dist'),
      target: 'esnext',
      emptyOutDir: true,
      rollupOptions: {
        // prettier-ignore
        input: [
          resolve(__dirname, 'src/index.html'), 
          pagePath('error'),
          pagePath("001_fullscreen_texture"),
          pagePath("002_cube"),
          pagePath("003_shadow"),
          pagePath("004_instance"),
        ],
      },
    },
  }
})
