export interface FooterProps {
	/**
	 * 是否启用
	 */
	enable?: boolean
	/**
	 * 是否启用鼠标位置
	 */
	location?: boolean
	/**
	 * 是否启用比例尺
	 */
	scale?: boolean
}

export interface ControlsProps {
	/**
	 * 是否启用
	 */
	enable?: boolean
	/**
	 * 是否启用二维三维切换
	 */
	scene?: boolean
	/**
	 * 是否启用缩放
	 */
	zoom?: boolean
	/**
	 * 是否启用视角重置
	 */
	reset?: boolean
	/**
	 * 是否启用指南针
	 */
	compass?: boolean
}
