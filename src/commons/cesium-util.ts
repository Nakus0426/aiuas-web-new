import {
	type Viewer,
	Cartesian2,
	Cartesian3,
	Cartographic,
	Ellipsoid,
	EllipsoidGeodesic,
	PolygonGeometry,
	PolygonHierarchy,
	sampleTerrainMostDetailed,
	WebMercatorProjection,
} from 'cesium'
import earcut from 'earcut'

export class CesiumUtil {
	private readonly viewer: Viewer

	constructor(viewer: Viewer) {
		this.viewer = viewer
	}

	/**
	 * 计算距离（贴地）
	 * @param positions 折线顶点坐标
	 */
	async groundDistance(positions: Cartesian3[]) {
		if (positions.length < 2) return 0
		// 1. 计算非贴地基础长度
		let baseLength = 0
		for (let i = 0; i < positions.length - 1; i++) {
			const geodesic = new EllipsoidGeodesic(
				Cartographic.fromCartesian(positions[i]),
				Cartographic.fromCartesian(positions[i + 1]),
			)
			baseLength += geodesic.surfaceDistance
		}
		// 2. 动态计算采样步长 (基于基础长度)
		const samplingStep = Math.max(5, baseLength / 500)
		// 3. 获取原始顶点的实际地形高度
		const cartographicPositions = positions.map(p => Cartographic.fromCartesian(p))
		const updatedCartographicList = await sampleTerrainMostDetailed(this.viewer.terrainProvider, cartographicPositions)
		// 4. 生成带地形高度的分段采样点
		const allSamplingPoints = []
		for (let i = 0; i < updatedCartographicList.length - 1; i++) {
			const geodesic = new EllipsoidGeodesic(updatedCartographicList[i], updatedCartographicList[i + 1])
			const numPoints = Math.max(2, Math.ceil(geodesic.surfaceDistance / samplingStep) + 1)
			for (let j = 0; j < numPoints; j++) {
				const fraction = j / (numPoints - 1)
				allSamplingPoints.push(geodesic.interpolateUsingFraction(fraction))
			}
		}
		await sampleTerrainMostDetailed(this.viewer.terrainProvider, allSamplingPoints)
		let totalLength = 0
		for (let i = 0; i < allSamplingPoints.length - 1; i++) {
			totalLength += Cartesian3.distance(
				Cartographic.toCartesian(allSamplingPoints[i]),
				Cartographic.toCartesian(allSamplingPoints[i + 1]),
			)
		}
		return totalLength
	}

	/**
	 * 计算距离（椭球）
	 * @param positions 折线顶点坐标
	 */
	ellipsoidDistance(positions: Cartesian3[]) {
		if (positions.length < 2) return 0
		let totalLength = 0
		for (let i = 0; i < positions.length - 1; i++) {
			const geodesic = new EllipsoidGeodesic(
				Cartographic.fromCartesian(positions[i]),
				Cartographic.fromCartesian(positions[i + 1]),
				Ellipsoid.WGS84,
			)
			totalLength += geodesic.surfaceDistance
		}
		return totalLength
	}

	/**
	 * 计算面积（贴地）
	 * @param positions 多边形顶点坐标
	 */
	async groundArea(positions: Cartesian3[]) {
		if (positions.length < 3) return 0
		// 1. 将顶点转换为Cartographic格式并获取实际地形高度
		const cartographicPositions = positions.map(item => Cartographic.fromCartesian(item))
		const updatedCartographicList = await sampleTerrainMostDetailed(this.viewer.terrainProvider, cartographicPositions)
		// 2. 计算多边形在墨卡托投影平面上的面积
		const projection = new WebMercatorProjection()
		const projectedPoints = updatedCartographicList.map(item => projection.project(item))
		let minX = Infinity,
			maxX = -Infinity
		let minY = Infinity,
			maxY = -Infinity
		projectedPoints.forEach(point => {
			minX = Math.min(minX, point.x)
			maxX = Math.max(maxX, point.x)
			minY = Math.min(minY, point.y)
			maxY = Math.max(maxY, point.y)
		})
		// 3. 计算投影平面上的实际多边形面积
		const computeProjectedPolygonArea = (value: Cartesian3[]) => {
			let area = 0
			const n = value.length
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n
				area += value[i].x * value[j].y
				area -= value[j].x * value[i].y
			}
			return Math.abs(area / 2)
		}
		const projectedArea = computeProjectedPolygonArea(projectedPoints)
		if (projectedArea < 0) return 0
		// 4. 自动计算采样密度
		const densityFactor = Math.min(1.0, Math.max(0.1, 2000 / projectedArea))
		const gridStep = Math.min(5000, Math.max(10, Math.sqrt(projectedArea * densityFactor)))
		// 5. 生成网格采样点
		const gridPoints = []
		for (let x = minX; x <= maxX; x += gridStep)
			for (let y = minY; y <= maxY; y += gridStep) gridPoints.push(new Cartesian2(x, y))
		// 6. 过滤出多边形内部的点
		const pointsInsidePolygon = gridPoints.filter(item => {
			let inside = false
			const x = item.x,
				y = item.y
			for (let i = 0, j = projectedPoints.length - 1, len = projectedPoints.length; i < len; j = i++) {
				const xi = projectedPoints[i].x,
					yi = projectedPoints[i].y
				const xj = projectedPoints[j].x,
					yj = projectedPoints[j].y
				const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
				if (intersect) inside = !inside
			}
			return inside
		})
		if (pointsInsidePolygon.length === 0) return projectedArea
		// 7. 为内部点添加地形高度
		const cartographicPoints = pointsInsidePolygon.map(item => projection.unproject(item))
		if (cartographicPoints.filter(p => !isNaN(p.height)).length === 0) return 0
		// 8. 将采样点转换为笛卡尔坐标并三角剖分
		const sampledPositions = cartographicPoints.map(item => Cartographic.toCartesian(item))
		const vertices = []
		sampledPositions.forEach(item => vertices.push(item.x, item.y, item.z))
		const triangles = earcut(vertices, null, 3)
		if (triangles.length === 0) return 0
		// 9. 计算总表面积
		let totalArea = 0
		const v1 = new Cartesian3()
		const v2 = new Cartesian3()
		const v3 = new Cartesian3()
		const ab = new Cartesian3()
		const ac = new Cartesian3()
		const cross = new Cartesian3()
		for (let i = 0; i < triangles.length; i += 3) {
			const idx1 = triangles[i]
			const idx2 = triangles[i + 1]
			const idx3 = triangles[i + 2]
			v1.x = vertices[idx1 * 3]
			v1.y = vertices[idx1 * 3 + 1]
			v1.z = vertices[idx1 * 3 + 2]
			v2.x = vertices[idx2 * 3]
			v2.y = vertices[idx2 * 3 + 1]
			v2.z = vertices[idx2 * 3 + 2]
			v3.x = vertices[idx3 * 3]
			v3.y = vertices[idx3 * 3 + 1]
			v3.z = vertices[idx3 * 3 + 2]
			Cartesian3.subtract(v2, v1, ab)
			Cartesian3.subtract(v3, v1, ac)
			Cartesian3.cross(ab, ac, cross)
			const area = Cartesian3.magnitude(cross) / 2
			if (!isNaN(area) && area > 0) totalArea += area
		}
		return isNaN(totalArea) ? 0 : Math.abs(totalArea)
	}

	/**
	 * 计算面积（椭球）
	 * @param positions 多边形顶点坐标
	 */
	ellipsoidArea(positions: Cartesian3[]) {
		// 1. 创建椭球体多边形几何
		const polygon = new PolygonGeometry({
			polygonHierarchy: new PolygonHierarchy(positions),
			height: 0,
			ellipsoid: Ellipsoid.WGS84,
		})
		// 2. 生成几何体并获取三角网格
		const geometry = PolygonGeometry.createGeometry(polygon)
		if (!geometry) return 0
		// 3. 提取顶点和索引
		const vertices = geometry.attributes.position.values
		const indices = geometry.indices
		// 4. 计算每个三角形的面积并累加
		let totalArea = 0
		const v1 = new Cartesian3()
		const v2 = new Cartesian3()
		const v3 = new Cartesian3()
		for (let i = 0; i < indices.length; i += 3) {
			const i1 = indices[i] * 3
			const i2 = indices[i + 1] * 3
			const i3 = indices[i + 2] * 3
			v1.x = vertices[i1]
			v1.y = vertices[i1 + 1]
			v1.z = vertices[i1 + 2]
			v2.x = vertices[i2]
			v2.y = vertices[i2 + 1]
			v2.z = vertices[i2 + 2]
			v3.x = vertices[i3]
			v3.y = vertices[i3 + 1]
			v3.z = vertices[i3 + 2]
			Cartesian3.subtract(v2, v1, v2)
			Cartesian3.subtract(v3, v1, v3)
			Cartesian3.cross(v2, v3, v1)
			totalArea += Cartesian3.magnitude(v1) / 2
		}
		return Math.abs(totalArea)
	}
}
