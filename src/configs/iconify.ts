import gis from '@iconify/json/json/gis.json'
import mdi from '@iconify/json/json/mdi.json'
import tabler from '@iconify/json/json/tabler.json'
import { addCollection, type IconifyJSON } from '@iconify/vue'

const custom = {
	prefix: 'custom',
	icons: {},
}

const collection = [custom, tabler, mdi, gis] as IconifyJSON[]

function setupIconify() {
	collection.forEach(item => addCollection(item))
}

setupIconify()
