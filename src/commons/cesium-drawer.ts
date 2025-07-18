import {
	type Entity,
	type Viewer,
	Cartesian2,
	Cartesian3,
	HeadingPitchRange,
	HeightReference,
	HorizontalOrigin,
	ScreenSpaceEventType,
	VerticalOrigin,
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
import { NumberUtil } from './number-util'
import { CesiumUtil } from './cesium-util'

// #region 类型
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
	Ellipse,
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

	export interface EllipseEvent {
		entity: Entity
		position: Cartesian3
		radius: number
		area: number
	}

	export type MouseMoveEventCallback = (event: MouseMoveEvent) => void

	export type PointEventCallback = (event: PointEvent) => void

	export type PolylineEventCallback = (event: PolylineEvent) => void

	export type PolygonEventCallback = (event: PolygonEvent) => void

	export type EllipseEventCallback = (event: EllipseEvent) => void

	export type Callback =
		| MouseMoveEventCallback
		| PointEventCallback
		| PolylineEventCallback
		| PolygonEventCallback
		| EllipseEventCallback

	export interface Handler {
		id: string
		event: Event
		callback: Callback
	}
}
// #endregion

const DOUBLE_CLICK_THRESHOLD = 300

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
	private util: CesiumUtil
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
		this.util = new CesiumUtil(viewer)
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
		if (this.mode === DrawMode.Polygon) this.activeDrawer = this.initPolygonDrawer()
		if (this.mode === DrawMode.Ellipse) this.activeDrawer = this.initEllipseDrawer()
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
	 * 获取屏幕坐标位置
	 * @param position 屏幕坐标
	 */
	private getMousePosition(position: Cartesian2) {
		const ray = this.viewer.scene.camera.getPickRay(position)
		if (!ray) return
		return this.viewer.scene.globe.pick(ray, this.viewer.scene)
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
	 * 重置相机视角
	 */
	private resetCamera() {
		this.viewer.camera.flyTo({
			destination: this.viewer.camera.position,
			duration: 0.2,
			orientation: new HeadingPitchRange(this.viewer.camera.heading, CesiumMath.toRadians(-90), 0),
		})
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
		const history: Array<{ type: EntityTypeEnum; position: Cartesian3; index?: number }> = []
		const drag = {
			isDragging: false,
			nodeIndex: -1,
			startPosition: null,
		}
		const enum EntityTypeEnum {
			Vertex,
			MidPoint,
		}

		this.resetCamera()
		this.viewer.canvas.style.cursor = 'crosshair'
		this.updateTooltip({ text: '选择起点', visible: true })

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
				const distance = await this.util.groundDistance([fixedPositions[i], fixedPositions[i + 1]])
				distances.push(distance)
			}
			emitEvent()
		}

		// 撤销
		const undo = () => {
			if (fixedPositions.length <= 2) return
			if (history.length === 0) return
			const lastOp = history.pop()
			if (lastOp.type === EntityTypeEnum.Vertex) fixedPositions.pop()
			else if (lastOp.type === EntityTypeEnum.MidPoint && isNotNil(lastOp.index)) fixedPositions.splice(lastOp.index, 1)
			vertexEntities.entities.removeAll()
			for (let i = 0; i < fixedPositions.length; i++) createVertexEntity(i)
			recalculateAllDistances()
			updateMidPoints()
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 1
		}

		// 添加节点
		const addVertex = (position: Cartesian3) => {
			fixedPositions.push(position)
			history.push({ type: EntityTypeEnum.Vertex, position })
			createVertexEntity(fixedPositions.length - 1)
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 1
		}

		// 插入中间点
		const insertMidPoint = (midPoint: Entity, position: Cartesian3) => {
			const index = midPoint.properties.getValue().index
			fixedPositions.splice(index + 1, 0, position)
			history.push({ type: EntityTypeEnum.MidPoint, position, index: index + 1 })
			vertexEntities.entities.removeAll()
			for (let i = 0; i < fixedPositions.length; i++) createVertexEntity(i)
			recalculateAllDistances()
			updateMidPoints()
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 1
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
				text: NumberUtil.formatDistance(distanceToStart),
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
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 1
		}

		// 左键单击
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, ({ position }) => {
			const cartesian3 = this.getMousePosition(position)
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
			const cartesian3 = this.getMousePosition(endPosition)
			if (!cartesian3) return
			if (drag.isDragging) return updateDraggingNode(cartesian3)
			const pick = this.viewer.scene.pick(endPosition)
			const { type, index } = pick?.id?.properties?.getValue() ?? {}
			if (isDrawing) {
				if (fixedPositions.length === 0) return
				if (type === EntityTypeEnum.Vertex && index === fixedPositions.length - 1)
					return this.updateTooltip({ visible: true, text: '完成' })
				previewPosition = cartesian3
				const previewPositions = [...fixedPositions, previewPosition]
				let previewDistance = 0
				for (let i = 0, len = previewPositions.length - 1; i < len; i++) {
					const _distance = await this.util.groundDistance([previewPositions[i], previewPositions[i + 1]])
					previewDistance += _distance
				}
				return this.updateTooltip({ visible: true, text: NumberUtil.formatDistance(previewDistance) })
			}
			if (type === EntityTypeEnum.MidPoint) return this.updateTooltip({ text: '点击添加顶点', visible: true })
			type === EntityTypeEnum.Vertex ? showVertexTooltip(pick.id) : hideVertexTooltip()
			this.updateTooltip({ visible: false })
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
			distances.length = null
			this.viewer.dataSources.remove(vertexEntities, true)
			vertexEntities = null
			this.viewer.dataSources.remove(midPoints, true)
			midPoints = null
			if (activePolyline) {
				this.viewer.entities.remove(activePolyline)
				activePolyline = null
			}
			if (previewPolyline) {
				this.viewer.entities.remove(previewPolyline)
				previewPolyline = null
			}
		}

		return { destroy, undo }
	}

	/**
	 * 初始化多边形绘制
	 */
	private initPolygonDrawer() {
		let lastClickTime = 0
		let isDrawing = true
		const fixedPositions: Cartesian3[] = []
		let vertexEntities = new CustomDataSource('vertexEntities')
		this.viewer.dataSources.add(vertexEntities)
		let midPoints = new CustomDataSource('midPoints')
		this.viewer.dataSources.add(midPoints)
		let previewPosition: Cartesian3
		let activePolygon: Entity
		const history: Array<{ type: EntityTypeEnum; position: Cartesian3; index?: number }> = []
		const drag = {
			isDragging: false,
			nodeIndex: -1,
			startPosition: null,
		}
		const enum EntityTypeEnum {
			Vertex,
			MidPoint,
		}

		this.resetCamera()
		this.viewer.canvas.style.cursor = 'crosshair'
		this.updateTooltip({ text: '选择起点', visible: true })

		// 创建多边形实体
		const createPolygon = () => {
			activePolygon = this.viewer.entities.add({
				polygon: {
					hierarchy: new CallbackProperty(() => {
						const positions = isDrawing && previewPosition ? [...fixedPositions, previewPosition] : fixedPositions
						return { positions, perPositionHeight: true }
					}, false),
					material: Color.WHITE.withAlpha(0.5),
					outline: true,
					outlineColor: this.COLOR.Warning,
					outlineWidth: 4,
					heightReference: HeightReference.CLAMP_TO_GROUND,
				},
				polyline: {
					positions: new CallbackProperty(() => {
						if (fixedPositions.length === 0) return []
						if (previewPosition) return [...fixedPositions, previewPosition, fixedPositions[0]]
						return [...fixedPositions, fixedPositions[0]]
					}, false),
					width: 4,
					material: this.COLOR.Warning,
					clampToGround: true,
				},
			})
		}
		createPolygon()

		// 创建顶点
		const createVertexEntity = (index: number) => {
			return vertexEntities.entities.add({
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
		}

		// 创建中间点
		const createMidPointEntity = (index: number, nextIndex: number) => {
			return midPoints.entities.add({
				position: new CallbackPositionProperty(() => {
					if (index >= fixedPositions.length || nextIndex >= fixedPositions.length) return null
					return Cartesian3.midpoint(fixedPositions[index], fixedPositions[nextIndex], new Cartesian3())
				}, false),
				point: {
					pixelSize: 8,
					color: Color.WHITE,
					outlineColor: this.COLOR.Warning.withAlpha(0.5),
					outlineWidth: 2,
					heightReference: HeightReference.CLAMP_TO_GROUND,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
				properties: {
					type: EntityTypeEnum.MidPoint,
					index,
					nextIndex,
				},
			})
		}

		// 更新中间点
		const updateMidPoints = () => {
			midPoints.entities.removeAll()
			if (fixedPositions.length < 2) return
			const edgeCount = isDrawing ? fixedPositions.length - 1 : fixedPositions.length
			for (let i = 0; i < edgeCount; i++) createMidPointEntity(i, (i + 1) % fixedPositions.length)
		}

		// 抛出多边形事件
		const emitPolygonEvent = async () => {
			const positions = isDrawing && previewPosition ? [...fixedPositions, previewPosition] : fixedPositions
			const area = await this.util.groundArea(positions)
			this.eventHandlers.forEach(({ event, callback }) => {
				if (event === Event.Polygon)
					(callback as EventHandler.PolygonEventCallback)({
						entity: activePolygon,
						positions,
						area,
					})
			})
		}

		// 添加顶点
		const addVertex = (position: Cartesian3) => {
			fixedPositions.push(position)
			history.push({
				type: EntityTypeEnum.Vertex,
				position,
			})
			createVertexEntity(fixedPositions.length - 1)
			updateMidPoints()
			emitPolygonEvent()
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 3
		}

		// 插入中间点
		const insertMidPoint = async (midPoint: Entity, position: Cartesian3) => {
			const { nextIndex } = midPoint.properties.getValue()
			fixedPositions.splice(nextIndex, 0, position)
			history.push({ type: EntityTypeEnum.MidPoint, position, index: nextIndex })
			vertexEntities.entities.removeAll()
			for (let i = 0; i < fixedPositions.length; i++) createVertexEntity(i)
			updateMidPoints()
			emitPolygonEvent()
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 3
		}

		// 撤销操作
		const undo = () => {
			if (history.length === 0) return
			const lastOp = history.pop()
			if (lastOp.type === EntityTypeEnum.Vertex) fixedPositions.pop()
			else if (lastOp.type === EntityTypeEnum.MidPoint && isNotNil(lastOp.index)) fixedPositions.splice(lastOp.index, 1)
			vertexEntities.entities.removeAll()
			for (let i = 0; i < fixedPositions.length; i++) createVertexEntity(i)
			updateMidPoints()
			emitPolygonEvent()
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 3
		}

		// 开始拖动节点
		const startDraggingNode = (entity: Entity) => {
			this.updateTempTooltip({ visible: false })
			this.viewer.scene.screenSpaceCameraController.enableInputs = false
			drag.isDragging = true
			drag.nodeIndex = entity.properties.getValue().index
			drag.startPosition = entity.position.getValue()
			entity.point.color = new ConstantProperty(this.COLOR.Warning)
			entity.point.outlineColor = new ConstantProperty(Color.WHITE.withAlpha(0.5))
			this.undoAvailable.value = false
		}

		// 更新拖动节点
		const updateDraggingNode = (position: Cartesian3) => {
			if (!drag.isDragging || drag.nodeIndex < 0 || drag.nodeIndex >= fixedPositions.length) return
			fixedPositions[drag.nodeIndex] = position
		}

		// 停止拖动节点
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
			this.undoAvailable.value = history.length > 0 && fixedPositions.length > 3
			emitPolygonEvent()
		}

		// 完成绘制
		const finishDrawing = () => {
			if (!isDrawing || fixedPositions.length < 3) return
			isDrawing = false
			previewPosition = null
			this.updateTooltip({ visible: false })
			updateMidPoints()
			emitPolygonEvent()
		}

		// 左键点击事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, ({ position }) => {
			const now = Date.now()
			const isDoubleClick = now - lastClickTime < DOUBLE_CLICK_THRESHOLD
			lastClickTime = now
			// 如果是双击，不执行单击逻辑
			if (isDoubleClick) return
			const cartesian3 = this.getMousePosition(position)
			if (!cartesian3) return
			// 检查是否点击中间点
			const pick = this.viewer.scene.pick(position)
			const { type, index } = pick?.id?.properties?.getValue() ?? {}
			if (type === EntityTypeEnum.MidPoint) return insertMidPoint(pick.id, cartesian3)
			// 检查是否点击第一个顶点完成绘制
			if (type === EntityTypeEnum.Vertex && index === 0 && fixedPositions.length >= 3) return finishDrawing()
			// 添加新顶点
			if (isDrawing) {
				addVertex(cartesian3)
			}
		})

		// 鼠标移动事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => {
			const cartesian3 = this.getMousePosition(endPosition)
			if (!cartesian3) return
			// 处理拖动
			if (drag.isDragging) return updateDraggingNode(cartesian3)
			// 更新预览位置
			if (isDrawing && fixedPositions.length > 0) previewPosition = cartesian3
			// 显示提示信息
			const pick = this.viewer.scene.pick(endPosition)
			const { type } = pick?.id?.properties?.getValue() ?? {}
			if (type === EntityTypeEnum.MidPoint) return this.updateTooltip({ text: '点击添加顶点', visible: true })
			if (isDrawing) {
				if (fixedPositions.length === 0) return this.updateTooltip({ text: '选择起点', visible: true })
				if (fixedPositions.length < 2) return this.updateTooltip({ text: '添加顶点', visible: true })
				if (fixedPositions.length >= 2) return this.updateTooltip({ text: '添加顶点 | 双击完成', visible: true })
			}
			this.updateTooltip({ visible: false })
		})

		// 鼠标按下事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_DOWN, ({ position }) => {
			const pick = this.viewer.scene.pick(position)
			const { type } = pick?.id?.properties?.getValue() ?? {}
			if (type === EntityTypeEnum.Vertex) startDraggingNode(pick.id)
		})

		// 鼠标松开事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_UP, () => {
			if (drag.isDragging) stopDraggingNode()
		})

		// 双击事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_DOUBLE_CLICK, () => {
			if (fixedPositions.length < 3) return
			finishDrawing()
			lastClickTime = 0
		})

		// 销毁
		const destroy = () => {
			fixedPositions.length = 0
			previewPosition = null
			isDrawing = false
			this.viewer.dataSources.remove(vertexEntities, true)
			vertexEntities = null
			this.viewer.dataSources.remove(midPoints, true)
			midPoints = null
			if (activePolygon) {
				this.viewer.entities.remove(activePolygon)
				activePolygon = null
			}
		}

		return { destroy, undo }
	}

	/**
	 * 初始化圆形绘制
	 */
	private initEllipseDrawer() {
		let centerPoint: Entity | null = null
		let endPoint: Entity | null = null
		let ellipseEntity: Entity | null = null
		let isDrawing = true
		let isDragging = false
		let lastRadius = 0
		let currentMousePosition = new Cartesian2()
		const { left, top } = this.viewer.canvas.getBoundingClientRect()

		this.resetCamera()
		this.viewer.canvas.style.cursor = 'crosshair'
		this.updateTooltip({ text: '选择圆心', visible: true })
		this.undoAvailable.value = false

		// 动态属性
		const centerPosition = new CallbackPositionProperty(() => centerPoint?.position?.getValue() ?? null, false)
		const endPosition = new CallbackPositionProperty(() => endPoint?.position?.getValue() ?? null, false)
		const previewPosition = new CallbackPositionProperty(() => {
			if (isDragging) return endPosition.getValue()
			if (isDrawing && centerPosition.getValue()) {
				const ray = this.viewer.scene.camera.getPickRay(currentMousePosition)
				return ray ? this.viewer.scene.globe.pick(ray, this.viewer.scene) : null
			}
			return null
		}, false)
		const radiusProperty = new CallbackProperty(() => {
			const center = centerPosition.getValue()
			const end = previewPosition.getValue()
			if (!center || !end) return 0
			return Cartesian3.distance(center, end)
		}, false)
		const linePositions = new CallbackProperty(() => {
			const center = centerPosition.getValue()
			const end = previewPosition.getValue()
			if (!center || !end) return []
			return [center, end]
		}, false)

		// 创建/更新圆形实体
		const updateEllipseEntity = () => {
			if (!ellipseEntity) {
				ellipseEntity = this.viewer.entities.add({
					position: centerPosition,
					ellipse: {
						semiMajorAxis: radiusProperty,
						semiMinorAxis: radiusProperty,
						material: Color.WHITE.withAlpha(0.5),
						outline: true,
						outlineColor: this.COLOR.Warning,
						heightReference: HeightReference.CLAMP_TO_GROUND,
					},
					polyline: {
						positions: linePositions,
						width: 2,
						material: this.COLOR.Warning,
						clampToGround: true,
					},
				})
			}
			lastRadius = radiusProperty.getValue()
		}

		// 抛出事件
		const emitEvent = () => {
			if (!ellipseEntity || !centerPosition.getValue()) return
			const radius = radiusProperty.getValue()
			this.eventHandlers.forEach(({ event, callback }) => {
				if (event === Event.Ellipse)
					(callback as EventHandler.EllipseEventCallback)({
						entity: ellipseEntity!,
						position: centerPosition.getValue()!,
						radius,
						area: 0,
					})
			})
		}

		// 左键点击事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_CLICK, ({ position }) => {
			if (!isDrawing || centerPoint) return
			const cartesian3 = this.getMousePosition(position)
			if (!cartesian3) return
			centerPoint = this.viewer.entities.add({
				position: cartesian3,
				point: {
					pixelSize: 12,
					color: this.COLOR.Warning,
					heightReference: HeightReference.CLAMP_TO_GROUND,
				},
			})
			updateEllipseEntity()
			this.updateTooltip({ text: '双击完成', visible: true })
		})

		// 鼠标移动事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.MOUSE_MOVE, ({ endPosition }) => {
			Cartesian2.clone(endPosition, currentMousePosition)
			// 绘制预览
			if (isDrawing && centerPosition.getValue()) {
				const radius = radiusProperty.getValue()
				// 显示半径距离
				this.updateTooltip({
					text: `半径: ${NumberUtil.formatDistance(radius)}`,
					visible: true,
				})
			}
			// 悬停提示
			if (!isDrawing && ellipseEntity) {
				const pick = this.viewer.scene.pick(endPosition)
				if (pick && (pick.id === ellipseEntity || pick.id === endPoint))
					this.updateTempTooltip({
						visible: true,
						text: `半径: ${NumberUtil.formatDistance(lastRadius)}`,
						position: {
							left: endPosition.x + left,
							top: endPosition.y + top,
						},
					})
				else this.updateTempTooltip({ visible: false })
			}
		})

		// 双击事件
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_DOUBLE_CLICK, ({ position }) => {
			if (!isDrawing || !centerPosition.getValue()) return
			const cartesian3 = this.getMousePosition(position)
			if (!cartesian3) return
			// 添加半径终点
			if (!endPoint)
				endPoint = this.viewer.entities.add({
					position: cartesian3,
					point: {
						pixelSize: 10,
						color: this.COLOR.Primary,
						outlineColor: Color.WHITE,
						outlineWidth: 2,
						heightReference: HeightReference.CLAMP_TO_GROUND,
					},
				})
			isDrawing = false
			this.updateTooltip({ visible: false })
			emitEvent()
		})

		// 鼠标左键按下
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_DOWN, ({ position }) => {
			if (isDrawing || !endPoint) return
			const pick = this.viewer.scene.pick(position)
			if (pick && pick.id === endPoint) {
				isDragging = true
				this.viewer.scene.screenSpaceCameraController.enableInputs = false
			}
		})

		// 鼠标左键松开
		this.eventSubscriber.subscribeEvent(ScreenSpaceEventType.LEFT_UP, () => {
			if (isDragging) {
				isDragging = false
				this.viewer.scene.screenSpaceCameraController.enableInputs = true
				emitEvent()
			}
		})

		// 销毁实现
		const destroy = () => {
			if (centerPoint) {
				this.viewer.entities.remove(centerPoint)
				centerPoint = null
			}
			if (endPoint) {
				this.viewer.entities.remove(endPoint)
				endPoint = null
			}
			if (ellipseEntity) {
				this.viewer.entities.remove(ellipseEntity)
				ellipseEntity = null
			}
		}

		return { destroy }
	}
}
