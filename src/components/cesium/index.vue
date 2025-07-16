<script setup lang="ts">
import { useProvideHook } from '@/components/cesium/hook'
import Footer from './footer.vue'
import Controls from './controls.vue'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import ContextMenu from './context-menu.vue'
import Search from './search.vue'
import Layers from './layers.vue'
import Measure from './measure​.vue'

const { footer = true } = defineProps<{ footer?: boolean }>()

const containerRef = useTemplateRef('container')

const { id, flyToPosition, flyToTarget } = useProvideHook(containerRef)

defineExpose({ flyToPosition, flyToTarget })
</script>

<template>
	<div class="cesium" :id>
		<div class="cesium_container" ref="container" />
		<Controls />
		<Footer v-if="footer" />
		<ContextMenu />
		<div class="cesium-toolbar">
			<Search />
			<Layers />
			<Measure />
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
