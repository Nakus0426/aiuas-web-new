import {
	type Viewer,
	Cartesian2,
	Cartesian3,
	Cartographic,
	Ellipsoid,
	EllipsoidGeodesic,
	Matrix4,
	PolygonGeometry,
	PolygonHierarchy,
	sampleTerrain,
	sampleTerrainMostDetailed,
	Transforms,
	WebMercatorProjection,
} from 'cesium'
import earcut from 'earcut'

export class CesiumUtil {
	private readonly viewer: Viewer
	private readonly ellipsoid = Ellipsoid.WGS84

	constructor(viewer: Viewer) {
		this.viewer = viewer
	}

	/**
	 * 生成圆形顶点
	 * @param  centerPosition - 圆心
	 * @param  radius - 半径
	 * @param  segments - 分段数
	 */
	generateCircleVertices(centerPosition: Cartesian3, radius: number, segments: number) {
		// 验证输入参数
		if (!centerPosition || !radius || !segments || radius <= 0 || segments <= 0) return []
		const positions = []
		try {
			// 创建局部参考坐标系
			const localFrame = Transforms.eastNorthUpToFixedFrame(centerPosition)
			const transform = Matrix4.inverse(localFrame, new Matrix4())
			for (let i = 0; i < segments; i++) {
				const angle = (2 * Math.PI * i) / segments
				const east = Math.sin(angle) * radius
				const north = Math.cos(angle) * radius
				// 验证计算结果
				if (!isFinite(east) || !isFinite(north)) continue
				// 局部位置
				const localPosition = new Cartesian3(east, north, 0)
				// 转换为全局坐标
				const position = Matrix4.multiplyByPoint(transform, localPosition, new Cartesian3())
				// 验证转换后的坐标
				if (position && isFinite(position.x) && isFinite(position.y) && isFinite(position.z)) positions.push(position)
			}
		} catch (error) {
			console.error('Error generating circle vertices:', error)
			return []
		}
		return positions
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
				this.ellipsoid,
			)
			totalLength += geodesic.surfaceDistance
		}
		return totalLength
	}

	/**
	 * 计算多边形面积（贴地）
	 * @param positions 多边形顶点坐标
	 */
	async groundPolygonArea(positions: Cartesian3[]) {
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
	 * 计算多边形面积（椭球）
	 * @param positions 多边形顶点坐标
	 */
	ellipsoidPolygonArea(positions: Cartesian3[]) {
		// 1. 创建椭球体多边形几何
		const polygon = new PolygonGeometry({
			polygonHierarchy: new PolygonHierarchy(positions),
			height: 0,
			ellipsoid: this.ellipsoid,
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

	/**
	 * 计算圆形面积（贴地）
	 * @param centerPosition 圆心坐标
	 * @param radius 半径
	 */
	async groundEllipseArea(centerPosition: Cartesian3, radius: number) {
		// 检查输入参数的有效性
		if (!centerPosition || radius <= 0) return 0
		// 对小半径直接返回椭球面面积
		if (radius < 100) return this.ellipsoidEllipseArea(centerPosition, radius)
		// 根据半径自适应设置分段数
		const radialSegments = Math.min(180, Math.max(20, Math.ceil(Math.min(radius / 10, 180))))
		// 自适应地形采样LOD
		const terrainLevel = radius > 5000 ? (radius > 20000 ? 9 : 11) : 13
		// 1. 生成圆形顶点
		const positions = this.generateCircleVertices(centerPosition, radius, radialSegments)
		// 2. 采样中心点高度（用于可视化参考）
		const centerWithHeight = await sampleTerrainMostDetailed(this.viewer.terrainProvider, [
			this.ellipsoid.cartesianToCartographic(centerPosition),
		])
		// 3. 转换顶点并采样地形高度（批量处理）
		const cartographicList = positions.map(item => this.ellipsoid.cartesianToCartographic(item))
		await sampleTerrain(this.viewer.terrainProvider, terrainLevel, cartographicList)
		// 4. 过滤无效点（高度NaN）
		const validPoints = cartographicList.filter(p => !isNaN(p.height))
		if (validPoints.length < 3) return this.ellipsoidEllipseArea(centerPosition, radius)
		// 5. 将点转回笛卡尔坐标
		const terrainPositions = validPoints.map(item => this.ellipsoid.cartographicToCartesian(item))
		// 6. 创建扇形三角网
		const vertices = []
		terrainPositions.forEach(item => vertices.push(item.x, item.y, item.z))
		const centerCartesian = this.ellipsoid.cartographicToCartesian(centerWithHeight[0])
		vertices.push(centerCartesian.x, centerCartesian.y, centerCartesian.z)
		const triangles = []
		const centerIndex = validPoints.length // 中心点索引
		for (let i = 0; i < validPoints.length; i++) {
			const nextIndex = (i + 1) % validPoints.length
			triangles.push(centerIndex, i, nextIndex)
		}
		// 7. 计算总面积（使用优化后的三角形面积计算）
		let totalArea = 0
		const v1 = new Cartesian3()
		const v2 = new Cartesian3()
		const v3 = new Cartesian3()
		for (let i = 0; i < triangles.length; i += 3) {
			const i1 = triangles[i]
			const i2 = triangles[i + 1]
			const i3 = triangles[i + 2]
			v1.x = vertices[i1 * 3]
			v1.y = vertices[i1 * 3 + 1]
			v1.z = vertices[i1 * 3 + 2]
			v2.x = vertices[i2 * 3]
			v2.y = vertices[i2 * 3 + 1]
			v2.z = vertices[i2 * 3 + 2]
			v3.x = vertices[i3 * 3]
			v3.y = vertices[i3 * 3 + 1]
			v3.z = vertices[i3 * 3 + 2]
			// 优化：跳过退化三角形
			const d1 = Cartesian3.distance(v1, v2)
			const d2 = Cartesian3.distance(v1, v3)
			const d3 = Cartesian3.distance(v2, v3)
			if (d1 < 0.1 || d2 < 0.1 || d3 < 0.1) continue
			// 计算向量并求面积
			Cartesian3.subtract(v2, v1, v2)
			Cartesian3.subtract(v3, v1, v3)
			Cartesian3.cross(v2, v3, v1)
			totalArea += Cartesian3.magnitude(v1) / 2
		}
		return totalArea
	}

	/**
	 * 计算圆形面积（椭球）
	 * @param centerPosition 圆心坐标
	 * @param radius 半径
	 */
	ellipsoidEllipseArea(centerPosition: Cartesian3, radius: number) {
		// 检查输入参数的有效性
		if (!centerPosition || radius <= 0) return 0
		// 1. 获取椭球体的几何参数
		const radii = this.ellipsoid.radii
		const radiiSquared = this.ellipsoid.radiiSquared
		// 2. 计算偏心率平方
		// e² = 1 - (polarRadius² / equatorialRadius²)
		const eccentricitySquared = 1 - radiiSquared.z / radiiSquared.x
		// 3. 将圆心转换为经纬度坐标
		const centerCartographic = this.ellipsoid.cartesianToCartographic(centerPosition)
		if (!centerCartographic) return 0
		// 4. 计算卯酉圈曲率半径 (N)
		const sinPhi = Math.sin(centerCartographic.latitude)
		const denom = Math.sqrt(1 - eccentricitySquared * sinPhi * sinPhi)
		const N = radii.x / denom
		// 5. 计算圆环的角半径 (δ)
		const delta = radius / N
		// 6. 精确计算椭球面上的圆形面积
		// 公式: A = 2πN²(1 - cos(δ))
		return 2 * Math.PI * N * N * (1 - Math.cos(delta))
	}
}
