import { defineStore } from 'pinia'

/**
 * 系统状态
 */
export const useAppStore = defineStore(
	'APP',
	() => {
		// #region 初始化系统
		const setting = ref<Record<string, any>>()
		const dict = ref<Record<string, Array<{ key: string; title: string }>>>()

		async function init() {
			const [baseDataRes, settingRes] = await Promise.all([
				BaseApis.general.getApiBasedataNewInitBaseData(),
				BaseApis.general.getApiSettingInitSetting({ params: {} }),
			])
			dict.value = baseDataRes.data
			setting.value = settingRes.data
		}
		// #endregion

		return { init, setting, dict }
	},
	{
		persist: {
			pick: ['setting', 'dict'],
		},
	},
)
