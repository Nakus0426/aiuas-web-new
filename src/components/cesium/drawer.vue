<script setup lang="ts">
import { useHook } from './hook'
import { AnimatePresence, Motion } from 'motion-v'
import { CesiumDrawer, DrawMode, Event, type EventHandler } from '@/commons/cesium-drawer'

const { id, drawerActived, viewer } = useHook()
const themeVars = useThemeVars()

// #region 初始化
const mode = ref(DrawMode.Ellipse)
let drawer: CesiumDrawer
let callbackId: string

function enter() {
	drawerActived.value = true
	drawer = new CesiumDrawer(id, viewer.value, mode.value)
	const drawModeEventMap = {
		[DrawMode.Point]: Event.Point,
		[DrawMode.Polyline]: Event.Polyline,
		[DrawMode.Polygon]: Event.Polygon,
		[DrawMode.Ellipse]: Event.Ellipse,
	}
	drawer.on(drawModeEventMap[mode.value], handleDrawUpdate)
	drawer.activate()
}

function exit() {
	drawerActived.value = false
	drawer.off(callbackId)
	drawer.deactivate()
}

function handleModeUpdate(newMode: DrawMode) {
	mode.value = newMode
	drawer.off(callbackId)
	drawer.deactivate()
	drawer = null
	enter()
}

watch(drawerActived, value => (value ? enter() : exit()))
// #endregion

// #region 绘制事件
function handleDrawUpdate({
	entity,
	distance: _distance,
	area: _area,
	radius: _radius,
	perimeter: _perimeter,
}: EventHandler.PointEvent & EventHandler.PolylineEvent & EventHandler.PolygonEvent & EventHandler.EllipseEvent) {}

function handleResetClick() {
	drawer.reset()
}

function handleUndoClick() {
	drawer.undo()
}
// #endregion

// #region 保存
function handleSaveClick() {}
// #endregion

const popoverTeleportDisable = ref(true)

onMounted(async () => {
	popoverTeleportDisable.value = false
})

onBeforeUnmount(() => {
	if (drawer) {
		drawer.off(callbackId)
		drawer.deactivate()
		drawer = null
	}
})
</script>

<template>
	<div class="drawer">
		<NTooltip>
			<template #trigger>
				<button class="drawer-button" :actived="drawerActived" @click="drawerActived = !drawerActived">
					<Icon width="24" height="24" icon="gis:polygon-pt" />
				</button>
			</template>
			绘制工具
		</NTooltip>
		<Teleport defer :to="`#${id}`" :disabled="popoverTeleportDisable">
			<AnimatePresence>
				<Motion
					class="drawer-popover"
					:initial="{ opacity: 0, transform: 'translateX(100%)' }"
					:exit="{ opacity: 0, transform: 'translateX(100%)' }"
					:animate="{ opacity: 1, transform: 'translateX(0)' }"
					:transition="{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }"
					v-if="drawerActived"
				>
					<div class="drawer-popover_header">
						<div class="drawer-popover_header_prefix">
							<Icon icon="gis:polygon-pt" />
							<span>绘制工具</span>
						</div>
						<div class="drawer-popover_header_suffix">
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
									<NButton quaternary circle size="small" type="error" @click="drawerActived = false">
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
						pane-class="drawer-popover_body"
						v-model:value="mode"
						@update:value="handleModeUpdate"
					>
						<NTabPane tab="点" :name="DrawMode.Point">
							<span class="tip">在地图上点击多个点，绘制</span>
							<!-- <div>
								<span>距离：</span>
								<span>{{ distance }}</span>
							</div> -->
						</NTabPane>
						<NTabPane tab="线" :name="DrawMode.Polyline">
							<span class="tip">在地图上点击多个点，测量面积</span>
							<!-- <div>
								<span>面积：</span>
								<span>{{ area }}</span>
							</div> -->
						</NTabPane>
						<NTabPane tab="面" :name="DrawMode.Polygon">
							<span class="tip">在地图上点击多个点，测量周长</span>
							<!-- <div>
								<span>周长：</span>
								<span>{{ perimeter }}</span>
							</div> -->
						</NTabPane>
						<NTabPane tab="圆" :name="DrawMode.Ellipse">
							<span class="tip">在地图上点击多个点，绘制</span>
							<!-- <div>
								<span>距离：</span>
								<span>{{ distance }}</span>
							</div> -->
						</NTabPane>
					</NTabs>
					<div class="drawer-popover_footer">
						<NButton size="small" type="primary" @click="handleSaveClick()">
							<template #icon>
								<Icon icon="tabler:flag-3" />
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
.drawer {
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
