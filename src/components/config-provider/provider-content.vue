<script setup lang="ts">
window.$loadingBar = useLoadingBar()
window.$message = useMessage()
window.$notification = useNotification()
window.$dialog = useDialog()
window.$modal = useModal()
</script>

<template>
	<slot />
</template>

<style scoped lang="scss"></style>
