import { type App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from './routes'
import { useUserStore } from '@/stores/modules/user'

const router = createRouter({
	history: createWebHashHistory(),
	routes,
})

router.beforeEach((to, from) => {
	const {} = useUserStore()
})

export function setupRouter(app: App) {
	app.use(router)
}
