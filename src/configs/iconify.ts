import { type IconifyJSON, addCollection } from '@iconify/vue'
import tabler from '@iconify/json/json/tabler.json'
import mdi from '@iconify/json/json/mdi.json'
import gis from '@iconify/json/json/gis.json'

const custom = {
	prefix: 'custom',
	icons: {},
}

const collection = [custom, tabler, mdi, gis] as IconifyJSON[]

function setupIconify() {
	collection.forEach(item => addCollection(item))
}

setupIconify()
