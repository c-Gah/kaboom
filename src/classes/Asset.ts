import { Event } from "../utils"

export class Asset<D> {
	done: boolean = false
	data: D | null = null
	error: Error | null = null
	private onLoadEvents: Event<[D]> = new Event()
	private onErrorEvents: Event<[Error]> = new Event()
	private onFinishEvents: Event<[]> = new Event()
	constructor(loader: Promise<D>) {
		loader.then((data) => {
			this.data = data
			this.onLoadEvents.trigger(data)
		}).catch((err) => {
			this.error = err
			if (this.onErrorEvents.numListeners() > 0) {
				this.onErrorEvents.trigger(err)
			} else {
				throw err
			}
		}).finally(() => {
			this.onFinishEvents.trigger()
			this.done = true
		})
	}
	static loaded<D>(data: D): Asset<D> {
		const asset = new Asset(Promise.resolve(data))
		asset.data = data
		asset.done = true
		return asset
	}
	onLoad(action: (data: D) => void) {
		this.onLoadEvents.add(action)
		return this
	}
	onError(action: (err: Error) => void) {
		this.onErrorEvents.add(action)
		return this
	}
	onFinish(action: () => void) {
		this.onFinishEvents.add(action)
		return this
	}
	then(action: (data: D) => void): Asset<D> {
		return this.onLoad(action)
	}
	catch(action: (err: Error) => void): Asset<D> {
		return this.onError(action)
	}
	finally(action: () => void): Asset<D> {
		return this.onFinish(action)
	}
}