import { Cartesian2, Cartographic, WebMercatorProjection, WebMercatorTilingScheme, Math as CesiumMath } from 'cesium'
import gcoord from 'gcoord'

export const SUB_DOMAINS = ['1', '2', '3', '4']

export const API_SERVICE_ALIAS = '/amap'

export const IMG_SERVICE = `https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&style=6&ltype=0&scl=0&size=0`

export const CIA_SERVICE = `https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&style=8&ltype=0&scl=0&size=0`

export class AmapMercatorTilingScheme extends WebMercatorTilingScheme {
	private _projection = {
		project: null,
		unproject: null,
	}
	constructor(options) {
		super(options)
		let projection = new WebMercatorProjection()
		this._projection.project = (cartographic, result) => {
			result = gcoord.transform(
				[CesiumMath.toDegrees(cartographic.longitude), CesiumMath.toDegrees(cartographic.latitude)],
				gcoord.WGS84,
				gcoord.GCJ02,
			)
			result = projection.project(new Cartographic(CesiumMath.toRadians(result[0]), CesiumMath.toRadians(result[1])))
			return new Cartesian2(result.x, result.y)
		}
		this._projection.unproject = (cartesian, result) => {
			let cartographic = projection.unproject(cartesian)
			result = gcoord.transform(
				[CesiumMath.toDegrees(cartographic.longitude), CesiumMath.toDegrees(cartographic.latitude)],
				gcoord.GCJ02,
				gcoord.WGS84,
			)
			return new Cartographic(CesiumMath.toRadians(result[0]), CesiumMath.toRadians(result[1]))
		}
	}
}
