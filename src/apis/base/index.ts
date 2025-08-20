import { createAlovaInstance } from '../common'
import { createApis, withConfigType } from './createApis'

export const alovaInstance = createAlovaInstance('/aiuas-system-base')

export const $$userConfigMap = withConfigType({
	'general.getApiBasedataNewInitBaseData': { meta: { isVisitor: true } },
	'general.getApiSettingInitSetting': { meta: { isVisitor: true } },
	'general.getApiFileDownload1': { meta: { responsedIgnore: true } },
})

const Apis = createApis(alovaInstance, $$userConfigMap)

export default Apis
