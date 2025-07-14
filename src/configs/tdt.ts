export const SUB_DOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7']

export const TOKEN = import.meta.env.VITE_TDT_TOKEN

export const API_SERVICE = 'http://api.tianditu.gov.cn'

export const TER_SERVICE = `https://t{s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}&tk=${TOKEN}`

export const IMG_SERVICE = `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${TOKEN}`

export const IBO_SERVICE = `https://t{s}.tianditu.gov.cn/DataServer?T=ibo_w&x={x}&y={y}&l={z}&tk=${TOKEN}`

export const CIA_SERVICE = `https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${TOKEN}`
