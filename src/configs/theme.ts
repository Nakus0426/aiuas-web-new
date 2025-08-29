import { toMerged } from 'es-toolkit'
import { type GlobalThemeOverrides } from 'naive-ui'

const baseThemeOverrides: GlobalThemeOverrides = {
	common: {
		fontSizeSmall: '12px',
		fontSizeLarge: '16px',
		fontFamily: 'HarmonyOS-Sans-SC',
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

export const lightThemeOverrides = toMerged<GlobalThemeOverrides, GlobalThemeOverrides>(baseThemeOverrides, {
	common: {
		primaryColor: '#783178',
		primaryColorHover: '#a0579d',
		primaryColorPressed: '#662d65',
		primaryColorSuppl: '#a0579d',
		textColor1: 'rgba(0, 0, 0, 0.9)',
		textColor2: 'rgba(0, 0, 0, 0.52)',
		textColor3: 'rgba(0, 0, 0, 0.38)',
	},
})

export const darkThemeOverrides = toMerged<GlobalThemeOverrides, GlobalThemeOverrides>(baseThemeOverrides, {
	common: {
		primaryColor: '#692d69',
		primaryColorHover: '#7a4678',
		primaryColorPressed: '#552755',
		primaryColorSuppl: '#7a4678',
	},
})
