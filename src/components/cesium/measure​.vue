<script setup lang="ts">
import { CesiumDrawer, DrawMode, Event, type EventHandler } from '@/commons/cesium-drawer'
import { useHook } from './hook'
import { AnimatePresence, Motion } from 'motion-v'
import { NumberUtil } from '@/commons/number-util'

const { id, measureActived, viewer } = useHook()

watchOnce(viewer, value => {
	drawer = new CesiumDrawer(id, value, isDistance.value ? DrawMode.Polyline : DrawMode.Polygon)
})

// #region 初始化工具
const enum Mode {
	Distance,
	Area,
}
const mode = ref(Mode.Distance)
const isDistance = computed(() => mode.value === Mode.Distance)
let drawer: CesiumDrawer
let callbackId: string

function init() {
	measureActived.value = true
	drawer.activate()
	callbackId = drawer.on(isDistance.value ? Event.Polyline : Event.Polygon, handleDrawUpdate)
}

function exit() {
	measureActived.value = false
	drawer.off(callbackId)
	drawer.deactivate()
}

function handleModeUpdate() {
	drawer.deactivate()
	drawer = new CesiumDrawer(id, viewer.value, isDistance.value ? DrawMode.Polyline : DrawMode.Polygon)
	init()
}

watch(measureActived, value => (value ? init() : exit()))
// #endregion

const distanceDefault = '- 米'
const areaDefault = '- 平方米'
const distance = ref(distanceDefault)
const area = ref(areaDefault)

function handleDrawUpdate({
	entity,
	distance: _distance,
	area: _area,
}: EventHandler.PolylineEvent & EventHandler.PolygonEvent) {
	if (isDistance.value) distance.value = NumberUtil.formatDistance(_distance)
	else area.value = NumberUtil.formatArea(_area)
	console.log(_area)
}

function handleResetClick() {
	drawer.reset()
	distance.value = distanceDefault
	area.value = areaDefault
}

function handleUndoClick() {
	drawer.undo()
}
</script>

<template>
	<div class="measure">
		<NTooltip>
			<template #trigger>
				<button class="measure-button" :actived="measureActived" @click="measureActived = !measureActived">
					<Icon width="24" height="24" icon="tabler:ruler-measure" />
				</button>
			</template>
			测量工具
		</NTooltip>
		<Teleport defer :to="`#${id}`">
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
							<Icon icon="tabler:ruler-measure" />
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
						</NTabPane>
					</NTabs>
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
		gap: 4px;
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
			gap: 4px;

			.tip {
				color: var(--text-color-3);
			}

			div {
				display: flex;
				justify-content: space-between;
			}
		}
	}
}
</style>
