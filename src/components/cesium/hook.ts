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
} from 'cesium'
import { isArray } from 'es-toolkit/compat'
import { type ShallowRef } from 'vue'

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
		viewer.value.scene.debugShowFramesPerSecond = true
		viewer.value.scene.globe.depthTestAgainstTerrain = true
		viewer.value.resolutionScale = window.devicePixelRatio
		Camera.DEFAULT_OFFSET = new HeadingPitchRange(0, CesiumMath.toRadians(defaultPitchDegree.value), 0)
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

	// #region 视角控制
	const isScene3D = ref(true)
	const defaultPitchDegree = computed(() => (isScene3D.value ? -45 : -88))

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

	function flyToEntity(entity: Entity | Entity[]) {
		viewer.value.flyTo(entity, { duration: 0.2 })
	}
	// #endregion

	return { viewer, defaultPitchDegree, resetCamera, flyToPosition, flyToEntity }
})

export { useProvideHook, useHook }
