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
	UrlTemplateImageryProvider,
	ScreenSpaceEventType,
} from 'cesium'
import { isArray } from 'es-toolkit/compat'
import { type ShallowRef } from 'vue'
import TDTPlugin from '@/commons/tdt-plugin'
import {
	SUB_DOMAINS as TDT_SUB_DOMAINS,
	TER_SERVICE as TDT_TER_SERVICE,
	IMG_SERVICE as TDT_IMG_SERVICE,
	IBO_SERVICE,
	CIA_SERVICE as TDT_CIA_SERVICE,
} from '@/configs/tdt'
import {
	SUB_DOMAINS as AMAP_SUB_DOMAINS,
	IMG_SERVICE as AMAP_IMG_SERVICE,
	CIA_SERVICE as AMAP_CIA_SERVICE,
	AmapMercatorTilingScheme,
} from '@/configs/amap'
import { nanoid } from 'nanoid'

const [useProvideHook, useHook] = createInjectionState((container: ShallowRef<HTMLDivElement>) => {
	const appStore = useAppStore()
	const { get: getAppConfig } = useDict('dynamic_config_front_functions')
	const { offlineMapEnable, terrainRelativePath, layerRelativePath } = appStore.setting
	const id = nanoid()
	const organizationId = 'JK7VYN'

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
		initBaseLayer()
		viewer.value.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
	}

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

	// #region 基础图层
	async function initBaseLayer() {
		viewer.value.imageryLayers.remove(viewer.value.imageryLayers.get(0))
		if (offlineMapEnable) {
			viewer.value.imageryLayers.addImageryProvider(
				new UrlTemplateImageryProvider({ url: `${location.origin}${layerRelativePath}/{z}/{x}/{y}.png` }),
			)
			viewer.value.terrainProvider = await CesiumTerrainProvider.fromUrl(
				`${window.location.origin}${terrainRelativePath}`,
			)
			return
		}
		const isImgTDT = getAppConfig('map_img_layer') === 'tdt'
		viewer.value.imageryLayers.addImageryProvider(
			new UrlTemplateImageryProvider({
				url: isImgTDT ? TDT_IMG_SERVICE : AMAP_IMG_SERVICE,
				subdomains: isImgTDT ? TDT_SUB_DOMAINS : AMAP_SUB_DOMAINS,
				maximumLevel: 18,
				tilingScheme: isImgTDT ? null : new AmapMercatorTilingScheme(null),
			}),
		)
		viewer.value.imageryLayers.addImageryProvider(
			new UrlTemplateImageryProvider({
				url: IBO_SERVICE,
				subdomains: TDT_SUB_DOMAINS,
				maximumLevel: 10,
			}),
		)
		const isCiaTDT = getAppConfig('map_cia_layer') === 'tdt'
		viewer.value.imageryLayers.addImageryProvider(
			new UrlTemplateImageryProvider({
				url: isCiaTDT ? TDT_CIA_SERVICE : AMAP_CIA_SERVICE,
				subdomains: isCiaTDT ? TDT_SUB_DOMAINS : AMAP_SUB_DOMAINS,
				maximumLevel: 18,
				tilingScheme: isCiaTDT ? null : new AmapMercatorTilingScheme(null),
			}),
		)
		viewer.value.terrainProvider = new TDTPlugin.GeoTerrainProvider({
			url: TDT_TER_SERVICE,
			subdomains: TDT_SUB_DOMAINS,
			callback: () => {},
		})
	}
	// #endregion

	const measureActived = ref(false)

	return {
		id,
		viewer,
		defaultPitchDegree,
		isScene3D,
		organizationId,
		measureActived,
		init,
		resetCamera,
		flyToPosition,
		flyToTarget,
		getViewCorners,
	}
})

export { useProvideHook, useHook }
