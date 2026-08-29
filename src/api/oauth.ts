import type { LoginClientHTTPResponse } from "../types/loginstep"
import type {
	RespAuthMetadata,
	RespClientRegistration,
	RespDeviceAuthorization,
	RespLogin,
	RespOAuthToken,
} from "../types/matrix"
import { MatrixClient } from "./matrixclient"

const clientMetadata = {
	client_name: "mautrix-manager",
	client_uri: "https://github.com/mautrix/manager",
	application_type: "native",
	token_endpoint_auth_method: "none",
	grant_types: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
	response_types: [],
}

export interface DeviceLoginInfo {
	userCode: string
	verificationURI: string
}

function oauthError(status: number, body: unknown): Error {
	const err = body as { error?: string, error_description?: string }
	const code = err.error ?? `HTTP ${status}`
	return new Error(err.error_description ? `${code}: ${err.error_description}` : code)
}

function decodeBody(resp: LoginClientHTTPResponse): unknown {
	if ("error" in resp) {
		throw new Error(resp.error)
	}
	if (!resp.body) {
		return {}
	}
	return JSON.parse(new TextDecoder().decode(Uint8Array.fromBase64(resp.body)))
}

async function postForm(url: string, params: Record<string, string>): Promise<[number, unknown]> {
	const resp = await window.mautrixAPI.doClientHTTP(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json",
		},
		body: new URLSearchParams(params).toString(),
	})
	if ("error" in resp) {
		throw new Error(resp.error)
	}
	return [resp.status_code, decodeBody(resp)]
}

async function postJSON(url: string, data: unknown): Promise<[number, unknown]> {
	const resp = await window.mautrixAPI.doClientHTTP(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
		},
		body: JSON.stringify(data),
	})
	if ("error" in resp) {
		throw new Error(resp.error)
	}
	return [resp.status_code, decodeBody(resp)]
}

function randomDeviceID(): string {
	const bytes = new Uint8Array(8)
	crypto.getRandomValues(bytes)
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	return Array.from(bytes, b => alphabet[b % alphabet.length]).join("")
}

function clientStorageKey(issuer: string): string {
	return `oauth_client_id_${issuer}`
}

async function getClientID(metadata: RespAuthMetadata): Promise<string> {
	const cached = localStorage[clientStorageKey(metadata.issuer)]
	if (cached) {
		return cached
	}
	if (!metadata.registration_endpoint) {
		throw new Error("Homeserver's auth server doesn't support dynamic client registration")
	}
	const [status, body] = await postJSON(metadata.registration_endpoint, clientMetadata)
	if (status >= 400) {
		throw oauthError(status, body)
	}
	const clientID = (body as RespClientRegistration).client_id
	if (!clientID) {
		throw new Error("Client registration response didn't include a client_id")
	}
	localStorage[clientStorageKey(metadata.issuer)] = clientID
	return clientID
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function pollForToken(
	metadata: RespAuthMetadata,
	clientID: string,
	deviceCode: string,
	intervalSeconds: number,
	expiresInSeconds: number,
): Promise<RespOAuthToken> {
	const deadline = Date.now() + expiresInSeconds * 1000
	let interval = Math.max(intervalSeconds, 1)
	while (Date.now() < deadline) {
		await sleep(interval * 1000)
		const [status, body] = await postForm(metadata.token_endpoint, {
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			device_code: deviceCode,
			client_id: clientID,
		})
		if (status < 400) {
			return body as RespOAuthToken
		}
		const err = body as { error?: string, error_description?: string }
		if (err.error === "authorization_pending") {
			continue
		} else if (err.error === "slow_down") {
			interval += 5
			continue
		}
		throw oauthError(status, body)
	}
	throw new Error("Timed out waiting for the login to be approved")
}

export async function loginWithDeviceCode(
	matrixClient: MatrixClient,
	onDeviceLogin: (info: DeviceLoginInfo) => void,
): Promise<RespLogin> {
	const metadata = await matrixClient.getAuthMetadata()
	if (!metadata.device_authorization_endpoint) {
		throw new Error("Homeserver's auth server doesn't support the device authorization grant")
	}
	const clientID = await getClientID(metadata)
	const deviceID = randomDeviceID()
	const scope = `urn:matrix:client:api:* urn:matrix:client:device:${deviceID}`

	const [status, body] = await postForm(metadata.device_authorization_endpoint, {
		client_id: clientID,
		scope,
	})
	if (status >= 400) {
		throw oauthError(status, body)
	}
	const deviceAuth = body as RespDeviceAuthorization
	const verificationURI = deviceAuth.verification_uri_complete ?? deviceAuth.verification_uri
	onDeviceLogin({ userCode: deviceAuth.user_code, verificationURI: deviceAuth.verification_uri })
	window.mautrixAPI.openInBrowser(verificationURI).catch(() => undefined)

	const token = await pollForToken(
		metadata,
		clientID,
		deviceAuth.device_code,
		deviceAuth.interval ?? 5,
		deviceAuth.expires_in ?? 300,
	)

	const authedClient = new MatrixClient(matrixClient.baseURL, undefined, token.access_token)
	const whoami = await authedClient.whoami()
	return {
		access_token: token.access_token,
		device_id: whoami.device_id ?? deviceID,
		user_id: whoami.user_id,
		refresh_token: token.refresh_token,
		expires_in_ms: token.expires_in ? token.expires_in * 1000 : undefined,
	}
}
