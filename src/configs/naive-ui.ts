import { NPopconfirm, NPopover, NTooltip } from 'naive-ui'

function setupNaiveUIDefaultConfig() {
	NPopover.props.showArrow = false
	NTooltip.props.showArrow = false
	NPopconfirm.props.showArrow = false
}

setupNaiveUIDefaultConfig()
