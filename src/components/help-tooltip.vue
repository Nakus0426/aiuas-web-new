<script setup lang="ts">
import { upperFirst } from 'es-toolkit'

const { size = 'medium' } = defineProps<{ size?: 'small' | 'medium' | 'large' }>()

const themeVars = useThemeVars()

const iconSize = computed(() => `${parseFloat(themeVars.value[`fontSize${upperFirst(size)}`]) + 2}px`)
</script>

<template>
	<NTooltip>
		<template #trigger>
			<Icon class="help-tooltip" icon="tabler:help" :height="iconSize" :width="iconSize" />
		</template>
		<slot />
	</NTooltip>
</template>

<style scoped lang="scss">
.help-tooltip {
	color: var(--icon-color);
	cursor: help;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);

	&:hover {
		color: var(--icon-color-hover);
	}
}
</style>
