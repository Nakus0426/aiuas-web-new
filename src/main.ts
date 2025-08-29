import { createApp } from 'vue'
import App from './app.vue'
import '@/configs/iconify'
import '@/configs/naive-ui'
import '@/configs/alova'
import '@/assets/css/index.scss'
import { setupStore } from './stores'
import { setupRouter } from './routers'

const app = createApp(App)

setupStore(app)

setupRouter(app)

app.mount('#app')
