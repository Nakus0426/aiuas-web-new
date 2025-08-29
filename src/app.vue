<script setup lang="ts">
import { useAppStore } from './stores/modules/app'

useAppStore().init()
</script>

<template>
	<ConfigProvider>
		<RouterView />
	</ConfigProvider>
</template>

<style scoped></style>
