<script setup lang="ts">
import { useAppStore } from './stores/modules/app'

useAppStore().init()
</script>

<template>
	<ConfigProvider>
		<Cesium />
	</ConfigProvider>
</template>

<style scoped></style>
