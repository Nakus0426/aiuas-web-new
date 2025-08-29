<script setup lang="ts">
import { dateZhCN, zhCN, lightTheme, darkTheme } from 'naive-ui'
import { darkThemeOverrides, lightThemeOverrides } from '@/configs/theme'
import ProviderContent from './provider-content.vue'
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

const themeOverrides = computed(() => (appStore.preferences.darkMode ? darkThemeOverrides : lightThemeOverrides))
const theme = computed(() => (appStore.preferences.darkMode ? darkTheme : lightTheme))
</script>

<template>
	<NConfigProvider
		abstract
		inline-theme-disabled
		:locale="zhCN"
		:date-locale="dateZhCN"
		:theme-overrides="themeOverrides"
		:theme
	>
		<NGlobalStyle />
		<NLoadingBarProvider>
			<NMessageProvider>
				<NNotificationProvider>
					<NDialogProvider>
						<NModalProvider>
							<ProviderContent>
								<NElement class="app" id="container">
									<slot />
								</NElement>
							</ProviderContent>
						</NModalProvider>
					</NDialogProvider>
				</NNotificationProvider>
			</NMessageProvider>
		</NLoadingBarProvider>
	</NConfigProvider>
</template>

<style scoped lang="scss">
.app {
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
