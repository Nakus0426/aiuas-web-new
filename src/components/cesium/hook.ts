import { useAppStore } from '@/stores/modules/app'
import {
	Cartesian2,
	SceneMode,
	ShadowMode,
	Viewer,
	Math as CesiumMath,
	Cartesian3,
	JulianDate,
	ClockRange,
	ClockStep,
	HeadingPitchRange,
	Matrix4,
	Entity,
	Camera,
	Cartographic,
	CesiumTerrainProvider,
	type EntityCollection,
	type DataSource,
	type ImageryLayer,
	type Cesium3DTileset,
	type TimeDynamicPointCloud,
} from 'cesium'
import { isArray } from 'es-toolkit/compat'
import { type ShallowRef } from 'vue'
import TDTPlugin from '@/commons/tdt-plugin'
import { SUB_DOMAINS, TER_SERVICE } from '@/configs/tdt'

const [useProvideHook, useHook] = createInjectionState((container: ShallowRef<HTMLDivElement>) => {
	const appStore = useAppStore()
	const { get: getAppConfig } = useDict('dynamic_config_front_functions')

	// #region 初始化
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
		viewer.value.scene.debugShowFramesPerSecond = true
		viewer.value.scene.globe.depthTestAgainstTerrain = true
		viewer.value.resolutionScale = window.devicePixelRatio
		Camera.DEFAULT_OFFSET = new HeadingPitchRange(0, CesiumMath.toRadians(defaultPitchDegree.value), 0)
		initTerrain()
	}

	async function initTerrain() {
		const { offlineMapEnable, terrainRelativePath } = appStore.setting
		let provider
		if (offlineMapEnable)
			provider = await CesiumTerrainProvider.fromUrl(`${window.location.origin}${terrainRelativePath}`)
		else
			provider = new TDTPlugin.GeoTerrainProvider({
				url: TER_SERVICE,
				subdomains: SUB_DOMAINS,
				callback: () => {},
			})
		viewer.value.terrainProvider = provider
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
	// #endregion

	// #region 视角控制
	const isScene3D = ref(getAppConfig('cesium_scene_3d') === '1')
	const defaultPitchDegree = computed(() => (isScene3D.value ? -45 : -88))

	watch(defaultPitchDegree, value => (Camera.DEFAULT_OFFSET = new HeadingPitchRange(0, CesiumMath.toRadians(value), 0)))

	function resetCamera() {
		const centerPosition = viewer.value.camera.pickEllipsoid(
			new Cartesian2(viewer.value.canvas.clientWidth / 2, viewer.value.canvas.clientHeight / 2),
		)
		const initialPitch = viewer.value.camera.pitch
		const angle = (CesiumMath.toRadians(defaultPitchDegree.value) - initialPitch) / 0.5
		const distance = Cartesian3.distance(centerPosition, viewer.value.camera.positionWC)
		const startTime = JulianDate.fromDate(new Date())
		const stopTime = JulianDate.addSeconds(startTime, 0.5, new JulianDate())
		viewer.value.clock.startTime = startTime
		viewer.value.clock.stopTime = stopTime
		viewer.value.clock.currentTime = startTime.clone()
		viewer.value.clock.clockRange = ClockRange.CLAMPED
		viewer.value.clock.clockStep = ClockStep.SYSTEM_CLOCK
		const initialHeading = viewer.value.camera.heading
		const Execution = function TimeExecution() {
			const delTime = JulianDate.secondsDifference(viewer.value.clock.currentTime, viewer.value.clock.startTime)
			const heading = initialHeading
			const pitch = delTime * angle + initialPitch
			viewer.value.camera.lookAt(centerPosition, new HeadingPitchRange(heading, pitch, distance))
			viewer.value.camera.lookAtTransform(Matrix4.IDENTITY)
			if (JulianDate.compare(viewer.value.clock.currentTime, viewer.value.clock.stopTime) >= 0)
				viewer.value.clock.onTick.removeEventListener(Execution)
		}
		viewer.value.clock.onTick.addEventListener(Execution)
	}

	function flyToPosition(position: Cartesian3 | Cartesian3[]) {
		let tempEntity: Entity
		const tempEntityOptions = isArray(position)
			? { polyline: { positions: position, clampToGround: true } }
			: { position: position }
		tempEntity = viewer.value.entities.add(tempEntityOptions)
		viewer.value.flyTo(tempEntity, { duration: 0.2 })
	}

	function flyToTarget(
		target: Entity | Entity[] | EntityCollection | DataSource | ImageryLayer | Cesium3DTileset | TimeDynamicPointCloud,
	) {
		viewer.value.flyTo(target, { duration: 0.2 })
	}
	// #endregion

	// #region 工具函数
	/**
	 * 获取视野范围坐标
	 */
	function getViewCorners() {
		if (CesiumMath.toDegrees(viewer.value.camera.pitch) >= 0) throw new Error('相机俯仰角必须小于0°')
		const rectangle = viewer.value.camera.computeViewRectangle()
		const positions = [
			new Cartographic(rectangle.west, rectangle.north, 0),
			new Cartographic(rectangle.east, rectangle.north, 0),
			new Cartographic(rectangle.east, rectangle.south, 0),
			new Cartographic(rectangle.west, rectangle.south, 0),
		]
		return positions.map(cartographic => ({
			longitude: CesiumMath.toDegrees(cartographic.longitude),
			latitude: CesiumMath.toDegrees(cartographic.latitude),
		}))
	}
	// #endregion

	return { viewer, defaultPitchDegree, resetCamera, flyToPosition, flyToTarget, getViewCorners }
})

export { useProvideHook, useHook }
