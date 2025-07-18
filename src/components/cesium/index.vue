<script setup lang="ts">
import { useProvideHook } from '@/components/cesium/hook'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import ContextMenu from './context-menu.vue'
import Search from './search.vue'
import Layers from './layers.vue'
import Measure from './measure​.vue'
import Settings from './settings.vue'
import { ControlsProps, FooterProps } from './types'
import { merge } from 'es-toolkit'

const { footerOption, controlsOption } = defineProps<{
	footerOption?: FooterProps
	controlsOption?: ControlsProps
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
		<ContextMenu />
		<div class="cesium-toolbar">
			<Search />
			<Layers />
			<!-- <Measure /> -->
			<Settings />
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
