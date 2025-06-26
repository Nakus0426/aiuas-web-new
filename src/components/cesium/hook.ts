import { SceneMode, ShadowMode, Viewer } from 'cesium'
import type { ShallowRef } from 'vue'

const [useProvideHook, useHook] = createInjectionState((container: ShallowRef<HTMLDivElement>) => {
	//#region 初始化
	const viewer = shallowRef<Viewer>()
	function init() {
		viewer.value = new Viewer(container.value, {
			selectionIndicator: false,
			shouldAnimate: false,
			infoBox: false,
			animation: false,
			timeline: false,
			baseLayerPicker: false,
			fullscreenButton: false,
			vrButton: false,
			geocoder: false,
			homeButton: false,
			sceneModePicker: false,
			navigationHelpButton: false,
			navigationInstructionsInitiallyVisible: false,
			scene3DOnly: true,
			terrainShadows: ShadowMode.DISABLED,
			sceneMode: SceneMode.SCENE3D,
		})
		viewer.value.scene.globe.depthTestAgainstTerrain = true
		viewer.value.resolutionScale = window.devicePixelRatio
	}

	onMounted(async () => {
		await nextTick()
		init()
	})

	onBeforeUnmount(() => {
		if (viewer.value) {
			viewer.value.destroy()
			viewer.value = null
		}
	})
	//#endregion

	return { viewer }
})

export { useProvideHook, useHook }
