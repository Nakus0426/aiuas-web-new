import { Entity, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer } from 'cesium'
import { isArray } from 'es-toolkit/compat'
import { nanoid } from 'nanoid'

type EntityIdentifier = Entity | string

type ScreenSpaceEventHandlerCallback =
	| ScreenSpaceEventHandler.PositionedEventCallback
	| ScreenSpaceEventHandler.MotionEventCallback
	| ScreenSpaceEventHandler.WheelEventCallback
	| ScreenSpaceEventHandler.TwoPointEventCallback
	| ScreenSpaceEventHandler.TwoPointMotionEventCallback

interface Subscription {
	id: string
	entityIds?: string[]
	callback: ScreenSpaceEventHandlerCallback
}

export class EventSubscriber {
	private viewer: Viewer
	private handler: ScreenSpaceEventHandler
	private subscriptions = new Map<ScreenSpaceEventType, Subscription[]>()
	private viewerDestroyCheckTimer: number

	constructor(viewer: Viewer) {
		this.viewer = viewer
		this.initHandler()
		this.startViewerDestroyCheck()
	}

	/**
	 * 订阅指定事件（全局）
	 * @param eventType 事件类型
	 * @param callback 回调函数
	 * @returns 取消订阅函数
	 */
	subscribeEvent(eventType: ScreenSpaceEventType, callback: ScreenSpaceEventHandlerCallback) {
		if (!this.subscriptions.has(eventType)) this.subscriptions.set(eventType, [])
		const id = nanoid()
		this.subscriptions.get(eventType).push({ id, callback })
		return () => this.unsubscribe(eventType, id)
	}

	/**
	 * 订阅单个实体的指定事件
	 * @param entity 实体或实体ID
	 * @param eventType 事件类型
	 * @param callback 回调函数
	 * @returns 取消订阅函数
	 */
	subscribeEntityEvent(
		eventType: ScreenSpaceEventType,
		entity: EntityIdentifier | EntityIdentifier[],
		callback: ScreenSpaceEventHandlerCallback,
	) {
		if (!this.subscriptions.has(eventType)) this.subscriptions.set(eventType, [])
		const id = nanoid()
		const entityIds = isArray(entity) ? entity.map(this.getEntityId) : [this.getEntityId(entity)]
		this.subscriptions.get(eventType).push({ id, entityIds, callback })
		return () => this.unsubscribe(eventType, id)
	}

	/**
	 * 取消订阅
	 * @param subscriptionId 订阅时返回的ID
	 */
	private unsubscribe(eventType: ScreenSpaceEventType, id: string): void {
		const subs = this.subscriptions.get(eventType)
		this.subscriptions.set(
			eventType,
			subs.filter(sub => sub.id !== id),
		)
	}

	/**
	 * 销毁
	 */
	destroy(): void {
		if (this.viewerDestroyCheckTimer) {
			clearInterval(this.viewerDestroyCheckTimer)
			this.viewerDestroyCheckTimer = null
		}
		this.handler.destroy?.()
		this.handler = null
		this.subscriptions.clear()
		this.viewer = null
	}

	/**
	 * 检测viewer是否被销毁
	 */
	private startViewerDestroyCheck() {
		this.viewerDestroyCheckTimer = setInterval(
			() => (!this.viewer || this.viewer.isDestroyed()) && this.destroy(),
			100,
		) as unknown as number
	}

	private initHandler() {
		this.handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
		Object.values(ScreenSpaceEventType).forEach((type: ScreenSpaceEventType) => {
			this.handler.setInputAction((event: any) => {
				let picked
				if (event.position) picked = this.viewer.scene.pickPosition(event.position)
				if (event.endPosition) picked = this.viewer.scene.pickPosition(event.endPosition)
				const subs = this.subscriptions.get(type)
				if (!subs) return
				subs.forEach(sub => {
					const shouldTrigger = !sub.entityIds || (picked?.id && sub.entityIds.includes(this.getEntityId(picked.id)))
					if (shouldTrigger) sub.callback(event)
				})
			}, type)
		})
	}

	private getEntityId(entity: EntityIdentifier): string {
		return typeof entity === 'string' ? entity : entity.id
	}
}
