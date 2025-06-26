<script setup lang="ts">
import { isNotNil } from 'es-toolkit'
import { useHook } from './hook'
import { Math as CesiumMath } from 'cesium'

const { viewer, resetCamera } = useHook()

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
</script>

<template>
	<div class="cesium-controls">
		<button class="compass" @click="handleCompassClick()">
			<img :style="{ transform: compassTransform }" alt="compass" src="@/assets/images/cesium-compass.svg" />
		</button>
	</div>
</template>

<style scoped lang="scss">
.cesium-controls {
	position: absolute;
	right: 20px;
	bottom: 40px;
	display: flex;
	align-items: center;
	gap: 20px;
}

.compass {
	width: 40px;
	height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: var(--card-color);
	border-radius: 50%;
	box-shadow: var(--box-shadow-1);
	border: none;
	cursor: pointer;
	opacity: 0.7;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);

	&:hover {
		opacity: 1;
	}

	img {
		transform-style: preserve-3d;
	}
}
</style>
