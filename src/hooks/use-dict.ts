import { useAppStore } from '@/stores/modules/app'

export function useDict(field: string) {
	const appStore = useAppStore()
	return {
		dict: Object.values(appStore.dict?.[field] ?? {}),
		get: (key: string) => Object.values(appStore.dict?.[field] ?? {})?.find(item => item.key === key)?.title,
	}
}
