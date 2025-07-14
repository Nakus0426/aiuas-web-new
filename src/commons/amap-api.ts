import { type Alova, type AlovaGenerics, createAlova } from 'alova'
import FetchAdapter, { type FetchRequestInit } from 'alova/fetch'
import VueHook from 'alova/vue'
import { createClientTokenAuthentication } from 'alova/client'
import { isNil } from 'es-toolkit'
import { API_SERVICE_ALIAS } from '@/configs/amap'
import { type WatchSource } from 'vue'

// #region 类型
type AlovaInstance = Alova<
	AlovaGenerics<
		any,
		any,
		FetchRequestInit,
		Response,
		Headers,
		any,
		any,
		{
			name: 'Vue'
			State: globalThis.Ref<unknown, unknown>
			Computed: globalThis.ComputedRef<unknown>
			Watched: object | WatchSource
			StateExport: globalThis.Ref
			ComputedExport: globalThis.ComputedRef
		}
	>
>

interface BaseRes {
	status: string
	info: string
	infocode: string
	count: string
}

interface SearchPoiByPolygonReq {
	polygon: string
	keywords?: string
	types?: string
	show_fields?: string
	page_size?: number
	page_num?: number
	sig?: string
	output?: string
	callback?: string
}

interface SearchPoiByPolygonRes extends BaseRes {
	pois: Array<{
		name: string
		id: string
		location: string
		type: string
		typecode: string
		pname: string
		cityname: string
		adname: string
		address: string
		pcode: string
		citycode: string
		adcode: string
		distance: string
		parent: string
	}>
}
// #endregion

export class AMapApi {
	private readonly alovaInstance: AlovaInstance

	constructor(token: string) {
		const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<typeof VueHook>({
			assignToken(method) {
				method.url = `${method.url}?key=${token}`
			},
		})
		this.alovaInstance = createAlova({
			baseURL: API_SERVICE_ALIAS,
			statesHook: VueHook,
			requestAdapter: FetchAdapter(),
			timeout: 30000,
			cacheFor: null,
			beforeRequest: onAuthRequired(),
			responded: onResponseRefreshToken({
				async onSuccess(response, method) {
					try {
						const json = await response.json()
						const { infocode, info } = json
						if (isNil(infocode) && infocode !== '10000') throw new Error(info)
						return json
					} catch (e) {
						if (!method.meta?.feedbackIgnore) window.$message.error('请求失败，请稍后重试')
						throw e
					}
				},
				onError(error) {
					window.$message.error(error.message)
					throw error
				},
			}),
		})
	}

	searchPoiByPolygon(params: SearchPoiByPolygonReq) {
		return this.alovaInstance.Get<SearchPoiByPolygonRes>('/v5/place/polygon', { params })
	}
}
