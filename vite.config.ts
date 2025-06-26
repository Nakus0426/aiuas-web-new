import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { type ComponentResolver } from 'unplugin-vue-components'
import Compression from 'vite-plugin-compression'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig(() => {
	const cesiumSource = 'node_modules/cesium/Build/Cesium'
	const cesiumBaseUrl = './cesium'

	function IconifyResolver(): ComponentResolver {
		return {
			type: 'component',
			resolve: name => {
				if (name === 'Icon' || name === 'icon') return { name: 'Icon', from: '@iconify/vue' }
			},
		}
	}

	return {
		base: './',
		resolve: {
			alias: [{ find: '@', replacement: '/src' }],
		},
		plugins: [
			Vue(),
			Components({
				dts: 'src/components.d.ts',
				globs: ['src/components/**!(modules)/index.vue', 'src/components/*.vue'],
				resolvers: [NaiveUiResolver(), IconifyResolver()],
			}),
			AutoImport({
				dts: 'src/z-auto-imports.d.ts',
				imports: [
					'vue',
					'vue-router',
					'@vueuse/core',
					{
						'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar', 'useModal', 'useThemeVars'],
						vue: ['useTemplateRef'],
					},
				],
				vueTemplate: true,
			}),
			viteStaticCopy({
				targets: [
					{ src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
					{ src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
					{ src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
					{ src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
				],
			}),
			Compression({ verbose: false }),
		],
		define: { CESIUM_BASE_URL: JSON.stringify('./cesium/') },
		experimental: { enableNativePlugin: true },
		css: {
			preprocessorOptions: {
				scss: { api: 'modern-compiler', charset: false },
			},
		},
	}
})
