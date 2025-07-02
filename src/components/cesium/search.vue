<script setup lang="tsx">
import { usePagination } from 'alova/client'
import { NEmpty, NPagination, NPerformantEllipsis } from 'naive-ui'
import { type RenderLabelImpl } from 'naive-ui/es/dropdown/src/interface'
import { useHook } from './hook'

const { getViewCorners } = useHook()
const message = useMessage()

const keyWord = ref<string>()
const dropdownVisible = ref(false)
const options = computed(() => {
	const formatedData = data.value.map((item, index) => ({
		label: item.name,
		key: item.hotPointID,
		index,
		data: item,
	}))
	return [
		...formatedData,
		{
			key: 'footer',
			type: 'render',
			render: () => (
				<>
					{data.value.length > 0 ? (
						<div class="footer">
							<NPagination
								page={page.value}
								itemCount={total.value}
								pageSize={pageSize.value}
								size="small"
								pageSlot={5}
							/>
						</div>
					) : (
						<div class="empty">
							<NEmpty size="small" />
						</div>
					)}
				</>
			),
		},
	]
})

const { loading, page, pageSize, total, data, send, onSuccess } = usePagination(
	(page, pageSize) => {
		try {
			const mapBounds = getViewCorners()
			const { longitude: leftTopLongitude, latitude: leftTopLatitude } = mapBounds[0]
			const { longitude: rightBottomLongitude, latitude: rightBottomLatitude } = mapBounds[2]
			return TdtApis.searchInView({
				keyWord: keyWord.value,
				level: '18',
				mapBound: `${leftTopLongitude},${leftTopLatitude},${rightBottomLongitude},${rightBottomLatitude}`,
				start: page.toString(),
				count: pageSize.toString(),
				show: '2',
			})
		} catch (e) {
			message.error('当前视野范围不支持搜索')
			throw e
		}
	},
	{
		total: res => parseInt(res.count || '0'),
		data: res => res.pois || [],
		initialData: { count: 0, pois: [] },
		immediate: false,
	},
)

onSuccess(() => (dropdownVisible.value = true))

const renderLabel: RenderLabelImpl = option => (
	<div class="option">
		<div class="option_primary">{option.label}</div>
		<div class="option_secondary">
			<NPerformantEllipsis>{option.data['address']}</NPerformantEllipsis>
		</div>
	</div>
)
</script>

<template>
	<div class="cesium-search">
		<NButton quaternary circle :loading @click="send()">
			<template #icon>
				<Icon icon="tabler:search" />
			</template>
		</NButton>
		<NDropdown
			trigger="manual"
			placement="bottom-start"
			:show="dropdownVisible"
			:width="300"
			:options
			:to="false"
			:render-label="renderLabel"
		>
			<NInput round placeholder="请输入搜索内容" clearable v-model:value="keyWord" @clear="dropdownVisible = false" />
		</NDropdown>
	</div>
</template>

<style scoped lang="scss">
.cesium-search {
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	padding: 5px;
	background-color: var(--card-color);
	border-radius: 20px;
	border: 1px solid var(--border-color);
	box-shadow: var(--box-shadow-1);
	box-sizing: border-box;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);

	:deep(.n-input__input-el) {
		height: 30px;
	}

	:deep(.n-input__border),
	:deep(.n-input__state-border) {
		display: none;
	}

	button {
		width: 30px;
		height: 30px;
		display: flex;
		justify-content: center;
		align-items: center;
		border: none;
		border-radius: 15px;
		cursor: pointer;
		background-color: transparent;
		transition: all 0.2s var(--cubic-bezier-ease-in-out);
		font-size: 20px;

		&:hover {
			background-color: var(--hover-color);
		}
	}
}

:deep(.footer) {
	display: flex;
	justify-content: flex-end;
	padding: 8px 8px 4px 8px;
	border-top: 1px solid var(--border-color);
	margin-top: 4px;
}

:deep(.empty) {
	display: flex;
	justify-content: center;
	padding: 4px 8px 4px 8px;
}

:deep(.option) {
	display: flex;
	flex-direction: column;
	padding: 4px 0;
	overflow: hidden;
}

:deep(.option_primary) {
	color: var(--text-color-1);
}

:deep(.option_secondary) {
	color: var(--text-color-3);
	font-size: var(--font-size-small);
}

:deep(.n-dropdown-option-body) {
	height: auto !important;
	line-height: var(--line-height) !important;
}

:deep(.n-dropdown-option-body__label) {
	overflow: hidden;
}
</style>
