<script setup lang="tsx">
import { usePagination } from 'alova/client'
import { NEmpty, NPagination, NPerformantEllipsis } from 'naive-ui'
import { type RenderLabelImpl, type RenderIconImpl, type OnUpdateValueImpl } from 'naive-ui/es/dropdown/src/interface'
import { useHook } from './hook'
import { useOrderLocationIcon } from '@/hooks/use-dynamic-svg'
import { Cartesian3, CustomDataSource, HeightReference, HorizontalOrigin, VerticalOrigin } from 'cesium'
import { TDTApi } from '@/commons/tdt-api'
import { AMapApi } from '@/commons/amap-api'
import gcoord from 'gcoord'

const { viewer, getViewCorners, flyToTarget } = useHook()
const message = useMessage()
const { get: getAppConfig } = useDict('dynamic_config_front_functions')
const isProviderTDT = getAppConfig('map_search_service_provider') === 'tdt'

// #region 获取数据
const keyWord = ref<string>()
const dropdownVisible = ref(false)
const TDT = new TDTApi()
const AMap = new AMapApi(getAppConfig('map_search_service_provider_amap_key'))
const page = computed({
	get() {
		return isProviderTDT ? TdtPage.value : AMapPage.value
	},
	set(value) {
		isProviderTDT ? (TdtPage.value = value) : (AMapPage.value = value)
	},
})
const pageSize = computed({
	get() {
		return isProviderTDT ? TdtPageSize.value : AMapPageSize.value
	},
	set(value) {
		isProviderTDT ? (TdtPageSize.value = value) : (AMapPageSize.value = value)
	},
})
let mapBound: string = null

const {
	loading: TdtLoading,
	page: TdtPage,
	pageSize: TdtPageSize,
	total: TdtTotal,
	data: TdtData,
	send: TdtSend,
} = usePagination(
	(page, pageSize) =>
		TDT.searchPoiByPolygon({
			keyWord: keyWord.value,
			level: '18',
			mapBound: mapBound,
			start: page.toString(),
			count: pageSize.toString(),
			show: '2',
		}),
	{
		total: res => parseInt(res?.count ?? '0'),
		data: res =>
			res.pois.map((item, index) => {
				const [longitude, latitude] = item.lonlat.split(',')
				return {
					label: item.name,
					key: item.hotPointID,
					index: index + 1,
					longitude,
					latitude,
					data: item,
				}
			}),
		initialPage: 1,
		initialData: { count: 0, pois: [] },
		immediate: false,
	},
).onSuccess(() => (dropdownVisible.value = true))

const {
	loading: AMapLoading,
	page: AMapPage,
	pageSize: AMapPageSize,
	data: AMapData,
	send: AMapSend,
} = usePagination(
	(page, pageSize) =>
		AMap.searchPoiByPolygon({
			polygon: mapBound,
			keywords: keyWord.value,
			page_size: pageSize,
			page_num: page,
		}),
	{
		data: res =>
			res.pois.map((item, index) => {
				const [longitudeGCJ02, latitudeGCJ02] = item.location.split(',')
				const [longitude, latitude] = gcoord.transform(
					[Number(longitudeGCJ02), Number(latitudeGCJ02)],
					gcoord.GCJ02,
					gcoord.WGS84,
				)
				return {
					label: item.name,
					key: item.id,
					index: index + 1,
					longitude,
					latitude,
					data: item,
				}
			}),
		initialData: { count: 0, pois: [] },
		immediate: false,
	},
).onSuccess(() => (dropdownVisible.value = true))

function search() {
	try {
		const mapBounds = getViewCorners()
		const { longitude: leftTopLongitude, latitude: leftTopLatitude } = mapBounds[0]
		const { longitude: rightBottomLongitude, latitude: rightBottomLatitude } = mapBounds[2]
		mapBound = `${leftTopLongitude},${leftTopLatitude}${isProviderTDT ? ',' : '|'}${rightBottomLongitude},${rightBottomLatitude}`
		isProviderTDT ? TdtSend() : AMapSend()
	} catch (e) {
		message.error('当前视野范围不支持搜索')
		throw e
	}
}
// #endregion

// #region 渲染下拉菜单选项
const { generateStr: generateIconStr, generateElement: generateIconElement } = useOrderLocationIcon()
const options = computed(() => {
	const data = isProviderTDT ? TdtData.value : AMapData.value
	return [
		...data,
		{
			key: 'footer',
			type: 'render',
			render: () => (
				<>
					{data.length > 0 ? (
						<div class="footer">
							<NPagination
								page={page.value}
								itemCount={isProviderTDT ? TdtTotal.value : undefined}
								pageSize={pageSize.value}
								size="small"
								pageSlot={5}
								simple={!isProviderTDT}
								pageCount={isProviderTDT ? undefined : 100}
								onUpdatePage={value => (page.value = value)}
								onUpdatePageSize={value => (pageSize.value = value)}
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

const renderIcon: RenderIconImpl = option =>
	generateIconElement({ order: option.index as number, type: 'error', size: 20 })

const renderLabel: RenderLabelImpl = option => (
	<div class="option">
		<div class="option_primary">{option.label}</div>
		<div class="option_secondary">
			<NPerformantEllipsis>{option.data['address']}</NPerformantEllipsis>
		</div>
	</div>
)
// #endregion

// #region 下拉菜单显示隐藏
watch(dropdownVisible, value => !value && destroySearchResult())
// #endregion

// #region 绘制结果
let searchResultDataSources = new CustomDataSource('search-result')

watchOnce(viewer, () => {
	viewer.value.dataSources.add(searchResultDataSources)
})

onBeforeUnmount(() => destroySearchResult(true))

watch(
	() => (isProviderTDT ? TdtData.value : AMapData.value),
	value => {
		searchResultDataSources.entities.removeAll()
		value.forEach(({ index, key, longitude, latitude }) => {
			searchResultDataSources.entities.add({
				id: key,
				position: Cartesian3.fromDegrees(longitude, latitude),
				billboard: {
					image: generateIconStr({ order: index, type: 'error' }),
					height: 32,
					width: 32,
					horizontalOrigin: HorizontalOrigin.CENTER,
					verticalOrigin: VerticalOrigin.BOTTOM,
					heightReference: HeightReference.CLAMP_TO_GROUND,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				},
			})
		})
		flyToTarget(searchResultDataSources)
	},
)

function destroySearchResult(destroy = false) {
	searchResultDataSources.entities.removeAll()
	if (!destroy) return
	viewer.value.dataSources.remove(searchResultDataSources, true)
	searchResultDataSources = null
}
// #endregion

// #region 下拉菜单选项点击
const handleDropdownSelect: OnUpdateValueImpl = key => {
	flyToTarget(searchResultDataSources.entities.getById(key as string))
}
// #endregion
</script>

<template>
	<div class="cesium-search">
		<NButton quaternary circle :loading="isProviderTDT ? TdtLoading : AMapLoading" @click="search()">
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
			:render-icon="renderIcon"
			:render-label="renderLabel"
			@select="handleDropdownSelect"
		>
			<NInput
				round
				placeholder="请输入搜索内容"
				clearable
				v-model:value="keyWord"
				@clear="dropdownVisible = false"
				@keydown.enter="search()"
			/>
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
	box-shadow: var(--box-shadow-1);
	box-sizing: border-box;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);
	pointer-events: all;

	:deep(.n-input__input-el) {
		height: 30px;
	}

	:deep(.n-input) {
		&:hover {
			background-color: var(--hover-color);
		}
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
