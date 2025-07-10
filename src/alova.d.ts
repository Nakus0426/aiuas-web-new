import 'alova'

declare module 'alova' {
	export interface AlovaCustomTypes {
		meta: {
			isVisitor?: boolean
			responsedIgnore?: boolean
			feedbackIgnore?: boolean
		}
	}
}
