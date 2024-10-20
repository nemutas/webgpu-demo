import { resolve } from 'path'
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import tsconfigPaths from 'vite-tsconfig-paths'

function page(pageName: string) {
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
          page('error'),
          page("001_fullscreen_texture"),
          page("002_cube"),
          page("003_shadow"),
          page("004_instance"),
          page("005_compute_instanced_matrix"),
          page("006_postprocessing"),
          page("007_lines"),
          page("008_lines_vortex"),
        ],
      },
    },
  }
})
