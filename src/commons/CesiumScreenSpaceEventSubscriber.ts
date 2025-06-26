import { Entity, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer } from 'cesium'
import { nanoid } from 'nanoid'

type EntityIdentifier = Entity | string

type ScreenSpaceEventHandlerCallback =
	| ScreenSpaceEventHandler.PositionedEventCallback
	| ScreenSpaceEventHandler.MotionEventCallback
	| ScreenSpaceEventHandler.WheelEventCallback
	| ScreenSpaceEventHandler.TwoPointEventCallback
	| ScreenSpaceEventHandler.TwoPointMotionEventCallback

interface Subscription {
	eventType: ScreenSpaceEventType
	entityIds?: string[]
	callback: ScreenSpaceEventHandlerCallback
}

export default class EventSubscriber {
	private viewer: Viewer
	private handler: ScreenSpaceEventHandler
	private subscriptions: Subscription[] = []

	constructor(viewer: Viewer) {
		this.viewer = viewer
		this.handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
	}

	/**
	 * 订阅指定事件（全局）
	 * @param eventType 事件类型
	 * @param callback 回调函数
	 * @returns 订阅ID（用于取消订阅）
	 */
	subscribeEvent(eventType: ScreenSpaceEventType, callback: ScreenSpaceEventHandlerCallback): string {
		const sub: Subscription = { eventType, callback }
		this.subscriptions.push(sub)
		this.updateHandler()
		return this.getSubscriptionId(sub)
	}

	/**
	 * 订阅单个实体的指定事件
	 * @param entity 实体或实体ID
	 * @param eventType 事件类型
	 * @param callback 回调函数
	 * @returns 订阅ID（用于取消订阅）
	 */
	subscribeEntityEvent(
		entity: EntityIdentifier,
		eventType: ScreenSpaceEventType,
		callback: ScreenSpaceEventHandlerCallback,
	): string {
		const entityId = this.getEntityId(entity)
		const sub: Subscription = { eventType, entityIds: [entityId], callback }
		this.subscriptions.push(sub)
		this.updateHandler()
		return this.getSubscriptionId(sub)
	}

	/**
	 * 订阅多个实体的指定事件
	 * @param entities 实体数组
	 * @param eventType 事件类型
	 * @param callback 回调函数
	 * @returns 订阅ID（用于取消订阅）
	 */
	subscribeEntitiesEvent(
		entities: EntityIdentifier[],
		eventType: ScreenSpaceEventType,
		callback: ScreenSpaceEventHandlerCallback,
	): string {
		const entityIds = entities.map(this.getEntityId)
		const sub: Subscription = { eventType, entityIds, callback }
		this.subscriptions.push(sub)
		this.updateHandler()
		return this.getSubscriptionId(sub)
	}

	/**
	 * 取消订阅
	 * @param subscriptionId 订阅时返回的ID
	 */
	unsubscribe(subscriptionId: string): void {
		const index = this.subscriptions.findIndex(sub => this.getSubscriptionId(sub) === subscriptionId)

		if (index !== -1) {
			this.subscriptions.splice(index, 1)
			this.updateHandler()
		}
	}

	/** 销毁订阅器，释放所有资源 */
	destroy(): void {
		this.handler.destroy?.()
		this.handler = null
		this.subscriptions = []
		this.viewer = null
	}

	/** 获取当前活跃订阅数量 */
	getSubscriptionCount(): number {
		return this.subscriptions.length
	}

	private updateHandler(): void {
		// 移除所有现有监听
		Object.values(ScreenSpaceEventType).forEach((type: ScreenSpaceEventType) => {
			try {
				this.handler.removeInputAction(type)
			} catch (e) {
				// 忽略未注册事件的错误
			}
		})
		// 按事件类型分组订阅
		const eventMap = new Map<ScreenSpaceEventType, Subscription[]>()
		this.subscriptions.forEach(sub => {
			if (!eventMap.has(sub.eventType)) {
				eventMap.set(sub.eventType, [])
			}
			eventMap.get(sub.eventType)!.push(sub)
		})
		// 为每种事件类型设置监听
		eventMap.forEach((subs, eventType) => {
			this.handler.setInputAction((event: any) => {
				let picked: any
				if (event.position) picked = this.viewer.scene.pickPosition(event.position)
				if (event.endPosition) picked = this.viewer.scene.pickPosition(event.endPosition)
				subs.forEach(sub => {
					const shouldTrigger =
						// 全局事件
						!sub.entityIds ||
						// 实体事件且被选中
						(picked?.id && sub.entityIds.includes(this.getEntityId(picked.id)))

					if (shouldTrigger) {
						sub.callback(event)
					}
				})
			}, eventType)
		})
	}

	private getEntityId(entity: EntityIdentifier): string {
		return typeof entity === 'string' ? entity : entity.id
	}

	private getSubscriptionId(sub: Subscription): string {
		return `${sub.eventType}-${nanoid()}`
	}
}
