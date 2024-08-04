import React, { useCallback, useEffect, useState } from "react"
import type {
	LoginDisplayAndWaitParams,
	LoginInputDataField,
	LoginInputFieldType,
	LoginStepData,
} from "../types/loginstep"
import type { LoginClient } from "../api/loginclient"
import { QRCodeSVG } from "qrcode.react"
import GridLoader from "react-spinners/GridLoader"
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
		return <QRCodeSVG value={params.data}/>
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

const LoginStep = ({ step, onSubmit, onLoginComplete, onCancel }: LoginStepProps) => {
	const submitForm = useCallback((evt: React.FormEvent) => {
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
			<button className="cancel-button" onClick={onCancel}>Cancel</button>
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
	case "complete":
		return <div className="login-form type-complete">
			<button className="close-button" onClick={onLoginComplete}>Close</button>
		</div>
	}
}

const BridgeLoginView = ({ client, onLoginCancel, onLoginComplete }: LoginViewProps) => {
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(client.loading)
	const [step, setStep] = useState(client.step)
	useEffect(() => {
		const onError = (err: Error) => setError(err.message)
		client.listen(setStep, setLoading, onError)
		return () => client.stopListen(setStep, setLoading, onError)
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
		/>
	</div>
}

export default BridgeLoginView
