<script setup lang="ts">
import { CesiumDrawer, DrawMode, Event, type EventHandler } from '@/commons/cesium-drawer'
import { EventSubscriber } from '@/commons/cesium-screen-space-event-subscriber'
import { CesiumUtil } from '@/commons/cesium-util'
import { NumberUtil } from '@/commons/number-util'
import {
	Cartesian3,
	Color,
	CustomDataSource,
	HeightReference,
	Rectangle,
	ScreenSpaceEventType,
	clone as cesiumClone,
	sampleTerrainMostDetailed,
	type Entity,
} from 'cesium'
import { AnimatePresence, Motion } from 'motion-v'
import { useHook } from './hook'

const { id, measureActived, viewer } = useHook()
const themeVars = useThemeVars()

// #region 初始化
const enum Mode {
	Distance,
	Area,
}
const mode = ref(Mode.Distance)
const isDistance = computed(() => mode.value === Mode.Distance)
let drawer: CesiumDrawer
let callbackId: string

function enter() {
	measureActived.value = true
	drawer = new CesiumDrawer(id, viewer.value, isDistance.value ? DrawMode.Polyline : DrawMode.Polygon)
	drawer.activate()
	callbackId = drawer.on(isDistance.value ? Event.Polyline : Event.Polygon, handleDrawUpdate)
}

function exit() {
	measureActived.value = false
	drawer.off(callbackId)
	drawer.deactivate()
	drawer = null
}

function handleModeUpdate() {
	drawer.off(callbackId)
	drawer.deactivate()
	drawer = null
	enter()
}

watch(measureActived, value => (value ? enter() : exit()))
// #endregion

// #region 绘制事件
const distanceDefault = '- 米'
const areaDefault = '- 平方米'
const distance = ref(distanceDefault)
const area = ref(areaDefault)
const perimeter = ref(distanceDefault)
const enum TempEntityTypeEnum {
	Polyline,
	Polygon,
}
let tempEntity: { type: TempEntityTypeEnum; entity: Entity }

function handleDrawUpdate({
	entity,
	distance: _distance,
	area: _area,
	perimeter: _perimeter,
}: EventHandler.PolylineEvent & EventHandler.PolygonEvent) {
	tempEntity = {
		type: isDistance.value ? TempEntityTypeEnum.Polyline : TempEntityTypeEnum.Polygon,
		entity: cesiumClone(entity),
	}
	if (isDistance.value) distance.value = NumberUtil.formatDistance(_distance)
	else {
		area.value = NumberUtil.formatArea(_area)
		perimeter.value = NumberUtil.formatDistance(_perimeter)
	}
}

function handleResetClick() {
	drawer.reset()
	distance.value = distanceDefault
	area.value = areaDefault
	perimeter.value = distanceDefault
}

function handleUndoClick() {
	drawer.undo()
}
// #endregion

// #region 保存
let eventSubscriber: EventSubscriber
let entityDataSource = new CustomDataSource()
let tooltipElement: HTMLDivElement
let cesiumUtil: CesiumUtil

function initMouseHoverHandler() {
	eventSubscriber = new EventSubscriber(viewer.value)
	tooltipElement = document.createElement('div')
	tooltipElement.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			display: block;
			visibility: hidden;
			opacity: 0;
			transition: opacity 0.2s var(--cubic-bezier-ease-in-out);
			border-radius: var(--border-radius);
			background-color: #262626;
			color: var(--base-color);
			font-size: var(--font-size-small);
			padding: 2px 8px;
			box-shadow: var(--box-shadow-2);
			pointer-events: none;
		`
	document.getElementById(id).appendChild(tooltipElement)
	eventSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => {
		const pick = viewer.value.scene.pick(endPosition)
		const { tooltip } = pick?.id?.properties?.getValue() ?? {}
		if (!tooltip) {
			tooltipElement.style.visibility = 'hidden'
			tooltipElement.style.opacity = '0'
			return
		}
		const { x, y } = viewer.value.scene.cartesianToCanvasCoordinates(pick.id.position.getValue())
		const { top, left } = viewer.value.canvas.getBoundingClientRect()
		tooltipElement.innerText = tooltip
		tooltipElement.style.visibility = 'visible'
		tooltipElement.style.opacity = '1'
		tooltipElement.style.transform = `translate3d(${left + x}px, calc(${top + y}px - 100%), 0)`
	})
}

async function handleSaveClick() {
	const { type, entity } = tempEntity
	const { infoColor } = themeVars.value
	const color = Color.fromCssColorString(infoColor)
	if (type === TempEntityTypeEnum.Polyline) {
		const positions = entity.polyline.positions.getValue()
		entityDataSource.entities.add({
			polyline: {
				positions,
				material: color,
				width: 4,
				clampToGround: true,
			},
		})
		let totalDistance = 0
		positions.forEach(async (item, index) => {
			const pointEntity = entityDataSource.entities.add({
				position: item,
				point: {
					color,
					pixelSize: 8,
					outlineWidth: 2,
					outlineColor: Color.WHITE,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				properties: {},
			})
			if (index === 0) return pointEntity.properties.addProperty('tooltip', '起点')
			const distance = await cesiumUtil.groundDistance([item, positions[index - 1]])
			totalDistance += distance
			pointEntity.properties.addProperty('tooltip', NumberUtil.formatDistance(totalDistance))
		})
		return
	}
	const hierarchy = entity.polygon.hierarchy.getValue()
	const positions = [...hierarchy.positions, hierarchy.positions[0]]
	const rectangle = Rectangle.fromCartesianArray(hierarchy.positions)
	const centerCartographic = Rectangle.center(rectangle)
	const centerCartographicWithHeight = await sampleTerrainMostDetailed(viewer.value.terrainProvider, [
		centerCartographic,
	])
	const polygonEntity = entityDataSource.entities.add({
		position: Cartesian3.fromRadians(
			centerCartographic.longitude,
			centerCartographic.latitude,
			centerCartographicWithHeight[0].height,
		),
		polygon: {
			hierarchy,
			material: color.withAlpha(0.5),
			heightReference: HeightReference.CLAMP_TO_GROUND,
		},
		polyline: {
			positions,
			width: 4,
			material: color,
			clampToGround: true,
		},
		properties: {},
	})
	const area = await cesiumUtil.groundPolygonArea(positions)
	polygonEntity.properties.addProperty('tooltip', NumberUtil.formatArea(area))
}
// #endregion

const popoverTeleportDisable = ref(true)

onMounted(() => {
	viewer.value.dataSources.add(entityDataSource)
	cesiumUtil = new CesiumUtil(viewer.value)
	initMouseHoverHandler()
	popoverTeleportDisable.value = false
})

onBeforeUnmount(() => {
	if (drawer) {
		drawer.off(callbackId)
		drawer.deactivate()
		drawer = null
	}
	if (eventSubscriber) {
		eventSubscriber.destroy()
		eventSubscriber = null
	}
	if (entityDataSource) {
		viewer.value.dataSources.remove(entityDataSource, true)
		entityDataSource = null
	}
	if (tooltipElement) {
		tooltipElement.remove()
		tooltipElement = null
	}
})
</script>

<template>
	<div class="measure">
		<NTooltip>
			<template #trigger>
				<button class="measure-button" :actived="measureActived" @click="measureActived = !measureActived">
					<Icon width="24" height="24" icon="gis:measure" />
				</button>
			</template>
			测量工具
		</NTooltip>
		<Teleport defer :to="`#${id}`" :disabled="popoverTeleportDisable">
			<AnimatePresence>
				<Motion
					class="measure-popover"
					:initial="{ opacity: 0, transform: 'translateX(100%)' }"
					:exit="{ opacity: 0, transform: 'translateX(100%)' }"
					:animate="{ opacity: 1, transform: 'translateX(0)' }"
					:transition="{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }"
					v-if="measureActived"
				>
					<div class="measure-popover_header">
						<div class="measure-popover_header_prefix">
							<Icon icon="gis:measure" />
							<span>测量工具</span>
						</div>
						<div class="measure-popover_header_suffix">
							<NTooltip>
								<template #trigger>
									<NButton quaternary circle size="small" @click="handleResetClick()">
										<template #icon>
											<Icon icon="tabler:reload" />
										</template>
									</NButton>
								</template>
								重新开始
							</NTooltip>
							<NTooltip>
								<template #trigger>
									<NButton
										quaternary
										circle
										size="small"
										:disabled="!drawer.undoAvailable.value"
										@click="handleUndoClick()"
									>
										<template #icon>
											<Icon icon="tabler:arrow-back-up" />
										</template>
									</NButton>
								</template>
								撤销
							</NTooltip>
							<NTooltip>
								<template #trigger>
									<NButton quaternary circle size="small" type="error" @click="measureActived = false">
										<template #icon>
											<Icon icon="tabler:x" />
										</template>
									</NButton>
								</template>
								退出
							</NTooltip>
						</div>
					</div>
					<NTabs
						type="segment"
						size="small"
						animated
						pane-class="measure-popover_body"
						v-model:value="mode"
						@update:value="handleModeUpdate"
					>
						<NTabPane tab="距离" :name="Mode.Distance">
							<span class="tip">在地图上点击多个点，测量距离</span>
							<div>
								<span>距离：</span>
								<span>{{ distance }}</span>
							</div>
						</NTabPane>
						<NTabPane tab="面积" :name="Mode.Area">
							<span class="tip">在地图上点击多个点，测量面积</span>
							<div>
								<span>面积：</span>
								<span>{{ area }}</span>
							</div>
							<div>
								<span>周长：</span>
								<span>{{ perimeter }}</span>
							</div>
						</NTabPane>
					</NTabs>
					<div class="measure-popover_footer">
						<NButton size="small" type="primary" @click="handleSaveClick()">
							<template #icon>
								<Icon icon="mdi:content-save-outline" />
							</template>
							保存
						</NButton>
					</div>
				</Motion>
			</AnimatePresence>
		</Teleport>
	</div>
</template>

<style scoped lang="scss">
.measure {
	&-button {
		width: 40px;
		height: 40px;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: var(--card-color);
		border-radius: 20px;
		box-shadow: var(--box-shadow-1);
		border: none;
		cursor: pointer;
		transition: all 0.2s var(--cubic-bezier-ease-in-out);
		font-size: 20px;
		color: var(--text-color-2);
		pointer-events: all;

		&[actived='true'] {
			background-color: var(--primary-color);
			color: var(--base-color);

			&:hover {
				background-color: var(--primary-color-hover);
			}
		}

		&:hover {
			background-color: var(--hover-color);
		}
	}

	&-popover {
		position: absolute;
		top: 20px;
		right: 20px;
		width: 250px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-radius: var(--border-radius);
		box-shadow: var(--box-shadow-1);
		background-color: var(--card-color);
		padding: 8px;

		&_header {
			display: flex;
			justify-content: space-between;
			font-size: var(--font-size-large);

			&_prefix {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: var(--font-size-large);
				font-weight: bold;
			}

			&_suffix {
				display: flex;
				align-items: center;
				gap: 4px;
			}
		}

		&_body {
			display: flex;
			flex-direction: column;
			gap: 8px;

			.tip {
				color: var(--text-color-3);
			}

			div {
				display: flex;
				justify-content: space-between;
			}
		}

		&_footer {
			padding-top: 8px;
		}
	}
}
</style>
