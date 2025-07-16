import {
	Cartesian2,
	Cartesian3,
	Entity,
	HeadingPitchRange,
	HeightReference,
	HorizontalOrigin,
	ScreenSpaceEventType,
	VerticalOrigin,
	Viewer,
	Math as CesiumMath,
	sampleTerrainMostDetailed,
	Cartographic,
	Color,
	CallbackProperty,
	CallbackPositionProperty,
	ConstantProperty,
	CustomDataSource,
} from 'cesium'
import { EventSubscriber } from './cesium-screen-space-event-subscriber'
import { nanoid } from 'nanoid'
import { useLocationIcon } from '@/hooks/use-dynamic-svg'
import { isNotNil } from 'es-toolkit'

export const enum DrawMode {
	Polyline,
	Polygon,
	Point,
	Ellipse,
}

export const enum Event {
	MouseMove,
	Point,
	Polyline,
	Polygon,
}

export namespace EventHandler {
	export interface MouseMoveEvent {
		screenPosition: Cartesian2
		position: Cartesian3
	}

	export interface PointEvent {
		entity: Entity
		position: Cartesian3
	}

	export interface PolylineEvent {
		entity: Entity
		positions: Cartesian3[]
		distances: number[]
		distance: number
	}

	export interface PolygonEvent {
		entity: Entity
		positions: Cartesian3[]
		area: number
	}

	export type MouseMoveEventCallback = (event: MouseMoveEvent) => void

	export type PointEventCallback = (event: PointEvent) => void

	export type PolylineEventCallback = (event: PolylineEvent) => void

	export type PolygonEventCallback = (event: PolygonEvent) => void

	export type Callback = MouseMoveEventCallback | PointEventCallback | PolylineEventCallback | PolygonEventCallback

	export interface Handler {
		id: string
		event: Event
		callback: Callback
	}
}

export class CesiumDrawer {
	private id: string
	private viewer: Viewer
	private mode: DrawMode
	private eventSubscriber: EventSubscriber
	private eventHandlers: EventHandler.Handler[] = []
	private tooltip: HTMLDivElement
	private tempTooltip: HTMLDivElement
	private isTooltipUpdating = false
	private activeDrawer: { destroy: Function; undo?: Function }
	private COLOR = {
		Primary: Color.fromCssColorString('#783178'),
		Default: Color.fromCssColorString('#333639'),
		Error: Color.fromCssColorString('#d03050'),
		Info: Color.fromCssColorString('#2080f0'),
		Success: Color.fromCssColorString('#18a058'),
		Warning: Color.fromCssColorString('#f0a020'),
	}
	undoAvailable = ref(false)

	constructor(id: string, viewer: Viewer, mode: DrawMode) {
		this.id = id
		this.viewer = viewer
		this.mode = mode
	}

	/**
	 * 激活
	 */
	activate() {
		this.initTooltip()
		this.initTempTooltip()
		this.eventSubscriber = new EventSubscriber(this.viewer)
		this.initMouseMoveEvent()
		if (this.mode === DrawMode.Point) this.activeDrawer = this.initPointDrawer()
		if (this.mode === DrawMode.Polyline) this.activeDrawer = this.initPolylineDrawer()
	}

	/**
	 * 禁用
	 */
	deactivate() {
		this.destroyTooltip()
		this.destroyTempTooltip()
		this.eventSubscriber.destroy()
		this.eventSubscriber = null
		this.viewer.canvas.style.cursor = 'default'
		this.activeDrawer.destroy()
	}

	/**
	 * 撤销
	 */
	undo() {
		if (!this.undoAvailable.value) return
		this.activeDrawer?.undo?.()
	}

	/**
	 * 重置
	 */
	reset() {
		this.deactivate()
		this.activate()
	}

	/**
	 * 订阅事件
	 * @param event 事件类型
	 * @param callback 回调函数
	 * @returns 订阅ID
	 */
	on(event: Event, callback: EventHandler.Callback) {
		const id = nanoid()
		this.eventHandlers.push({ id, event, callback })
		return id
	}

	/**
	 * 取消订阅
	 * @param id 订阅ID
	 */
	off(id: string) {
		const index = this.eventHandlers.findIndex(item => item.id === id)
		if (index < 0) return
		this.eventHandlers.splice(index, 1)
	}

	/**
	 * 初始化鼠标移动事件
	 */
	private initMouseMoveEvent() {
		const { left, top } = this.viewer.canvas.getBoundingClientRect()
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => {
			if (!this.isTooltipUpdating) {
				this.isTooltipUpdating = true
				requestAnimationFrame(() =>
					this.updateTooltip({ position: { top: endPosition.y + top + 4, left: endPosition.x + left + 4 } }),
				)
			}
			const ray = this.viewer.scene.camera.getPickRay(endPosition)
			if (!ray) return
			const cartesian3 = this.viewer.scene.globe.pick(ray, this.viewer.scene)
			this.eventHandlers.forEach(({ event, callback }) => {
				if (event === Event.MouseMove)
					(callback as EventHandler.MouseMoveEventCallback)({ screenPosition: endPosition, position: cartesian3 })
			})
		})
	}

	/**
	 * 初始化提示信息
	 */
	private initTooltip() {
		this.tooltip = document.createElement('div')
		this.tooltip.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			display: none;
			border-radius: var(--border-radius);
			background-color: var(--warning-color);
			font-size: var(--font-size-small);
			padding: 2px 8px;
			box-shadow: var(--box-shadow-2);
			pointer-events: none;
		`
		document.getElementById(this.id).appendChild(this.tooltip)
	}

	/**
	 * 销毁提示信息
	 */
	private destroyTooltip() {
		if (!this.tooltip) return
		this.tooltip.remove()
		this.tooltip = null
	}

	/**
	 * 更新提示信息
	 * @param text 提示文本
	 * @param position 位置
	 * @param visible 是否可见
	 */
	private updateTooltip({
		text,
		position,
		visible,
	}: {
		text?: string
		position?: { top: number; left: number }
		visible?: boolean
	}) {
		if (!this.tooltip) return
		if (isNotNil(visible)) this.tooltip.style.display = visible ? 'block' : 'none'
		if (position) this.tooltip.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
		if (text) this.tooltip.innerText = text
		this.isTooltipUpdating = false
	}

	/**
	 * 初始化临时提示信息
	 */
	private initTempTooltip() {
		this.tempTooltip = document.createElement('div')
		this.tempTooltip.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			display: block;
			visibility: hidden;
			opacity: 0;
			transition: opacity 0.2s var(--cubic-bezier-ease-in-out);
			border-radius: var(--border-radius);
			background-color: #262626;
			color: var(--base-color);
			font-size: var(--font-size-small);
			padding: 2px 8px;
			box-shadow: var(--box-shadow-2);
			pointer-events: none;
		`
		document.getElementById(this.id).appendChild(this.tempTooltip)
	}

	/**
	 * 销毁临时提示信息
	 */
	private destroyTempTooltip() {
		if (!this.tempTooltip) return
		this.tempTooltip.remove()
		this.tempTooltip = null
	}

	/**
	 * 更新临时提示信息
	 * @param text 提示文本
	 * @param position 位置
	 * @param visible 是否可见
	 */
	private updateTempTooltip({
		text,
		position,
		visible,
	}: {
		text?: string
		position?: { top: number; left: number }
		visible?: boolean
	}) {
		if (!this.tempTooltip) return
		if (isNotNil(visible)) {
			this.tempTooltip.style.visibility = visible ? 'visible' : 'hidden'
			this.tempTooltip.style.opacity = visible ? '1' : '0'
		}
		if (position) this.tempTooltip.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
		if (text) this.tempTooltip.innerText = text
	}

	/**
	 * 计算两点的地表距离
	 * @param start 起点坐标
	 * @param end 终点坐标
	 * @returns 距离
	 */
	private async calculateGroundDistance(start: Cartesian3, end: Cartesian3) {
		const cartographicList = await sampleTerrainMostDetailed(this.viewer.terrainProvider, [
			Cartographic.fromCartesian(start),
			Cartographic.fromCartesian(end),
		])
		const points = cartographicList.map(cart => Cartesian3.fromRadians(cart.longitude, cart.latitude, cart.height))
		return Cartesian3.distance(points[0], points[1])
	}

	/**
	 * 格式化距离
	 * @param distance 距离
	 */
	formatDistance(distance: number) {
		const isKm = distance > 1000
		return `${Math.round((distance / (isKm ? 1000 : 1)) * 100) / 100} ${isKm ? '公里' : '米'}`
	}

	/**
	 * 初始化点绘制
	 */
	private initPointDrawer() {
		let pointEntity: Entity
		this.viewer.canvas.style.cursor = 'crosshair'
		this.updateTooltip({ text: '点击绘制点', visible: true })

		// 点击事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, ({ position }) => {
			const ray = this.viewer.scene.camera.getPickRay(position)
			if (!ray) return
			if (pointEntity) this.viewer.entities.remove(pointEntity)
			const cartesian3 = this.viewer.scene.globe.pick(ray, this.viewer.scene)
			pointEntity = this.viewer.entities.add({
				position: cartesian3,
				billboard: {
					image: useLocationIcon().generateStr({ type: 'primary' }),
					heightReference: HeightReference.CLAMP_TO_GROUND,
					horizontalOrigin: HorizontalOrigin.CENTER,
					verticalOrigin: VerticalOrigin.BOTTOM,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
			})

			this.eventHandlers.forEach(({ event, callback }) => {
				if (event === Event.Point)
					(callback as EventHandler.PointEventCallback)({ entity: pointEntity, position: cartesian3 })
			})
		})

		// 销毁绘制
		const destroy = () => {
			if (!pointEntity) return
			this.viewer.entities.remove(pointEntity)
			pointEntity = null
		}

		return { destroy }
	}

	/**
	 * 初始化线绘制
	 */
	private initPolylineDrawer() {
		let isDrawing = true
		const fixedPositions: Cartesian3[] = []
		let vertexEntities = new CustomDataSource('vertexEntities')
		this.viewer.dataSources.add(vertexEntities)
		let midPoints = new CustomDataSource('midPoints')
		this.viewer.dataSources.add(midPoints)
		const distances: number[] = []
		let previewPosition: Cartesian3
		let previewPolyline: Entity
		let activePolyline: Entity
		const history: Cartesian3[] = []
		const drag = {
			isDragging: false,
			nodeIndex: -1,
			startPosition: null,
		}
		const enum EntityTypeEnum {
			Vertex,
			MidPoint,
		}

		this.viewer.camera.flyTo({
			destination: this.viewer.camera.position,
			duration: 0.2,
			orientation: new HeadingPitchRange(this.viewer.camera.heading, CesiumMath.toRadians(-90), 0),
		})
		this.viewer.canvas.style.cursor = 'crosshair'
		this.updateTooltip({ text: '选择起点', visible: true })

		// 获取鼠标坐标
		const getMousePosition = (position: Cartesian2) => {
			const ray = this.viewer.scene.camera.getPickRay(position)
			if (!ray) return
			return this.viewer.scene.globe.pick(ray, this.viewer.scene)
		}

		// 绘制折线
		const createPolyline = () => {
			activePolyline = this.viewer.entities.add({
				polyline: {
					positions: new CallbackProperty(() => fixedPositions, false),
					width: 4,
					material: this.COLOR.Warning,
					clampToGround: true,
				},
			})
		}
		createPolyline()

		// 绘制预览折线
		const createPreviewPolyline = () => {
			previewPolyline = this.viewer.entities.add({
				polyline: {
					positions: new CallbackProperty(
						() =>
							fixedPositions.length > 0 && previewPosition
								? [fixedPositions[fixedPositions.length - 1], previewPosition]
								: [],
						false,
					),
					width: 4,
					material: this.COLOR.Warning.withAlpha(0.5),
					clampToGround: true,
				},
			})
		}
		createPreviewPolyline()

		// 创建顶点
		const createVertexEntity = (index: number) => {
			const entity = vertexEntities.entities.add({
				position: new CallbackPositionProperty(
					() => (index < fixedPositions.length ? fixedPositions[index] : null),
					false,
				),
				point: {
					pixelSize: 14,
					color: Color.WHITE,
					outlineColor: this.COLOR.Warning.withAlpha(0.5),
					outlineWidth: 2,
					heightReference: HeightReference.CLAMP_TO_GROUND,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				properties: { type: EntityTypeEnum.Vertex, index },
			})
			return entity
		}

		// 创建中间点实体
		const createMidPointEntity = (index: number) => {
			const entity = midPoints.entities.add({
				position: new CallbackPositionProperty(
					() =>
						fixedPositions.length > index + 1
							? Cartesian3.midpoint(fixedPositions[index], fixedPositions[index + 1], new Cartesian3())
							: null,
					false,
				),
				point: {
					pixelSize: 8,
					color: Color.WHITE,
					outlineColor: this.COLOR.Warning.withAlpha(0.5),
					outlineWidth: 2,
					heightReference: HeightReference.CLAMP_TO_GROUND,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				properties: { type: EntityTypeEnum.MidPoint, index },
			})
			return entity
		}

		// 更新中间点
		const updateMidPoints = () => {
			midPoints.entities.removeAll()
			if (fixedPositions.length < 2) return
			for (let i = 0; i < fixedPositions.length - 1; i++) createMidPointEntity(i)
		}

		// 抛出事件
		const emitEvent = () => {
			this.eventHandlers.forEach(({ event, callback }) => {
				if (event === Event.Polyline)
					(callback as EventHandler.PolylineEventCallback)({
						entity: activePolyline,
						positions: fixedPositions,
						distances,
						distance: distances.reduce((a, b) => a + b, 0),
					})
			})
		}

		// 重新计算距离
		const recalculateAllDistances = async () => {
			distances.length = 0
			for (let i = 0, len = fixedPositions.length - 1; i < len; i++) {
				const distance = await this.calculateGroundDistance(fixedPositions[i], fixedPositions[i + 1])
				distances.push(distance)
			}
			emitEvent()
		}

		// 撤销
		const undo = () => {
			if (history.length === 0 || fixedPositions.length === 0) return
			history.pop()
			fixedPositions.pop()
			const vertexEntitiesLength = vertexEntities.entities.values.length
			if (vertexEntitiesLength > 0)
				vertexEntities.entities.remove(vertexEntities.entities.values[vertexEntitiesLength - 1])
			if (distances.length > 0) distances.pop()
			updateMidPoints()
			recalculateAllDistances()
			this.undoAvailable.value = history.length > 0
		}

		// 添加节点
		const addVertex = (position: Cartesian3) => {
			fixedPositions.push(position)
			history.push(position)
			createVertexEntity(fixedPositions.length - 1)
			this.undoAvailable.value = true
		}

		// 插入中间点
		const insertMidPoint = (midPoint: Entity, position: Cartesian3) => {
			const index = midPoint.properties.getValue().index
			fixedPositions.splice(index + 1, 0, position)
			history.push(position)
			vertexEntities.entities.removeAll()
			for (let i = 0; i < fixedPositions.length; i++) createVertexEntity(i)
			recalculateAllDistances()
			updateMidPoints()
			this.undoAvailable.value = true
		}

		// 显示节点tooltip
		const showVertexTooltip = (entity: Entity) => {
			const { x, y } = this.viewer.scene.cartesianToCanvasCoordinates(entity.position.getValue())
			const { top, left } = this.viewer.canvas.getBoundingClientRect()
			const index = entity.properties.getValue().index
			let distanceToStart = 0
			for (let i = 0; i < index; i++) {
				if (distances[i]) distanceToStart += distances[i]
			}
			this.updateTempTooltip({
				visible: true,
				text: this.formatDistance(distanceToStart),
				position: { left: x + left, top: y + top },
			})
		}

		// 隐藏节点tooltip
		const hideVertexTooltip = () => {
			this.updateTempTooltip({ visible: false })
		}

		// 拖动节点
		const startDraggingNode = (entity: Entity) => {
			hideVertexTooltip()
			this.viewer.scene.screenSpaceCameraController.enableInputs = false
			drag.isDragging = true
			drag.nodeIndex = entity.properties.getValue().index
			drag.startPosition = entity.position.getValue()
			entity.point.color = new ConstantProperty(this.COLOR.Warning)
			entity.point.outlineColor = new ConstantProperty(Color.WHITE)
			this.undoAvailable.value = false
		}

		// 更新拖动节点
		const updateDraggingNode = (position: Cartesian3) => {
			const { isDragging, nodeIndex } = drag
			if (!isDragging) return
			if (nodeIndex < 0 || nodeIndex >= fixedPositions.length) return
			fixedPositions[nodeIndex] = position
		}

		// 结束拖动节点
		const stopDraggingNode = () => {
			if (!drag.isDragging) return
			this.viewer.scene.screenSpaceCameraController.enableInputs = true
			drag.isDragging = false
			drag.nodeIndex = -1
			drag.startPosition = null
			vertexEntities.entities.values.forEach(item => {
				item.point.color = new ConstantProperty(Color.WHITE)
				item.point.outlineColor = new ConstantProperty(this.COLOR.Warning.withAlpha(0.5))
			})
			recalculateAllDistances()
			this.undoAvailable.value = true
		}

		// 左键单击
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, ({ position }) => {
			const cartesian3 = getMousePosition(position)
			if (!cartesian3) return
			// 点击中间点
			const pick = this.viewer.scene.pick(position)
			const { type, index } = pick?.id?.properties?.getValue() ?? {}
			if (type === EntityTypeEnum.MidPoint) return insertMidPoint(pick.id, cartesian3)
			if (!isDrawing) return
			// 完成绘制
			if (type === EntityTypeEnum.Vertex && index === fixedPositions.length - 1) return finish()
			// 添加新节点
			addVertex(cartesian3)
			// 计算距离
			updateMidPoints()
			recalculateAllDistances()
		})

		// 鼠标按下
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_DOWN, ({ position }) => {
			const pick = this.viewer.scene.pick(position)
			const { type, index } = pick?.id?.properties?.getValue() ?? {}
			if (type === EntityTypeEnum.Vertex) {
				if (index === fixedPositions.length - 1 && isDrawing) return
				startDraggingNode(pick.id)
			}
		})

		// 鼠标移动
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, async ({ endPosition }) => {
			const cartesian3 = getMousePosition(endPosition)
			if (!cartesian3) return
			if (drag.isDragging) updateDraggingNode(cartesian3)
			else if (isDrawing) {
				if (fixedPositions.length === 0) return
				previewPosition = cartesian3
				const previewPositions = [...fixedPositions, previewPosition]
				let previewDistance = 0
				for (let i = 0, len = previewPositions.length - 1; i < len; i++) {
					const _distance = await this.calculateGroundDistance(previewPositions[i], previewPositions[i + 1])
					previewDistance += _distance
				}
				this.updateTooltip({ visible: true, text: this.formatDistance(previewDistance) })
			} else {
				const pick = this.viewer.scene.pick(endPosition)
				const type = pick?.id?.properties?.getValue()?.type
				type === EntityTypeEnum.Vertex ? showVertexTooltip(pick.id) : hideVertexTooltip()
				this.updateTooltip({ visible: false })
			}
		})

		// 鼠标松开
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_UP, () => {
			if (drag.isDragging) stopDraggingNode()
		})

		// 结束绘制
		const finish = () => {
			if (!isDrawing || fixedPositions.length < 2) return
			isDrawing = false
			previewPosition = null
			if (previewPolyline) {
				this.viewer.entities.remove(previewPolyline)
				previewPolyline = null
			}
			this.updateTooltip({ visible: false })
			recalculateAllDistances()
		}

		// 销毁
		const destroy = () => {
			fixedPositions.length = 0
			previewPosition = null
			distances.length = null
			isDrawing = false
			this.viewer.dataSources.remove(vertexEntities, true)
			vertexEntities = null
			this.viewer.dataSources.remove(midPoints)
			midPoints = null
			if (activePolyline) this.viewer.entities.remove(activePolyline)
			if (previewPolyline) this.viewer.entities.remove(previewPolyline)
		}

		return { destroy, undo }
	}
}
