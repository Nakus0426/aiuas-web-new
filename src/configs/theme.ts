import { type GlobalThemeOverrides } from 'naive-ui'

export const themeOverrides: GlobalThemeOverrides = {
	common: {
		fontSizeSmall: '12px',
		fontSizeLarge: '16px',
		fontFamily: 'HarmonyOS-Sans-SC',
		primaryColor: '#783178',
		primaryColorHover: '#a0579d',
		primaryColorPressed: '#662d65',
		primaryColorSuppl: '#a0579d',
		borderRadius: '8px',
	},
	Tooltip: {
		padding: '2px 8px',
	},
	Dialog: {
		padding: '16px',
		contentMargin: '16px 0 0 0',
	},
	Typography: {
		headerMargin1: '8px',
		headerMargin2: '8px',
		headerMargin3: '8px',
		headerMargin4: '8px',
		headerMargin5: '8px',
		headerMargin6: '8px',
	},
}
