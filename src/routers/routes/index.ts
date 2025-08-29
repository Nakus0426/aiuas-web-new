import { type RouteRecordRaw } from 'vue-router'

export const HomeRoute: RouteRecordRaw = { path: '/aiuas/home', component: () => import('@/views/home/index.vue') }

export const LoginRoute: RouteRecordRaw = { path: '/aiuas/login', component: () => import('@/views/login/index.vue') }

export const AuthCallbackRoute: RouteRecordRaw = {
	path: '/aiuas/auth-callback',
	component: () => import('@/views/login/auth-callback.vue'),
}

export const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: '/aiuas' },
	{ path: '/aiuas', redirect: '/aiuas/home' },
	HomeRoute,
	LoginRoute,
	AuthCallbackRoute,
	{ path: '/aiuas', children: [] },
]
