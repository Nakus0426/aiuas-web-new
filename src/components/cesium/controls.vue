<script setup lang="ts">
import { isNotNil } from 'es-toolkit'
import { useHook } from './hook'
import { Cartesian2, Cartesian3, Math as CesiumMath, EasingFunction } from 'cesium'

const { viewer, isScene3D, resetCamera } = useHook()

watchOnce(viewer, () => {
	initCompass()
})

onBeforeUnmount(() => {
	viewer.value.scene.preRender.removeEventListener(updateCompass)
})

// #region 指南针
const compassTransform = ref<string>()
let lastCompassHeading = 0
let lastCompassPitch = 0
let lastCompassHeadingDegree = 0
let isCompassFirstUpdate = true

function initCompass() {
	viewer.value.scene.preRender.addEventListener(updateCompass)
}

function updateCompass() {
	const { heading, pitch } = viewer.value.camera
	const THRESHOLD = 0.01
	if (
		isNotNil(lastCompassHeading) &&
		Math.abs(heading - lastCompassHeading) < THRESHOLD &&
		Math.abs(pitch - lastCompassPitch) < THRESHOLD
	)
		return
	const headingDegree = CesiumMath.toDegrees(heading)
	const pitchDegree = CesiumMath.toDegrees(pitch)
	const rotationXDegree = (pitchDegree + 90) * 0.6
	if (isCompassFirstUpdate) {
		compassTransform.value = `rotate(${headingDegree}deg rotateX(${rotationXDegree}deg))`
		lastCompassHeadingDegree = headingDegree
		isCompassFirstUpdate = false
		return
	}
	let diff = headingDegree - lastCompassHeadingDegree
	while (diff > 180) diff -= 360
	while (diff < -180) diff += 360
	const rotationDegree = lastCompassHeadingDegree + diff
	compassTransform.value = `rotate(${rotationDegree}deg) rotateX(${rotationXDegree}deg)`
	lastCompassHeading = rotationDegree
}

function handleCompassClick() {
	resetCamera()
	compassTransform.value = ''
}
// #endregion

// #region 放大缩小
const zoomInRef = useTemplateRef('zoomIn')
const zoomOutRef = useTemplateRef('zoomOut')
let zooming = false

function handleZoomClick(zoomIn: boolean) {
	return new Promise<void>(resolve => {
		const { heading, pitch, roll, position } = viewer.value.camera
		const screenCenterPosition = viewer.value.camera.pickEllipsoid(
			new Cartesian2(viewer.value.canvas.clientWidth / 2, viewer.value.canvas.clientHeight / 2),
			viewer.value.scene.globe.ellipsoid,
		)
		if (!screenCenterPosition) return
		const toCamera = Cartesian3.subtract(position, screenCenterPosition, new Cartesian3())
		const newDistance = Cartesian3.magnitude(toCamera) * (zoomIn ? 0.5 : 1.5)
		Cartesian3.normalize(toCamera, toCamera)
		const targetPosition = Cartesian3.add(
			screenCenterPosition,
			Cartesian3.multiplyByScalar(toCamera, newDistance, new Cartesian3()),
			new Cartesian3(),
		)
		viewer.value.camera.flyTo({
			destination: targetPosition,
			duration: 0.2,
			orientation: { heading, pitch, roll },
			easingFunction: EasingFunction.LINEAR_NONE,
			complete() {
				resolve()
			},
		})
	})
}

async function zoomLoopStart(zoomIn: boolean) {
	zooming = true
	while (zooming) {
		await handleZoomClick(zoomIn)
	}
}

function zoomLoopEnd() {
	zooming = false
}

useEventListener(zoomInRef, 'mousedown', () => zoomLoopStart(true))
useEventListener(zoomOutRef, 'mousedown', () => zoomLoopStart(false))
useEventListener(zoomInRef, 'mouseup', zoomLoopEnd)
useEventListener(zoomInRef, 'mouseout', zoomLoopEnd)
useEventListener(zoomInRef, 'mouseleave', zoomLoopEnd)
useEventListener(zoomOutRef, 'mouseup', zoomLoopEnd)
useEventListener(zoomOutRef, 'mouseout', zoomLoopEnd)
useEventListener(zoomOutRef, 'mouseleave', zoomLoopEnd)
// #endregion

// #region 二/三维切换
function handleSceneClick() {
	isScene3D.value = !isScene3D.value
	resetCamera()
}
// #endregion
</script>

<template>
	<div class="cesium-controls">
		<NTooltip>
			<template #trigger>
				<button class="button compass" @click="handleSceneClick()">
					<Icon height="26" width="26" :icon="isScene3D ? 'mdi:video-2d' : 'mdi:video-3d'" />
				</button>
			</template>
			{{ isScene3D ? '切换至2D' : '切换至3D' }}
		</NTooltip>
		<div class="button-group">
			<NTooltip>
				<template #trigger>
					<button ref="zoomOut" @click="handleZoomClick(false)">
						<Icon icon="tabler:minus" />
					</button>
				</template>
				缩小
			</NTooltip>
			<NTooltip>
				<template #trigger>
					<button ref="zoomIn" @click="handleZoomClick(true)">
						<Icon icon="tabler:plus" />
					</button>
				</template>
				放大
			</NTooltip>
		</div>
		<NTooltip>
			<template #trigger>
				<button class="button location">
					<Icon icon="tabler:current-location-filled" />
				</button>
			</template>
			重置视角
		</NTooltip>
		<NTooltip>
			<template #trigger>
				<button class="button compass" @click="handleCompassClick()">
					<img :style="{ transform: compassTransform }" alt="compass" src="@/assets/images/cesium-compass.svg" />
				</button>
			</template>
			重置方位和俯仰角
		</NTooltip>
	</div>
</template>

<style scoped lang="scss">
.cesium-controls {
	position: absolute;
	right: 20px;
	bottom: 40px;
	display: flex;
	align-items: center;
	gap: 10px;
	pointer-events: none;
}

.button {
	width: 40px;
	height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: var(--card-color);
	border-radius: 20px;
	box-shadow: var(--box-shadow-1);
	border: 1px solid var(--border-color);
	cursor: pointer;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);
	font-size: 20px;
	color: var(--text-color-2);
	pointer-events: all;

	&:hover {
		background-color: var(--hover-color);
	}

	&-group {
		height: 40px;
		display: flex;
		border-radius: 20px;
		border: 1px solid var(--border-color);
		color: var(--text-color-2);
		box-shadow: var(--box-shadow-1);
		overflow: hidden;
		pointer-events: all;

		button {
			width: 40px;
			display: flex;
			justify-content: center;
			align-items: center;
			border: none;
			background-color: var(--card-color);
			cursor: pointer;
			font-size: 20px;
			transition: all 0.2s var(--cubic-bezier-ease-in-out);

			&:hover {
				background-color: var(--hover-color);
			}
		}
	}
}

.compass {
	img {
		transform-style: preserve-3d;
	}
}
</style>
