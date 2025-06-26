import { createApp } from 'vue'
import App from './app.vue'
import '@/configs/iconify'
import '@/configs/naive-ui'
import '@/assets/css/font.scss'

const app = createApp(App)
app.mount('#app', true)
