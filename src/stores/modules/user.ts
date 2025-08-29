import { defineStore } from 'pinia'

export const useUserStore = defineStore(
	'USER',
	() => {
		const token = ref<string>()
		const refreshToken = ref<string>()

		return { token, refreshToken }
	},
	{
		persist: [
			{ pick: ['token'], storage: localStorage },
			{ pick: ['refreshToken'], storage: sessionStorage },
		],
	},
)
