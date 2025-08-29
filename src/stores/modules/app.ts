import { defineStore } from 'pinia'

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

		// #region 本地偏好设置
		const preferences = ref({
			cesiumMeasureClampToGround: false,
			darkMode: false,
		})
		// #endregion

		return { setting, dict, preferences, init }
	},
	{
		persist: {
			pick: ['setting', 'dict', 'preference'],
		},
	},
)
