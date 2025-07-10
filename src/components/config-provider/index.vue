<script setup lang="ts">
import { dateZhCN, zhCN } from 'naive-ui'
import { themeOverrides } from '@/configs/theme'
import ProviderContent from './provider-content.vue'
</script>

<template>
	<NConfigProvider abstract inline-theme-disabled :locale="zhCN" :date-locale="dateZhCN" :theme-overrides>
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
