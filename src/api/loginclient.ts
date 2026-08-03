import type { RespSubmitLogin } from "../types/login"
import type { LoginClientHTTPResponse, LoginStepData } from "../types/loginstep"
import type { ProvisioningClient } from "./provisionclient"

const baseChromeUserAgent = window.navigator.userAgent
	.replace(/ mautrix-manager\/\S+/, "")
	.replace(/ Electron\/\S+/, "")

export class LoginClient {
	public readonly loginID: string
	#step: LoginStepData
	#error: Error | null = null
	private submitInProgress = false

	private abortController: AbortController

	private stepListener: ((ev: LoginStepData) => void) | null = null
	private loadingListener: ((loading: boolean) => void) | null = null
	private errorListener: ((ev: Error) => void) | null = null

	constructor(
		public readonly client: ProvisioningClient,
		step: RespSubmitLogin,
		private readonly onCompleteRefresh: () => void,
	) {
		this.abortController = new AbortController()
		this.#step = step
		this.loginID = step.login_id
		this.processStep()
	}

	get step() {
		return this.#step
	}

	get error() {
		return this.#error
	}

	get loading() {
		return this.submitInProgress
	}

	listen(
		onStep: (ev: LoginStepData) => void,
		onLoading: (loading: boolean) => void,
		onError: (ev: Error) => void,
	) {
		this.stepListener = onStep
		this.loadingListener = onLoading
		this.errorListener = onError
		if (this.#error) {
			onError(this.#error)
		} else {
			onLoading(this.submitInProgress)
			onStep(this.#step)
		}
	}

	stopListen(
		onStep: (ev: LoginStepData) => void,
		onLoading: (loading: boolean) => void,
		onError: (ev: Error) => void,
	) {
		if (this.stepListener === onStep) {
			this.stepListener = null
		}
		if (this.loadingListener === onLoading) {
			this.loadingListener = null
		}
		if (this.errorListener === onError) {
			this.errorListener = null
		}
	}

	cancel = () => {
		this.abortController.abort()
		this.onError(new Error("Login was cancelled"))
		this.client.request(
			"POST",
			`/v3/login/cancel/${this.loginID}`,
			{},
		)
	}

	private processStep() {
		if (this.#step.type === "cookies") {
			const closeWebview = () => window.mautrixAPI.closeWebview()
			const removeListener = () => this.abortController.signal.removeEventListener("abort", closeWebview)
			this.abortController.signal.addEventListener("abort", closeWebview)
			if (!this.#step.cookies.user_agent && !this.#step.cookies.url.includes(".google.com/")) {
				this.#step.cookies.user_agent = baseChromeUserAgent
			}
			window.mautrixAPI.openWebview(this.#step.cookies).then(
				res => this.submitCookies(res.cookies),
				this.onError,
			).finally(removeListener)
		} else if (this.#step.type === "webauthn") {
			console.log("Starting WebAuthn login step", this.#step.webauthn)
			window.mautrixAPI.doWebAuthn(this.#step.webauthn)
				.then(this.submitWebAuthn, this.onError)
				.finally(() => {
					console.log("WebAuthn login step finished")
					window.dispatchEvent(new CustomEvent("mautrix:webauthn:cable-ui", { detail: null }))
				})
		} else if (this.#step.type === "display_and_wait") {
			this.wait()
		} else if (this.#step.type === "client_http") {
			const headers = Object.fromEntries(Object.entries(this.#step.client_http.headers ?? {})
				.map(([key, values]) => [key, values[0]]))
			const body = this.#step.client_http.body ? Uint8Array.fromBase64(this.#step.client_http.body) : undefined
			window.mautrixAPI.doClientHTTP(this.#step.client_http.url, {
				method: this.#step.client_http.method,
				headers,
				body,
			}).then(
				resp => this.submitClientHTTP(resp),
				err => this.submitClientHTTP({ error: err.toString() }),
			)
		} else if (this.#step.type === "complete") {
			setTimeout(this.onCompleteRefresh, 200)
		}
	}

	submitUserInput = (params: Record<string, string>) => {
		return this.submitStep(params, "user_input")
	}

	submitCookies = (params: Record<string, string>) => {
		return this.submitStep(params, "cookies")
	}

	submitWebAuthn = (params: AuthenticationResponseJSON) => {
		return this.submitStep(params, "webauthn")
	}

	wait = () => {
		return this.submitStep({}, "display_and_wait")
	}

	private submitStep<ParamsType>(
		params: ParamsType,
		expectedType: "user_input" | "cookies" | "display_and_wait" | "webauthn",
	) {
		if (this.abortController.signal.aborted) {
			throw new Error("Login was cancelled")
		} else if (this.submitInProgress) {
			throw new Error("Cannot submit multiple steps concurrently")
		} else if (this.#step.type !== expectedType) {
			//eslint-disable-next-line max-len
			throw new Error(`Mismatching step type for submit call, called ${expectedType}, but current step is ${this.#step.type}`)
		}
		console.log("Submitting", this.#step.step_id, this.#step.type)
		this.onLoading(true)
		this.client.request(
			"POST",
			`/v3/login/step/${this.loginID}/${this.#step.step_id}/${this.#step.type}`,
			params,
			{ signal: this.abortController.signal, query: { txn_id: this.#step.txn_id } },
		).then(this.onStep, this.onError)
	}

	private submitClientHTTP(resp: LoginClientHTTPResponse) {
		if (this.abortController.signal.aborted) {
			throw new Error("Login was cancelled")
		} else if (this.submitInProgress) {
			throw new Error("Cannot submit multiple steps concurrently")
		} else if (this.#step.type !== "client_http") {
			throw new Error("Mismatching step type for submitClientHTTP call")
		}
		console.log("Submitting client HTTP step", this.#step.step_id)
		this.onLoading(true)
		this.client.request(
			"POST",
			`/v3/login/client_http/${this.loginID}/${this.#step.txn_id}/${this.#step.client_http.request_id}`,
			resp,
			{ signal: this.abortController.signal },
		).then(this.onStep, this.onError)
	}

	private onLoading = (loading: boolean) => {
		this.submitInProgress = loading
		this.loadingListener?.(loading)
	}

	private onStep = (step: RespSubmitLogin | unknown) => {
		this.onLoading(false)
		if (this.#error) {
			console.warn("Ignoring login step after an error", step)
			return
		}
		this.#step = step as RespSubmitLogin
		this.stepListener?.(this.#step)
		this.processStep()
	}

	private onError = (err: Error | unknown) => {
		console.error("Error in login", err)
		this.onLoading(false)
		if (this.#error) {
			console.warn("Ignoring login error after previous error", err)
			return
		}
		if (err instanceof Error) {
			this.#error = err
		} else {
			this.#error = new Error(`${err}`)
		}
		this.errorListener?.(this.#error)
	}
}
