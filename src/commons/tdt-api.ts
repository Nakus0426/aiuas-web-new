import { type Alova, type AlovaGenerics, createAlova } from 'alova'
import FetchAdapter, { type FetchRequestInit } from 'alova/fetch'
import VueHook from 'alova/vue'
import { createClientTokenAuthentication } from 'alova/client'
import { isNil } from 'es-toolkit'
import { TOKEN, API_SERVICE } from '@/configs/tdt'
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

interface BaseReq {
	keyWord: string
	queryType?: string
	dataTypes?: string
	show?: string
}

interface PageBaseReq {
	start: string
	count: string
}

type PageReq<T> = BaseReq & PageBaseReq & T

type Req<T> = BaseReq & T

interface Poi {
	eaddress: string
	address: string
	city: string
	provinceCode: string
	cityCode: string
	county: string
	typeName: string
	source: string
	typeCode: string
	lonlat: string
	countyCode: string
	ename: string
	province: string
	phone: string
	poiType: string
	name: string
	hotPointID: string
	stationData?: Array<{ lineName: string; uuid: string; stationUuid: string }>
}

interface Statistics {
	count: number
	adminCount: number
	priorityCitys: Array<{
		name: string
		count: string
		lonlat: string
		ename: string
		adminCode: string
	}>
	allAdmins: Array<{
		name: string
		count: string
		lonlat: string
		ename: string
		adminCode: string
		isleaf: boolean
	}>
}

interface Area {
	name: string
	bound: string
	lonlat: string
	adminCode: number
	level: number
}

interface LineData {
	stationNum: string
	poiType: string
	name: string
	uuid: string
}

interface Prompt {
	type: number
	admins: Array<{ adminName: string; adminCode: number }>
}

interface BaseRes {
	count: string
	resultType: number
	prompt: Prompt[]
	status: { cndesc: string; infocode: number }
	keyWord: string
}

type SearchInViewReq = PageReq<{ mapBound: string; level: string }>
interface SearchInViewRes extends BaseRes {
	pois: Poi[]
}
// #endregion

export class TDTApi {
	private readonly alovaInstance: AlovaInstance

	constructor() {
		const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<typeof VueHook>({
			assignToken(method) {
				method.url = `${method.url}?tk=${TOKEN}`
			},
		})
		this.alovaInstance = createAlova({
			baseURL: API_SERVICE,
			statesHook: VueHook,
			requestAdapter: FetchAdapter(),
			timeout: 30000,
			cacheFor: null,
			beforeRequest: onAuthRequired(),
			responded: onResponseRefreshToken({
				async onSuccess(response, method) {
					try {
						const json = await response.json()
						const { infocode, cndesc } = json.status
						if (isNil(infocode) && infocode !== 1000) throw new Error(cndesc)
						return json
					} catch (e) {
						if (!method.meta?.feedbackIgnore) window.$message.error('请求失败，请稍后重试')
						throw e
					}
				},
				onError(error, method) {
					console.log(method)
					window.$message.error(error.message)
					throw error
				},
			}),
		})
	}

	searchPoiByPolygon(params: SearchInViewReq) {
		return this.alovaInstance.Get<SearchInViewRes>('/v2/search', {
			params: { type: 'query', postStr: JSON.stringify({ queryType: '2', ...params }) },
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		})
	}
}
