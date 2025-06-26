<script setup lang="ts">
import { useProvideHook } from '@/components/cesium/hook'
import Footer from './footer.vue'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const { footer = true } = defineProps<{ footer?: boolean }>()

const containerRef = useTemplateRef('container')

useProvideHook(containerRef)
</script>

<template>
	<div class="cesium">
		<div class="cesium_overlay">
			<div class="cesium_overlay_header">header</div>
			<div class="cesium_overlay_body">
				<div class="cesium_overlay_body_prefix">prefix</div>
				<div class="cesium_overlay_body_center">center</div>
				<div class="cesium_overlay_body_suffix">suffix</div>
			</div>
			<div class="cesium_overlay_footer">footer</div>
		</div>
		<div class="cesium_container" ref="container" />
		<Footer />
	</div>
</template>

<style scoped lang="scss">
.cesium {
	position: relative;
	width: 100%;
	height: 100%;

	&_overlay {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		pointer-events: none;
		display: grid;
		grid-template-rows: auto 1fr auto;

		&_header {
			grid-row: 1;
		}

		&_body {
			grid-row: 2;
			display: grid;
			grid-template-columns: auto 1fr auto;

			&_prefix {
				grid-column: 1;
			}

			&_center {
				grid-column: 2;
			}

			&_suffix {
				grid-column: 3;
			}
		}

		&_footer {
			grid-row: 3;
		}
	}

	&_container {
		width: 100%;
		height: 100%;

		:deep(.cesium-viewer-bottom) {
			display: none;
		}
	}
}
</style>
