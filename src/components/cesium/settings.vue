<script setup lang="ts"></script>

<template>
	<div class="settings">
		<NTooltip>
			<template #trigger>
				<button class="settings-button">
					<Icon width="24" height="24" icon="tabler:ruler-measure" />
				</button>
			</template>
			设置
		</NTooltip>
	</div>
</template>

<style scoped lang="scss">
.settings {
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

		&:hover {
			background-color: var(--hover-color);
		}
	}
}
</style>
