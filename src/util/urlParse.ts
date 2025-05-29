export function getSearch(url: string | undefined): string | undefined {
	if (url?.startsWith("mautrix-manager://sso?") || url?.startsWith("mautrix-manager://sso/?")) {
		return url.replace("mautrix-manager://sso?", "").replace("mautrix-manager://sso/?", "")
	}
}
