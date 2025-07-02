import { createApp } from 'vue'
import App from './app.vue'
import '@/configs/iconify'
import '@/configs/naive-ui'
import '@/configs/alova'
import '@/assets/css/font.scss'
import { setupStore } from './stores'

const app = createApp(App)

setupStore(app)

app.mount('#app', true)
