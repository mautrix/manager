import type { LoginStepData } from "../types/loginstep"
import type { RespSubmitLogin } from "../types/login"
import type { ProvisioningClient } from "./provisionclient"

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
	}

	private processStep() {
		if (this.#step.type === "cookies") {
			const closeWebview = () => window.mautrixAPI.closeWebview()
			const removeListener = () => this.abortController.signal.removeEventListener("abort", closeWebview)
			this.abortController.signal.addEventListener("abort", closeWebview)
			window.mautrixAPI.openWebview(this.#step.cookies).then(
				res => this.submitCookies(res.cookies),
				this.onError,
			).finally(removeListener)
		} else if (this.#step.type === "display_and_wait") {
			this.wait()
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

	wait = () => {
		return this.submitStep({}, "display_and_wait")
	}

	private submitStep<ParamsType>(
		params: ParamsType,
		expectedType: "user_input" | "cookies" | "display_and_wait",
	) {
		if (this.abortController.signal.aborted) {
			throw new Error("Login was cancelled")
		} else if (this.submitInProgress) {
			throw new Error("Cannot submit multiple steps concurrently")
		} else if (this.#step.type !== expectedType) {
			throw new Error(`Mismatching step type for submit call, called ${expectedType} but current step is ${this.#step.type}`)
		}
		this.onLoading(true)
		this.client.request(
			"POST",
			`/v3/login/step/${this.loginID}/${this.#step.step_id}/${this.#step.type}`,
			params,
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
