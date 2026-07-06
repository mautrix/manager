import type { CableUiEvent } from "@beeper/webauthn-authenticator"
import { QRCodeSVG } from "qrcode.react"
import React, { useCallback, useEffect, useState } from "react"
import GridLoader from "react-spinners/GridLoader"
import type { LoginClient } from "../api/loginclient"
import type {
	LoginDisplayAndWaitParams,
	LoginInputDataField,
	LoginInputFieldType,
	LoginStepData,
} from "../types/loginstep"
import "./BridgeLoginView.css"

interface LoginViewProps {
	client: LoginClient
	onLoginCancel: () => void
	onLoginComplete: () => void
}

interface LoginStepProps {
	step: LoginStepData
	onSubmit: (data: Record<string, string>) => void
	onCancel: () => void
	onLoginComplete: () => void
	cableState: string | null
	cableQR: string | null
}

function loginInputFieldTypeToHTMLType(type: LoginInputFieldType): string {
	switch (type) {
	case "email":
		return "email"
	case "phone_number":
		return "tel"
	case "password":
		return "password"
	case "username":
	case "2fa_code":
		return "text"
	}
}

const LoginStepField = ({ field }: { field: LoginInputDataField }) => {
	return <div className="login-form-field" title={field.description}>
		<label htmlFor={`login-form-${field.id}`}>{field.name}</label>
		<input
			id={`login-form-${field.id}`}
			name={field.id}
			type={loginInputFieldTypeToHTMLType(field.type)}
			placeholder={field.name}
		/>
	</div>
}

const DisplayAndWaitStep = ({ params }: { params: LoginDisplayAndWaitParams }) => {
	switch (params.type) {
	case "emoji":
		if (params.image_url) {
			return <img
				height={256}
				src={params.image_url}
				alt={params.data}
			/>
		} else {
			return <h1>{params.data}</h1>
		}
	case "code":
		return <h1>{params.data}</h1>
	case "qr":
		return <QRCodeSVG size={256} value={params.data}/>
	case "nothing":
		return <div>
			<GridLoader color="var(--primary-color)"/>
		</div>
	default:
		return <div>
			Unknown display type {(params as { type: string }).type}
		</div>
	}
}

const LoginStep = ({ step, onSubmit, onLoginComplete, onCancel, cableState, cableQR }: LoginStepProps) => {
	const submitForm = useCallback((evt: React.SubmitEvent) => {
		evt.preventDefault()
		const form = evt.currentTarget as HTMLFormElement
		const data = Array.from(form.elements).reduce((acc, elem) => {
			if (elem instanceof HTMLInputElement) {
				acc[elem.name] = elem.value
			}
			return acc
		}, {} as Record<string, string>)
		onSubmit(data)
	}, [onSubmit])
	switch (step.type) {
	case "cookies":
		return <div className="login-form type-cookies">
			<button className="cancel-button" onClick={onCancel}>Cancel</button>
		</div>
	case "display_and_wait":
		return <div className="login-form type-display-and-wait">
			<DisplayAndWaitStep params={step.display_and_wait}/>
			<div className="login-form-buttons">
				<button className="cancel-button" onClick={onCancel}>Cancel</button>
			</div>
		</div>
	case "user_input":
		return <form onSubmit={submitForm} className="login-form type-user-input">
			<div className="login-form-table">
				{step.user_input.fields.map(field =>
					<LoginStepField key={field.id} field={field}/>)}
			</div>
			<div className="login-form-buttons">
				<button className="cancel-button" onClick={onCancel}>Cancel</button>
				<button className="submit-button" type="submit">Submit</button>
			</div>
		</form>
	case "webauthn":
		return <div className="login-form type-webauthn">
			Processing WebAuthn login{cableState ? <>: <code>{cableState}</code></> : "..."}
			<div>
				{cableQR ? <QRCodeSVG size={256} value={cableQR}/> : null}
			</div>
			<div className="login-form-buttons">
				<button className="cancel-button" onClick={onCancel}>Cancel</button>
			</div>
		</div>
	case "complete":
		return <div className="login-form type-complete">
			<button className="close-button" onClick={onLoginComplete}>Close</button>
		</div>
	}
}

const BridgeLoginView = ({ client, onLoginCancel, onLoginComplete }: LoginViewProps) => {
	const [error, setError] = useState("")
	const [, setLoading] = useState(client.loading)
	const [step, setStep] = useState(client.step)
	const [cableState, setCableState] = useState<string | null>(null)
	const [cableQR, setCableQR] = useState<string | null>(null)
	useEffect(() => {
		const onError = (err: Error) => setError(err.message)
		client.listen(setStep, setLoading, onError)
		const cableUIListener = (evt: CustomEventInit<CableUiEvent | null>) => {
			console.log("Received caBLE UI event", evt.detail)
			if (!evt.detail) {
				setCableState(null)
				setCableQR(null)
			} else if (evt.detail.event === "cableQrCode") {
				setCableQR(evt.detail.url)
			} else if (evt.detail.event === "dismissQrCode") {
				setCableQR(null)
			} else if (evt.detail.event === "cableStatusUpdate") {
				setCableState(evt.detail.state)
			} else {
				console.warn("Unknown caBLE UI event", evt.detail.event)
			}
		}
		window.addEventListener("mautrix:webauthn:cable-ui", cableUIListener)
		return () => {
			client.stopListen(setStep, setLoading, onError)
			window.removeEventListener("mautrix:webauthn:cable-ui", cableUIListener)
		}
	}, [client])
	const cancelLogin = useCallback(() => {
		client.cancel()
		onLoginCancel()
	}, [client, onLoginCancel])

	let instructionsToRender = step.instructions
	if (step.type === "cookies") {
		instructionsToRender = "Please complete the login in the webview"
	}

	return <div className="bridge-login-view">
		<div className="login-instructions">
			{error ? `Login failed :( ${error}` : instructionsToRender}
		</div>
		<LoginStep
			step={step}
			onSubmit={client.submitUserInput}
			onLoginComplete={onLoginComplete}
			onCancel={cancelLogin}
			cableState={cableState}
			cableQR={cableQR}
		/>
	</div>
}

export default BridgeLoginView
