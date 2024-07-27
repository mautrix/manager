import React, { useCallback, useEffect, useState } from "react"
import type { LoginInputDataField, LoginInputFieldType, LoginStepData } from "../types/loginstep"
import { QRCodeSVG } from "qrcode.react"
import { LoginClient } from "../api/login"

interface LoginViewProps {
	client: LoginClient
	onLoginCancel: () => void
	onLoginComplete: () => void
}

interface LoginStepProps {
	step: LoginStepData
	onSubmit: (data: Record<string, string>) => void
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
	return <div>
		<label htmlFor={`login-form-${field.id}`}>{field.name}</label>
		<input
			id={`login-form-${field.id}`}
			name={field.id}
			type={loginInputFieldTypeToHTMLType(field.type)}
			placeholder={field.name}
			title={field.description}
		/>
	</div>
}

const LoginStep = ({ step, onSubmit, onLoginComplete }: LoginStepProps) => {
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
		return null
	case "display_and_wait":
		switch (step.display_and_wait.type) {
		case "emoji":
			if (step.display_and_wait.image_url) {
				return <img
					height={256}
					src={step.display_and_wait.image_url}
					alt={step.display_and_wait.data}
				/>
			} else {
				return <h1>{step.display_and_wait.data}</h1>
			}
		case "code":
			return <h1>{step.display_and_wait.data}</h1>
		case "qr":
			return <QRCodeSVG value={step.display_and_wait.data}/>
		case "nothing":
			return <div>Waiting...</div>
		default:
			return <div>
				Unknown display type {(step.display_and_wait as { type: string }).type}
			</div>
		}
	case "user_input":
		return <form onSubmit={submitForm}>
			{step.user_input.fields.map(field => <LoginStepField key={field.id} field={field}/>)}
			<button type="submit">Submit</button>
		</form>
	case "complete":
		return <div>
			Logged in
			<button onClick={onLoginComplete}>Close</button>
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

	return <div>
		{loading ? "Loading..." : ""}
		<p>
			{error ? `Login failed :( ${error}` : instructionsToRender}
		</p>
		<LoginStep step={step} onSubmit={client.submitUserInput} onLoginComplete={onLoginComplete}/>
		<button onClick={cancelLogin}>Cancel</button>
	</div>
}

export default BridgeLoginView
