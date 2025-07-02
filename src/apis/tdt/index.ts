import { createAlova } from 'alova'
import FetchAdapter from 'alova/fetch'
import VueHook from 'alova/vue'
import { createClientTokenAuthentication } from 'alova/client'
import { isNil } from 'es-toolkit'

// #region alova实例
const { onAuthRequired, onResponseRefreshToken } = createClientTokenAuthentication<typeof VueHook>({
	assignToken(method) {
		method.url = `${method.url}?tk=${import.meta.env.VITE_TDT_TK}`
	},
})

const alovaInstance = createAlova({
	baseURL: import.meta.env.VITE_TDT_API_URL,
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
		onError(error) {
			window.$message.error(error.message)
			throw error
		},
	}),
})
// #endregion

// #region 类型
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
// #endregion

const tdtApis = {
	searchInView(params: PageReq<{ mapBound: string; level: string }>) {
		return alovaInstance.Get<BaseRes & { pois: Poi[] }>('/v2/search', {
			params: { type: 'query', postStr: JSON.stringify({ queryType: '2', ...params }) },
		})
	},
}

globalThis.TdtApis = tdtApis

export type TdtApis = typeof tdtApis
