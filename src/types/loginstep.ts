export type LoginCookieOutput = {
	[id: string]: string
}

export type LoginStepData =
	LoginStepUserInput |
	LoginStepDisplayAndWait |
	LoginStepCookies |
	LoginStepComplete

interface baseLoginStep {
	step_id: string
	instructions?: string
}

export type LoginStepUserInput = baseLoginStep & {
	type: "user_input",
	user_input: LoginUserInputParams,
}

export interface LoginUserInputParams {
	fields: LoginInputDataField[]
}

export type LoginInputFieldType = "username" | "phone_number" | "email" | "password" | "2fa_code"

export interface LoginInputDataField {
	type: LoginInputFieldType
	id: string
	name: string
	description?: string
	pattern?: string
}

export type LoginStepDisplayAndWait = baseLoginStep & {
	type: "display_and_wait",
	display_and_wait: LoginDisplayAndWaitParams,
}

export type LoginDisplayAndWaitParams =
	LoginDisplayAndWaitNothingParams |
	LoginDisplayAndWaitEmojiParams |
	LoginDisplayAndWaitQROrCodeParams

export interface LoginDisplayAndWaitNothingParams {
	type: "nothing"
}

export interface LoginDisplayAndWaitEmojiParams {
	type: "emoji"
	data: string
	image_url?: string
}

export interface LoginDisplayAndWaitQROrCodeParams {
	type: "qr" | "code"
	data: string
}

export type LoginStepCookies = baseLoginStep & {
	type: "cookies",
	cookies: LoginCookiesParams,
}

export interface LoginCookiesParams {
	url: string
	user_agent?: string
	fields: LoginCookieField[]
	extract_js?: string
}

export interface LoginCookieField {
	id: string
	required: boolean
	sources: LoginCookieFieldSource[]
	pattern?: string
}

export type LoginCookieFieldSource =
	LoginCookieFieldSourceCookie |
	LoginCookieFieldSourceRequest |
	LoginCookieFieldSourceLocalStorage |
	LoginCookieFieldSourceSpecial

export interface LoginCookieFieldSourceCookie {
	type: "cookie"
	name: string
	cookie_domain: string
}

export interface LoginCookieFieldSourceRequest {
	type: "request_header" | "request_body"
	name: string
	request_url_regex: string
}

export interface LoginCookieFieldSourceLocalStorage {
	type: "local_storage"
	name: string
}

export interface LoginCookieFieldSourceSpecial {
	type: "special"
	name: string
}

export type LoginStepComplete = baseLoginStep & {
	type: "complete",
	complete: LoginCompleteParams,
}

export interface LoginCompleteParams {
	user_login_id: string
}
