import type { MatrixClient } from "../api/matrix"
import type { RespMautrixWellKnown } from "../types/matrix"
import type { RespWhoami } from "../types/whoami"
import { ProvisioningClient } from "../api/client"
import TypedLocalStorage from "./localstorage"

export class BridgeMeta {
	constructor(
		public server: string,
		public refreshing: boolean,
		public client: ProvisioningClient,
		public updateState: (bridge: BridgeMeta) => void,
		public whoami?: RespWhoami,
		public error?: Error,
	) {
	}

	clone = ({ whoami, error, refreshing }: {
		whoami?: RespWhoami | null,
		error?: Error | null,
		refreshing?: boolean,
	}): BridgeMeta => {
		return new BridgeMeta(
			this.server,
			refreshing ?? this.refreshing,
			this.client,
			this.updateState,
			whoami !== undefined ? (whoami ?? undefined) : this.whoami,
			error !== undefined ? (error ?? undefined) : this.error,
		)
	}

	refresh = () => {
		if (!this.refreshing) {
			this.updateState(this.clone({ refreshing: true }))
		}
		this.refreshAndClone().then(this.updateState)
	}

	private async refreshAndClone(): Promise<BridgeMeta> {
		try {
			const whoami = await this.client.whoami()
			return this.clone({ whoami, refreshing: false })
		} catch (err) {
			let error: Error
			if (!(err instanceof Error)) {
				error = new Error(`${err}`)
			} else {
				error = err
			}
			return this.clone({ error, refreshing: false })
		}
	}
}

export type BridgeMap = Record<string, BridgeMeta>
export type BridgeListChangeListener = (bridges: BridgeMap) => void

export class BridgeList {
	bridges: BridgeMap
	changeListener: BridgeListChangeListener | undefined
	private initialLoadDone = false

	constructor(private matrixClient: MatrixClient) {
		this.bridges = {}
		for (const [server, { external, whoami }] of Object.entries(TypedLocalStorage.bridges)) {
			this.add(server, whoami, external)
		}
	}

	private add(server: string, whoami?: RespWhoami | null, external = false, refresh = true) {
		if (this.bridges[server]) {
			return false
		}
		const provisioningClient = new ProvisioningClient(
			server, this.matrixClient, external,
		)
		this.bridges[server] = new BridgeMeta(
			server,
			refresh,
			provisioningClient,
			updatedBridge => {
				this.bridges[server] = updatedBridge
				this.onChange()
			},
			whoami ?? undefined,
		)
		if (refresh) {
			this.bridges[server].refresh()
		} else {
			this.onChange()
		}
		return true
	}

	addMany = (servers: string[], external = false) => {
		const changed = servers
			.map(server => this.add(server, undefined, external))
			.some(x => x)
		if (changed) {
			this.onChange()
		}
	}

	checkAndAdd = async (server: string, external = false) => {
		const provisioningClient = new ProvisioningClient(
			server, this.matrixClient, external,
		)
		const whoami = await provisioningClient.whoami()
		this.add(server, whoami, external, false)
	}

	delete = (...servers: string[]) => {
		let changed = false
		for (const server of servers) {
			if (this.bridges[server]) {
				changed = true
				delete this.bridges[server]
			}
		}
		if (changed) {
			this.onChange()
		}
	}

	initialLoad = () => {
		if (this.initialLoadDone) {
			return
		}
		this.initialLoadDone = true
		this.refreshWellKnown()
	}

	private refreshWellKnown(server?: string) {
		let isExternal = true
		if (server === undefined) {
			const match = /@.*:(.*)/.exec(this.matrixClient.userID!)
			if (!match) {
				return
			}
			server = match[1]
			isExternal = false
		}
		console.info(`Fetching bridge list from .well-known of ${server}`)
		fetch(`https://${server}/.well-known/matrix/mautrix`)
			.then(resp => resp.json())
			.then((resp: RespMautrixWellKnown) => {
				const bridges = resp?.["fi.mau.bridges"]
					?.filter?.(br => typeof br === "string")
				if (bridges) {
					this.addMany(bridges, isExternal)
				}
				const externalServers = resp?.["fi.mau.external_bridge_servers"]
					?.filter?.(br => typeof br === "string")
				if (!isExternal && externalServers) {
					for (const extServer of externalServers) {
						this.refreshWellKnown(extServer)
					}
				}
			})
			.catch(err => {
				console.error(`Failed to fetch bridge list from .well-known of ${server}:`, err)
			})
	}

	listen = (listener: BridgeListChangeListener) => {
		this.changeListener = listener
		listener({ ...this.bridges })
	}

	stopListen = (listener: BridgeListChangeListener) => {
		if (this.changeListener === listener) {
			this.changeListener = undefined
		}
	}

	private onChange() {
		TypedLocalStorage.bridges = Object.fromEntries(
			Object.entries(this.bridges).map(([server, bridge]) =>
				[server, { whoami: bridge.whoami, external: bridge.client.external }]),
		)
		this.changeListener?.({ ...this.bridges })
	}
}
