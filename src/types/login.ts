import type { LoginStepData } from "./loginstep"

export interface RespLoginFlows {
	flows: LoginFlow[]
}

export interface LoginFlow {
	name: string
	description: string
	id: string
}

export type RespSubmitLogin = LoginStepData & {
	login_id: string
}

export type RespLogout = Record<string, never>
