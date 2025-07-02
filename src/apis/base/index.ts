import { createApis, withConfigType } from './createApis'
import { createAlovaInstance } from '../common'

const alovaInstance = createAlovaInstance('/aiuas-system-base')

export const $$userConfigMap = withConfigType({
	'general.getApiBasedataNewInitBaseData': { meta: { isVisitor: true } },
	'general.getApiSettingInitSetting': { meta: { isVisitor: true } },
})

const Apis = createApis(alovaInstance, $$userConfigMap)

export default Apis
