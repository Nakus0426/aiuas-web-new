<script setup lang="ts">
import { useHook } from '@/components/cesium/hook'
import CesiumScreenSpaceEventSubscriber from '@/commons/CesiumScreenSpaceEventSubscriber'
import { Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Ray, ScreenSpaceEventType } from 'cesium'
import { isNotNil } from 'es-toolkit'

const { viewer } = useHook()

watchOnce(viewer, () => {
	initCursorPosition()
	initScale()
})

// #region 鼠标位置
let cursorPositionSubscriber: CesiumScreenSpaceEventSubscriber
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
	cursorPositionSubscriber = new CesiumScreenSpaceEventSubscriber(viewer.value)
	cursorPositionSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => {
		const ellipsoidPosition = viewer.value.scene.camera.pickEllipsoid(endPosition, viewer.value.scene.globe.ellipsoid)
		if (!ellipsoidPosition) return
		const cartographic = Cartographic.fromCartesian(ellipsoidPosition)
		longitude.value = CesiumMath.toDegrees(cartographic.longitude)
		latitude.value = CesiumMath.toDegrees(cartographic.latitude)
		ellipsoidHeight.value = cartographic.height
		const terrainPosition = viewer.value.scene.globe.pick(
			new Ray(viewer.value.scene.camera.positionWC, ellipsoidPosition),
			viewer.value.scene,
		)
		if (!terrainPosition) return
		terrainHeight.value = Cartographic.fromCartesian(terrainPosition).height
	})
}
// #endregion

// #region 比例尺
const SCALE_VALUE_LIST = [
	5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000,
	500000, 1000000, 2000000, 3000000, 5000000, 10000000, 20000000, 30000000, 50000000,
]
const scale = ref({ width: '0px', unit: '', value: 0 })

function initScale() {
	viewer.value.scene.camera.changed.addEventListener(updateScale)
}

function updateScale() {
	const center = new Cartesian2(viewer.value.scene.canvas.width / 2, viewer.value.scene.canvas.height / 2)
	const startPosition = viewer.value.scene.globe.pick(viewer.value.camera.getPickRay(center), viewer.value.scene)
	if (!startPosition) return
	const endPosition = viewer.value.scene.camera.pickEllipsoid(
		new Cartesian2(center.x + 100, center.y),
		viewer.value.scene.globe.ellipsoid,
	)
	if (!endPosition) return
	const distance = Cartesian3.distance(startPosition, endPosition)
	const standardValue = findStandardValue(distance)
	scale.value = {
		width: `${Math.round((100 * standardValue) / distance)}px`,
		unit: standardValue >= 1000 ? 'km' : 'm',
		value: standardValue >= 1000 ? standardValue / 1000 : standardValue,
	}
}

function findStandardValue(value: number) {
	if (value < SCALE_VALUE_LIST[0]) return SCALE_VALUE_LIST[0]
	const length = SCALE_VALUE_LIST.length
	for (let i = 0; i < length; i++) {
		if (value < SCALE_VALUE_LIST[i]) return SCALE_VALUE_LIST[i - 1]
	}
	return SCALE_VALUE_LIST[length - 1]
}
// #endregion

onBeforeUnmount(() => {
	if (cursorPositionSubscriber) {
		cursorPositionSubscriber.destroy()
		cursorPositionSubscriber = null
	}
	viewer.value.scene.camera.changed.removeEventListener(updateScale)
})
</script>

<template>
	<div class="cesium-footer">
		<div class="cesium-footer_prefix">
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
			<NTooltip>
				<template #trigger>
					<div class="scale" :style="{ width: scale.width }" v-show="scale.value > 0">
						<div class="scale_sign" />
						<div class="scale_text">{{ `${scale.value}${scale.unit}` }}</div>
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
