<script setup lang="ts">
import { TinyColor } from '@ctrl/tinycolor'

const {
	content,
	disabled = false,
	shinyColor,
} = defineProps<{ content: string; disabled?: boolean; shinyColor?: string }>()

const themeVars = useThemeVars()

const backgroundImage = computed(() => {
	const color = new TinyColor(shinyColor ?? themeVars.value.textColorBase)
	const colorStop1 = color.setAlpha(0).toRgbString()
	const colorStop2 = color.setAlpha(1).toRgbString()
	return `linear-gradient(
		120deg,
		${colorStop1} 40%,
		${colorStop2} 50%,
		${colorStop1} 60%
	)`
})
</script>

<template>
	<div class="shiny-text" :disabled>
		{{ content }}
	</div>
</template>

<style scoped lang="scss">
.shiny-text {
	color: var(--text-color-3);
	background-image: v-bind('backgroundImage');
	background-size: 200% 100%;
	-webkit-background-clip: text;
	background-clip: text;
	animation: shine 5s linear infinite;
	animation-duration: 3s;

	&[disabled='true'] {
		animation: none;
		background-image: none;
	}
}

@keyframes shine {
	0% {
		background-position: 100%;
	}
	100% {
		background-position: -100%;
	}
}
</style>
