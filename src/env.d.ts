/// <reference types="vite/client" />
/// <reference types="unplugin-vue-macros/macros-global" />

declare module '*.vue' {
	import { type DefineComponent } from 'vue'
	const component: DefineComponent<{}, {}, any>
	export default component
}

/** 环境配置文件类型 */
interface ImportMetaEnv {}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

interface Window {
	$loadingBar: import('naive-ui').LoadingBarProviderInst
	$message: import('naive-ui').MessageProviderInst
	$notification: import('naive-ui').NotificationProviderInst
	$dialog: import('naive-ui').DialogProviderInst
	$modal: import('naive-ui').ModalProviderInst
}
