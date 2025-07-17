export class NumberUtil {
	constructor() {}

	/**
	 * 格式化距离
	 * @param value 距离（米）
	 */
	static formatDistance(value: number): string {
		// 极小距离（厘米级）
		if (value < 0.1) {
			const cm = Math.round(value * 100)
			return cm > 0 ? `${cm} 厘米` : '<1 厘米'
		}

		// 小距离（1米以下）
		if (value < 1) return `${Math.round(value * 100) / 100} 米`

		// 中等距离（1-1000米）
		if (value < 1000) {
			// 小于100米时保留2位小数
			if (value < 100) return `${Math.round(value * 100) / 100} 米`
			// 100-1000米时保留1位小数
			return `${Math.round(value * 10) / 10} 米`
		}

		const km = value / 1000
		// 极大距离（≥100公里）
		if (km >= 100) {
			// 整数公里
			if (km % 1 === 0) return `${km} 公里`
			// 保留1位小数
			return `${Math.round(km * 10) / 10} 公里`
		}

		// 中等公里距离（1-100公里）
		if (km >= 10) {
			// 保留1位小数
			const rounded = Math.round(km * 10) / 10
			return rounded % 1 === 0 ? `${Math.round(km)} 公里` : `${rounded} 公里`
		}

		// 小公里距离（<10公里）
		// 保留2位小数
		const rounded = Math.round(km * 100) / 100
		return rounded % 1 === 0 ? `${Math.round(km)} 公里` : `${rounded} 公里`
	}

	/**
	 * 格式化面积
	 * @param value 面积（平方米）
	 */
	static formatArea(value: number): string {
		// 极小面积
		if (value < 1) {
			const cm2 = Math.round(value * 10000)
			return cm2 > 0 ? `${cm2} 平方厘米` : '<1 平方厘米'
		}

		// 小面积（1-100平方米）
		if (value < 100) {
			return `${Math.round(value * 100) / 100} 平方米`
		}

		// 中等面积（100-10000平方米）
		if (value < 10000) {
			// 小于1000平方米保留1位小数
			if (value < 1000) return `${Math.round(value * 10) / 10} 平方米`
			// 1000-10000平方米显示整数
			return `${Math.round(value)} 平方米`
		}

		const km2 = value / 1000000
		// 极小平方公里（<0.01平方公里）
		if (km2 < 0.01) return `${Math.round(km2 * 1000000)} 平方米`

		// 小平方公里（0.01-0.1平方公里）
		if (km2 < 0.1) return `${Math.round(km2 * 10000) / 10000} 平方公里`

		// 中等平方公里（0.1-10平方公里）
		if (km2 < 10) {
			// 小于1平方公里保留3位小数
			if (km2 < 1) return `${Math.round(km2 * 1000) / 1000} 平方公里`
			// 1-10平方公里保留2位小数
			return `${Math.round(km2 * 100) / 100} 平方公里`
		}

		// 大平方公里（10-100平方公里）
		if (km2 < 100) {
			// 保留1位小数
			const rounded = Math.round(km2 * 10) / 10
			return rounded % 1 === 0 ? `${Math.round(km2)} 平方公里` : `${rounded} 平方公里`
		}

		// 极大平方公里（≥100平方公里）
		// 保留整数
		return `${Math.round(km2)} 平方公里`
	}
}
