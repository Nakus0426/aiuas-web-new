<script setup lang="ts">
import {
	Cartesian3,
	Color,
	CustomDataSource,
	EllipseGraphics,
	Entity,
	HeightReference,
	PolygonGraphics,
	PolygonHierarchy,
} from 'cesium'
import { useHook } from './hook'
import { type CheckboxGroupProps } from 'naive-ui'
import { flatMap, flattenDeep } from 'es-toolkit'

const { viewer, organizationId } = useHook()
const message = useMessage()

watchOnce(viewer, () => {
	viewer.value.dataSources.add(restrictedFlightZoneDataSource)
	initRestrictedFlightZone()
})

// #region 限飞区
const enum RestrictedFlightZoneEnum {
	Warning = 0,
	Authorization = 1,
	Prohibition = 2,
	EnhancementOfWarning = 3,
	LimitHeight = 6,
	RegulationConstraint = 7,
	RegulationApply = 8,
}
const restrictedFlightZoneOptions = [
	{
		label: '警示区',
		key: RestrictedFlightZoneEnum.Warning,
		tip: '在警示区范围，地图中未必显示全部的警示区。用户会在飞行至该区域时收到警示（例如：自然保护区）',
		color: '255, 204, 0',
	},
	{
		label: '授权区',
		key: RestrictedFlightZoneEnum.Authorization,
		tip: '此区域在地图上显示为蓝色。当飞行于该区域时，系统将默认发送飞行警示以及飞行限制信息。已授权用户可使用 DJI 大疆认证账号解禁授权区的飞行限制',
		color: '16, 136, 242',
	},
	{
		label: '禁飞区',
		key: RestrictedFlightZoneEnum.Prohibition,
		tip: '此区域在地图上显示为红色，飞行器将无法在此区域飞行。如您已获得有关部门在此区域的飞行许可，请在线申请解禁或者联系 flysafe@dji.com 申请解禁',
		color: '222, 67, 41',
	},
	{
		label: '加强警示区',
		key: RestrictedFlightZoneEnum.EnhancementOfWarning,
		tip: '当飞行于加强警示区时，您会实时接收到来自 GEO 的信息，要求您解禁在该区域的飞行限制（步骤与授权区解禁相同），完成解禁步骤时无需提供认证的账户，也无需连接网络',
		color: '238, 136, 21',
	},
	{
		label: '限高区',
		key: RestrictedFlightZoneEnum.LimitHeight,
		tip: '此区域在地图上显示为灰色。飞行器在此区域飞行时，飞行高度将受到限制。示例：机场附近的灰色区域',
		color: '151, 151, 151',
	},
	{
		label: '法规限制区',
		key: RestrictedFlightZoneEnum.RegulationConstraint,
		tip: '由于当地的法规和政策规定，部分特殊区域的所在范围内禁止飞行（例如：监狱）',
		color: '55, 196, 219',
	},
	{
		label: '轻型无人机适飞空域',
		key: RestrictedFlightZoneEnum.RegulationApply,
		tip: '此区域在地图上显示为绿色，法规所规定的适飞空域。轻型无人机在此适飞空域内，飞行真高在120米以下，无需飞行申请；如需要在120米以上空域或者非适飞空域飞行，需要通过 UTMISS 综合监管平台提前进行飞行申请',
		color: '0, 190, 0',
	},
]
let restrictedFlightZoneData = []
let restrictedFlightZoneDataSource = new CustomDataSource('restrictedFlightZone')
const restrictedFlightZones = ref<RestrictedFlightZoneEnum[]>([RestrictedFlightZoneEnum.Prohibition])

async function initRestrictedFlightZone() {
	try {
		const res = await BaseApis.general.getApiRestrictedFlyZoneGetRestrictedFlyZone({ params: { organizationId } })
		if (!res.data?.restrictedFlyZoneFileId) return
		const file = await BaseApis.general.getApiFileDownload1({
			pathParams: { id: res.data.restrictedFlyZoneFileId as unknown as number },
			transform: (data: Response) => data.json(),
		})
		restrictedFlightZoneData = flatMap(file, (item: any) => {
			const res = []
			let subAreas = item['sub_areas']
			if (subAreas && subAreas.length > 0) {
				subAreas.map(subArea => {
					if (subArea.height > 0) subArea.level = 6
				})
				res.push(...subAreas)
				return res
			}
			if (item.height > 0) item.level = 6
			res.push(item)
			return res
		})
		restrictedFlightZones.value.forEach(drawRestrictedFlightZone)
	} catch (e) {
		console.error(e)
		message.error('初始化限飞区失败')
	}
}

function drawRestrictedFlightZone(_level) {
	restrictedFlightZoneData.forEach(({ lng, lat, color, shape, radius, polygon_points, level }) => {
		if (level !== _level) return
		const entity = new Entity({ position: Cartesian3.fromDegrees(lng, lat), properties: { level } })
		const material = Color.fromCssColorString(color)
		if (polygon_points)
			entity.polygon = new PolygonGraphics({
				hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(flattenDeep(polygon_points))),
				heightReference: HeightReference.CLAMP_TO_GROUND,
				material: material.withAlpha(0.4),
			})
		else
			entity.ellipse = new EllipseGraphics({
				semiMajorAxis: radius,
				semiMinorAxis: radius,
				heightReference: HeightReference.CLAMP_TO_GROUND,
				material: material.withAlpha(0.3),
			})
		restrictedFlightZoneDataSource.entities.add(entity)
	})
}

const handleRestrictedFlightZonesUpdate: CheckboxGroupProps['onUpdate:value'] = (value, meta) => {
	if (meta.actionType === 'check') drawRestrictedFlightZone(meta.value)
	else
		restrictedFlightZoneDataSource.entities.values
			.filter(item => item.properties.getValue().level === meta.value)
			.forEach(item => restrictedFlightZoneDataSource.entities.remove(item))
}

onBeforeUnmount(() => {
	restrictedFlightZoneDataSource.entities.removeAll()
	viewer.value.dataSources.remove(restrictedFlightZoneDataSource)
	restrictedFlightZoneDataSource = null
})
// #endregion
</script>

<template>
	<NPopover to="#container" :width="220">
		<template #trigger>
			<NTooltip>
				<template #trigger>
					<button class="layers">
						<Icon width="24" height="24" icon="tabler:stack-back" />
					</button>
				</template>
				图层
			</NTooltip>
		</template>
		<div class="layers_popover">
			<div class="layers_popover_header">图层设置</div>
			<OverlayScrollbar class="layers_popover_body">
				<div class="cell">
					<div class="cell_header">限飞区</div>
					<div class="cell_body">
						<NCheckboxGroup v-model:value="restrictedFlightZones" @update:value="handleRestrictedFlightZonesUpdate">
							<NCheckbox v-for="item in restrictedFlightZoneOptions" :key="item.key" :value="item.key">
								<NFlex align="center" size="small">
									<div
										:style="{
											height: 'var(--font-size)',
											width: 'var(--font-size)',
											borderWidth: '1px',
											borderStyle: 'solid',
											borderRadius: 'var(--n-border-radius)',
											borderColor: `rgb(${item.color})`,
											backgroundColor: `rgba(${item.color},0.3)`,
										}"
									/>
									<span>{{ item.label }}</span>
									<HelpTooltip>{{ item.tip }}</HelpTooltip>
								</NFlex>
							</NCheckbox>
						</NCheckboxGroup>
					</div>
				</div>
			</OverlayScrollbar>
		</div>
	</NPopover>
</template>

<style scoped lang="scss">
.layers {
	width: 40px;
	height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: var(--card-color);
	border-radius: 20px;
	box-shadow: var(--box-shadow-1);
	border: 1px solid var(--border-color);
	cursor: pointer;
	transition: all 0.2s var(--cubic-bezier-ease-in-out);
	font-size: 20px;
	color: var(--text-color-2);
	pointer-events: all;

	&:hover {
		background-color: var(--hover-color);
	}

	&_popover {
		max-height: 400px;
		display: flex;
		flex-direction: column;

		&_header {
			font-size: var(--font-size-large);
			font-weight: bold;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--border-color);
		}

		.cell {
			padding: 8px 0;

			&_header {
				display: flex;
				align-items: center;
				gap: 4px;
				padding-bottom: 8px;
			}

			&_body {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
		}
	}
}

:deep(.n-radio-group),
:deep(.n-checkbox-group) {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

:deep(.n-radio),
:deep(.n-checkbox) {
	flex-direction: row-reverse;
	justify-content: space-between;
	padding: 4px 8px;
	border-radius: var(--border-radius);
	transition: all 0.2s var(--cubic-bezier-ease-in-out);

	&:hover {
		background-color: var(--hover-color);
	}
}

:deep(.n-radio__label),
:deep(.n-checkbox__label) {
	padding: 0;
}

:deep(.n-radio--checked),
:deep(.n-checkbox--checked) {
	background-color: var(--hover-color);
}
</style>
