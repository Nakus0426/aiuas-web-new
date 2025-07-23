<script setup lang="ts">
import { useProvideHook } from '@/components/cesium/hook'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { merge } from 'es-toolkit'
import type {
	ContextMenuProps,
	ControlsProps,
	DrawerProps,
	FooterProps,
	LayersProps,
	MeasureProps,
	SearchProps,
} from './types'

const { footerOption, controlsOption, contextMenuOption, searchOption, layersOption, measureOption, drawerOption } =
	defineProps<{
		footerOption?: FooterProps
		controlsOption?: ControlsProps
		contextMenuOption?: ContextMenuProps
		searchOption?: SearchProps
		layersOption?: LayersProps
		measureOption?: MeasureProps
		drawerOption?: DrawerProps
	}>()

const containerRef = useTemplateRef('container')
const { id, viewer, init, flyToPosition, flyToTarget } = useProvideHook(containerRef)

const mergedFooterOption = computed(() => merge({ enable: true }, footerOption || {}))
const Footer = computed(() =>
	mergedFooterOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./footer.vue')) : null,
)

const mergedControlsOption = computed(() => merge({ enable: true }, controlsOption || {}))
const Controls = computed(() =>
	mergedControlsOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./controls.vue')) : null,
)

const mergedContextMenuOption = computed(() => merge({ enable: true }, contextMenuOption || {}))
const ContextMenu = computed(() =>
	mergedContextMenuOption.value.enable && viewer.value
		? defineAsyncComponent(() => import('./context-menu.vue'))
		: null,
)

const mergedSearchOption = computed(() => merge({ enable: true }, searchOption || {}))
const Search = computed(() =>
	mergedSearchOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./search.vue')) : null,
)

const mergedLayersOption = computed(() => merge({ enable: true }, layersOption || {}))
const Layers = computed(() =>
	mergedLayersOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./layers.vue')) : null,
)

const mergedMeasureOption = computed(() => merge({ enable: true }, measureOption || {}))
const Measure = computed(() =>
	mergedMeasureOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./measure​.vue')) : null,
)

const mergedDrawerOption = computed(() => merge({ enable: true }, drawerOption || {}))
const Drawer = computed(() =>
	mergedDrawerOption.value.enable && viewer.value ? defineAsyncComponent(() => import('./drawer.vue')) : null,
)

onMounted(async () => {
	await nextTick()
	init()
})

defineExpose({ flyToPosition, flyToTarget })
</script>

<template>
	<div class="cesium" :id>
		<div class="cesium_container" ref="container" />
		<component v-bind="mergedControlsOption" :is="Controls" v-if="Controls" />
		<component v-bind="mergedFooterOption" :is="Footer" v-if="Footer" />
		<component v-bind="mergedContextMenuOption" :is="ContextMenu" v-if="Footer" />
		<div class="cesium-toolbar">
			<component v-bind="mergedSearchOption" :is="Search" v-if="Search" />
			<component v-bind="mergedLayersOption" :is="Layers" v-if="Layers" />
			<component v-bind="mergedMeasureOption" :is="Measure" v-if="Measure" />
			<component v-bind="mergedDrawerOption" :is="Drawer" v-if="Drawer" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.cesium {
	position: relative;
	width: 100%;
	height: 100%;

	&_container {
		width: 100%;
		height: 100%;

		:deep(.cesium-viewer-bottom) {
			display: none;
		}
	}

	&-toolbar {
		position: absolute;
		top: 20px;
		left: 20px;
		display: flex;
		gap: 10px;
		pointer-events: none;
	}
}
</style>
