<script setup lang="ts">
import { useOverlayScrollbars } from 'overlayscrollbars-vue'
import { type OverflowBehavior } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'

const { x = 'hidden', y = 'scroll' } = defineProps<{ x?: OverflowBehavior; y?: OverflowBehavior }>()

const containerRef = useTemplateRef('container')
const [init, instance] = useOverlayScrollbars({
	options: {
		scrollbars: { autoHide: 'leave', clickScroll: 'instant' },
		overflow: { x, y },
	},
})
onMounted(() => init({ target: containerRef.value, elements: { viewport: containerRef.value } }))
</script>

<template>
	<div ref="container">
		<slot name="default" />
	</div>
</template>

<style scoped lang="scss"></style>
