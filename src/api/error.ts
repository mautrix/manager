export class APIError extends Error {
	errcode: string
	error: string
	extra: { [key: string]: unknown }

	constructor(
		{ errcode, error, ...extra }: { errcode: string, error: string, [key: string]: unknown },
	) {
		super(`${errcode}: ${error}`)
		this.errcode = errcode
		this.error = error
		this.extra = extra
	}
}
