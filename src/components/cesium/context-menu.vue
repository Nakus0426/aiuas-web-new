<script setup lang="ts">
import {
	type DropdownMixedOption,
	type OnUpdateValueImpl as onDropdownSelect,
} from 'naive-ui/es/dropdown/src/interface'
import { useHook } from './hook'
import { EventSubscriber } from '@/commons/cesium-screen-space-event-subscriber'
import { Cartesian3, ScreenSpaceEventType, Math as CesiumMath, Cartographic } from 'cesium'

const { viewer } = useHook()
const message = useMessage()

// #region 显示隐藏
const visible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
let contextMenuCartesian3: Cartesian3
let contextMenuPositionSubscriber: EventSubscriber

function initContextMenu() {
	contextMenuPositionSubscriber = new EventSubscriber(viewer.value)
	contextMenuPositionSubscriber.subscribeEvent(ScreenSpaceEventType.RIGHT_CLICK, ({ position }) => {
		const ray = viewer.value.camera.getPickRay(position)
		if (!ray) return
		contextMenuCartesian3 = viewer.value.scene.globe.pick(ray, viewer.value.scene)
		if (!contextMenuCartesian3) return
		const { left, top } = viewer.value.canvas.getBoundingClientRect()
		contextMenuPosition.value = { x: position.x + left, y: position.y + top }
		visible.value = true
	})
	contextMenuPositionSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, hideContextMenu)
	viewer.value.camera.moveStart.addEventListener(hideContextMenu)
	viewer.value.camera.moveEnd.addEventListener(hideContextMenu)
}

function hideContextMenu() {
	visible.value = false
}
// #endregion

// #region 选项点击
const enum ContextMenuOptionsKeyEnum {
	Copy,
}
const contextMenuOptions: DropdownMixedOption[] = [{ label: '复制坐标', key: ContextMenuOptionsKeyEnum.Copy }]
const { copy } = useClipboard({ legacy: true })

const handleContextMenuSelect: onDropdownSelect = async key => {
	const cartographic = Cartographic.fromCartesian(contextMenuCartesian3)
	let { longitude, latitude, height } = cartographic
	longitude = CesiumMath.toDegrees(longitude)
	latitude = CesiumMath.toDegrees(latitude)
	if (key === ContextMenuOptionsKeyEnum.Copy) {
		await copy(`${longitude},${latitude},${height}`)
		message.success('复制成功')
	}
	hideContextMenu()
}
// #endregion

onMounted(() => initContextMenu())

onBeforeUnmount(() => {
	if (contextMenuPositionSubscriber) {
		contextMenuPositionSubscriber.destroy()
		contextMenuPositionSubscriber = null
	}
	viewer.value.camera.moveStart.removeEventListener(hideContextMenu)
	viewer.value.camera.moveEnd.removeEventListener(hideContextMenu)
})
</script>

<template>
	<NDropdown
		placement="bottom-start"
		trigger="manual"
		:show="visible"
		:x="contextMenuPosition.x"
		:y="contextMenuPosition.y"
		:options="contextMenuOptions"
		@select="handleContextMenuSelect"
	/>
</template>

<style scoped lang="scss"></style>
