import { Clock } from './Clock'
import { GPU } from './gpu'

export abstract class CanvasBase {
  protected readonly device: GPUDevice
  protected readonly clock: Clock

  constructor(protected readonly gpu: GPU) {
    this.device = gpu.device
    this.clock = new Clock()
    this.setup(gpu)

    window.addEventListener('resize', this._resize.bind(this))
  }

  private setup(gpu: GPU) {
    gpu.context.configure({
      device: gpu.device,
      format: gpu.presentationFormat,
      alphaMode: 'premultiplied',
    })
  }

  private _resize() {
    const canvas = this.gpu.context.canvas
    const width = window.innerWidth * window.devicePixelRatio
    const height = window.innerHeight * window.devicePixelRatio
    canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D))
    canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D))
  }

  protected get contextView() {
    return this.gpu.context.getCurrentTexture().createView()
  }

  protected get resolution() {
    const { width, height } = this.gpu.context.canvas
    return { width, height, aspect: width / height }
  }
}
