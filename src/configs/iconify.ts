import { type IconifyJSON, addCollection } from '@iconify/vue'
import tabler from '@iconify/json/json/tabler.json'
import materialSymbols from '@iconify/json/json/material-symbols.json'

const custom = {
	prefix: 'custom',
	icons: {},
}

const collection = [custom, tabler, materialSymbols] as IconifyJSON[]

function setupIconify() {
	collection.forEach(item => addCollection(item))
}

setupIconify()
