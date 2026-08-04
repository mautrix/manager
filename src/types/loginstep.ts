export type LoginCookieOutput = {
	[id: string]: string
}

export type LoginStepData =
	LoginStepUserInput |
	LoginStepDisplayAndWait |
	LoginStepCookies |
	LoginStepWebAuthn |
	LoginStepClientHTTP |
	LoginStepComplete

interface baseLoginStep {
	step_id: string
	txn_id?: string
	instructions?: string
}

export type LoginStepUserInput = baseLoginStep & {
	type: "user_input",
	user_input: LoginUserInputParams,
}

export interface LoginUserInputParams {
	fields: LoginInputDataField[]
}

export type LoginInputFieldType =
	"username" | "phone_number" | "email" | "password" | "2fa_code"
	| "token" | "url" | "domain" | "select" | "captcha_code"

export interface LoginInputDataField {
	type: LoginInputFieldType
	id: string
	name: string
	description?: string
	default_value?: string
	pattern?: string
	options?: string[]
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

export type LoginStepWebAuthn = baseLoginStep & {
	type: "webauthn",
	webauthn: LoginWebAuthnParams,
}

export type LoginStepClientHTTP = baseLoginStep & {
	type: "client_http",
	client_http: LoginClientHTTPParams,
}

export interface LoginClientHTTPParams {
	request_id: string
	method: string
	url: string
	headers?: Record<string, string[]>
	body?: string
}

export type LoginClientHTTPResponse = {
	status_code: number
	final_url?: string
	headers?: Record<string, string[]>
	body?: string
} | {
	error: string
}

export interface LoginWebAuthnParams {
	url: string
	publicKey: PublicKeyCredentialRequestOptionsJSON
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
