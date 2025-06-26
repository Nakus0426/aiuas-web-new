<script setup lang="ts">
import { useProvideHook } from '@/components/cesium/hook'
import Footer from './footer.vue'
import Controls from './controls.vue'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const { footer = true } = defineProps<{ footer?: boolean }>()

const containerRef = useTemplateRef('container')

useProvideHook(containerRef)
</script>

<template>
	<div class="cesium">
		<div class="cesium_container" ref="container" />
		<Controls />
		<Footer v-if="footer" />
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
}
</style>
