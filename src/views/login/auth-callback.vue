<template>
	<div class="auth-callback">
		<canvas ref="canvas" />
		<ShinyText class="logging-in" content="正在登录..."></ShinyText>
	</div>
</template>

<script setup lang="ts">
import { TinyColor } from '@ctrl/tinycolor'

const themeVars = useThemeVars()

// #region 背景
const canvasRef = useTemplateRef('canvas')
let request: number = null
let numSquaresX: number = 0
let numSquaresY: number = 0
const gridOffset = { x: 0, y: 0 }
let hoveredSquare = null
const squareSize = 40
let ctx: CanvasRenderingContext2D | null = null
const colors = computed(() => ({
	fill: themeVars.value.primaryColorHover,
	stroke: themeVars.value.tagColor,
	gradient1: new TinyColor(themeVars.value.bodyColor).setAlpha(0).toRgbString(),
	gradient2: themeVars.value.bodyColor,
}))

function resizeCanvas() {
	if (!canvasRef.value) return
	canvasRef.value.width = canvasRef.value.offsetWidth
	canvasRef.value.height = canvasRef.value.offsetHeight
	numSquaresX = Math.ceil(canvasRef.value.width / squareSize) + 1
	numSquaresY = Math.ceil(canvasRef.value.height / squareSize) + 1
}

function drawGrid() {
	if (!ctx || !canvasRef.value) return
	const { width: canvasWidth, height: canvasHeight } = canvasRef.value
	ctx.clearRect(0, 0, canvasWidth, canvasHeight)
	const startX = Math.floor(gridOffset.x / squareSize) * squareSize
	const startY = Math.floor(gridOffset.y / squareSize) * squareSize
	for (let x = startX; x < canvasWidth + squareSize; x += squareSize) {
		for (let y = startY; y < canvasHeight + squareSize; y += squareSize) {
			const squareX = x - (gridOffset.x % squareSize)
			const squareY = y - (gridOffset.y % squareSize)
			if (
				hoveredSquare &&
				Math.floor((x - startX) / squareSize) === hoveredSquare.x &&
				Math.floor((y - startY) / squareSize) === hoveredSquare.y
			) {
				ctx.fillStyle = colors.value.fill
				ctx.fillRect(squareX, squareY, squareSize, squareSize)
			}
			ctx.strokeStyle = colors.value.stroke
			ctx.strokeRect(squareX, squareY, squareSize, squareSize)
		}
	}
	const gradient = ctx.createRadialGradient(
		canvasWidth / 2,
		canvasHeight / 2,
		0,
		canvasWidth / 2,
		canvasHeight / 2,
		Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2) / 2,
	)
	gradient.addColorStop(0, colors.value.gradient1)
	gradient.addColorStop(1, colors.value.gradient2)
	ctx.fillStyle = gradient
	ctx.fillRect(0, 0, canvasWidth, canvasHeight)
}

function updateAnimation() {
	const effectiveSpeed = 1
	gridOffset.x = (gridOffset.x - effectiveSpeed + squareSize) % squareSize
	gridOffset.y = (gridOffset.y - effectiveSpeed + squareSize) % squareSize
	drawGrid()
	request = requestAnimationFrame(updateAnimation)
}

function handleMouseMove(event: MouseEvent) {
	const canvas = canvasRef.value
	if (!canvas) return

	const rect = canvas.getBoundingClientRect()
	const mouseX = event.clientX - rect.left
	const mouseY = event.clientY - rect.top

	const startX = Math.floor(gridOffset.x / squareSize) * squareSize
	const startY = Math.floor(gridOffset.y / squareSize) * squareSize

	const hoveredSquareX = Math.floor((mouseX + gridOffset.x - startX) / squareSize)
	const hoveredSquareY = Math.floor((mouseY + gridOffset.y - startY) / squareSize)

	if (!hoveredSquare || hoveredSquare.x !== hoveredSquareX || hoveredSquare.y !== hoveredSquareY) {
		hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY }
	}
}

function handleMouseLeave() {
	hoveredSquare = null
}

function initializeCanvas() {
	const canvas = canvasRef.value
	if (!canvas) return

	ctx = canvas.getContext('2d')
	resizeCanvas()

	canvas.addEventListener('mousemove', handleMouseMove)
	canvas.addEventListener('mouseleave', handleMouseLeave)
	window.addEventListener('resize', resizeCanvas)

	request = requestAnimationFrame(updateAnimation)
}

function cleanup() {
	if (request) {
		cancelAnimationFrame(request)
		request = null
	}
	if (canvasRef.value) {
		canvasRef.value.removeEventListener('mousemove', handleMouseMove)
		canvasRef.value.removeEventListener('mouseleave', handleMouseLeave)
	}
	window.removeEventListener('resize', resizeCanvas)
}

onMounted(() => initializeCanvas())

onUnmounted(() => cleanup())
// #endregion
</script>

<style lang="css" scoped>
.auth-callback {
	width: 100%;
	height: 100%;
}

canvas {
	width: 100%;
	height: 100%;
}

.logging-in {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	font-size: 32px;
	font-weight: bold;
}
</style>
