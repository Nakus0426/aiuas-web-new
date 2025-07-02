export default {
	generator: [
		{
			input: 'aiuas-system-base.json',
			output: 'src/apis/base',
			type: 'ts',
			global: 'BaseApis',
			handleApi: apiDescriptor => {
				const url = apiDescriptor.url
					.replace(/^\//, '')
					.replace(/\/{[^}]+}/g, '')
					.replace(/\//g, '_')
				const camelCaseUrl = toCamelCase(url)
				let operationId = `${apiDescriptor.method}${camelCaseUrl.charAt(0).toUpperCase()}${camelCaseUrl.slice(1)}`
				operationId = ensureUnique(operationId)
				apiDescriptor.operationId = operationId
				existingOperationIdList.push(operationId)
				return apiDescriptor
			},
		},
	],
	autoUpdate: false,
}

const existingOperationIdList = []

function ensureUnique(id) {
	if (!existingOperationIdList.includes(id)) return id
	let count = 1
	while (existingOperationIdList.includes(`${id}${count}`)) count++
	return `${id}${count}`
}

function toCamelCase(str) {
	return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase())
}
