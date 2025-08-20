import { type AlovaGenerics, createAlova } from 'alova'
import { type AlovaFrontMiddlewareContext, createClientTokenAuthentication } from 'alova/client'
import FetchAdapter from 'alova/fetch'
import VueHook from 'alova/vue'
import { isNil } from 'es-toolkit'

const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<typeof VueHook>({
	assignToken(method) {
		method.config.headers
	},
	visitorMeta: {
		isVisitor: true,
	},
})

/**
 * 创建 alova 实例
 * @param baseURL 服务地址前缀
 */
export function createAlovaInstance(baseURL: string) {
	return createAlova({
		baseURL,
		statesHook: VueHook,
		requestAdapter: FetchAdapter(),
		timeout: 30000,
		cacheFor: null,
		beforeRequest: onAuthRequired(),
		responded: onResponseRefreshToken({
			async onSuccess(response, method) {
				try {
					if (method.meta?.responsedIgnore) return response
					const json = await response.json()
					const { code, message } = json
					if (isNil(code) && code !== 200) throw new Error(message)
					return json
				} catch (e) {
					if (!method.meta?.feedbackIgnore) window.$message.error('请求失败，请稍后重试')
					throw e
				}
			},
			onError(error, method) {
				if (!method.meta?.feedbackIgnore) window.$message.error(error.message)
				throw error
			},
		}),
	})
}

/**
 * 延迟 loading 中间件
 * @param delay 延迟时间（毫秒）
 */
export function delayLoadingMiddleware<AG extends AlovaGenerics>(delay = 500) {
	return async (ctx: AlovaFrontMiddlewareContext<AG>, next) => {
		let timer: NodeJS.Timeout | undefined
		try {
			ctx.controlLoading()
			timer = setTimeout(() => (ctx.proxyStates.loading.v = true), delay)
			await next()
		} finally {
			ctx.proxyStates.loading.v = false
			clearTimeout(timer)
		}
	}
}
