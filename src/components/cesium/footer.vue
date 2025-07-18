<script setup lang="ts">
import { useHook } from '@/components/cesium/hook'
import { EventSubscriber } from '@/commons/cesium-screen-space-event-subscriber'
import {
	Cartesian2,
	Cartographic,
	Math as CesiumMath,
	defined,
	EllipsoidGeodesic,
	sampleTerrainMostDetailed,
	ScreenSpaceEventType,
} from 'cesium'
import { debounce, isNotNil } from 'es-toolkit'
import type { FooterProps } from './types'

const { location = true, scale = true } = defineProps<FooterProps>()

const { viewer } = useHook()

// #region 鼠标位置
let cursorPositionSubscriber: EventSubscriber
const longitude = ref<number>()
const latitude = ref<number>()
const ellipsoidHeight = ref<number>()
const terrainHeight = ref<number>()
const longitudeText = computed(() => {
	const isValid = isNotNil(longitude.value)
	return `LNG ${isValid ? Math.round(longitude.value * 1000) / 1000 : '-'}° ${isValid ? (longitude.value >= 0 ? 'E' : 'W') : ''}`
})
const latitudeText = computed(() => {
	const isValid = isNotNil(latitude.value)
	return `LAT ${isValid ? Math.round(latitude.value * 1000) / 1000 : '-'}° ${isValid ? (latitude.value >= 0 ? 'N' : 'S') : ''}`
})

function initCursorPosition() {
	cursorPositionSubscriber = new EventSubscriber(viewer.value)
	const update = debounce(async (position: Cartesian2) => {
		const ray = viewer.value.scene.camera.getPickRay(position)
		if (!ray) return
		const cartesian3 = viewer.value.scene.globe.pick(ray, viewer.value.scene)
		if (!cartesian3) return
		const cartographic = Cartographic.fromCartesian(cartesian3)
		longitude.value = CesiumMath.toDegrees(cartographic.longitude)
		latitude.value = CesiumMath.toDegrees(cartographic.latitude)
		ellipsoidHeight.value = cartographic.height
		const positions = await sampleTerrainMostDetailed(viewer.value.terrainProvider, [cartographic])
		const height = positions[0].height
		if (!isFinite(height)) return
		terrainHeight.value = positions[0].height
	}, 100)
	cursorPositionSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => update(endPosition))
}

function destroyCursorPosition() {
	if (!cursorPositionSubscriber) return
	cursorPositionSubscriber.destroy()
	cursorPositionSubscriber = null
}
// #endregion

// #region 比例尺
const SCALE_VALUE_LIST = [
	5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000,
	500000, 1000000, 2000000, 3000000, 5000000, 10000000, 20000000, 30000000, 50000000,
]
const scaleData = ref({ width: '0px', unit: '', value: 0 })

function initScale() {
	destroyScale()
	viewer.value.scene.camera.changed.addEventListener(updateScale)
}

function destroyScale() {
	viewer.value.scene.camera.changed.removeEventListener(updateScale)
}

function updateScale() {
	const geodesic = new EllipsoidGeodesic()
	const width = viewer.value.scene.canvas.clientWidth
	const height = viewer.value.scene.canvas.clientHeight
	const left = viewer.value.scene.camera.getPickRay(new Cartesian2((width / 2) | 0, height - 1))
	const right = viewer.value.scene.camera.getPickRay(new Cartesian2((1 + width / 2) | 0, height - 1))
	const leftPosition = viewer.value.scene.globe.pick(left, viewer.value.scene)
	const rightPosition = viewer.value.scene.globe.pick(right, viewer.value.scene)

	if (!defined(leftPosition) || !defined(rightPosition)) {
		scaleData.value = { width: '0px', unit: '', value: 0 }
		return
	}

	const leftCartographic = viewer.value.scene.globe.ellipsoid.cartesianToCartographic(leftPosition)
	const rightCartographic = viewer.value.scene.globe.ellipsoid.cartesianToCartographic(rightPosition)
	geodesic.setEndPoints(leftCartographic, rightCartographic)
	const pixelDistance = geodesic.surfaceDistance

	let distance: number
	for (let i = SCALE_VALUE_LIST.length - 1; !defined(distance) && i >= 0; --i)
		if (SCALE_VALUE_LIST[i] / pixelDistance < 100) distance = SCALE_VALUE_LIST[i]

	if (defined(distance)) {
		const isKm = distance >= 1000
		scaleData.value = {
			width: `${(distance / pixelDistance) | 0}px`,
			unit: isKm ? ' km' : ' m',
			value: isKm ? distance / 1000 : distance,
		}
		return
	}
	scaleData.value = { width: '0px', unit: '', value: 0 }
}
// #endregion

onMounted(() => {
	if (location) initCursorPosition()
	if (scale) initScale()
})

watch(
	() => location,
	value => (value ? initCursorPosition() : destroyCursorPosition()),
)
watch(
	() => scale,
	value => (value ? initScale() : destroyScale()),
)

onBeforeUnmount(() => {
	destroyCursorPosition()
	destroyScale()
})
</script>

<template>
	<div class="cesium-footer">
		<div class="cesium-footer_prefix" v-if="location">
			<NTooltip>
				<template #trigger>
					<span>{{ longitudeText }}</span>
				</template>
				经度
			</NTooltip>
			<NTooltip>
				<template #trigger>
					<span>{{ latitudeText }}</span>
				</template>
				纬度
			</NTooltip>
			<NTooltip>
				<template #trigger>
					<span>{{ `HAE ${isNotNil(ellipsoidHeight) ? Math.round(ellipsoidHeight * 10) / 10 : '-'} 米` }}</span>
				</template>
				椭球高度
			</NTooltip>
			<NTooltip>
				<template #trigger>
					<span>{{ `ASL ${isNotNil(terrainHeight) ? Math.round(terrainHeight * 10) / 10 : '-'} 米` }}</span>
				</template>
				海拔高度
			</NTooltip>
		</div>
		<div class="cesium-footer_suffix">
			<NTooltip v-if="scale">
				<template #trigger>
					<div class="scale" :style="{ width: scaleData.width }" v-show="scaleData.value > 0">
						<div class="scale_sign" />
						<div class="scale_text">{{ `${scaleData.value}${scaleData.unit}` }}</div>
					</div>
				</template>
				比例尺
			</NTooltip>
		</div>
	</div>
</template>

<style scoped lang="scss">
.cesium-footer {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 25px;
	display: flex;
	justify-content: space-between;
	align-content: center;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
	color: #ffffff;
	padding: 0 10px;
	font-size: var(--font-size-small);

	&_prefix {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	&_suffix {
		display: flex;
		align-items: center;

		.scale {
			position: relative;
			height: var(--font-size);
			display: flex;
			justify-content: flex-end;
			align-items: center;
			padding: 0 10px;

			&_sign {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 50%;
				border-bottom: 1px solid #ffffff;
				border-left: 1px solid #ffffff;
				border-right: 1px solid #ffffff;
			}
		}
	}
}
</style>
