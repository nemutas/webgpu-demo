import { Clock } from '../object/Clock'
import { calcCanvasResolution, GPU } from './gpu'

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
    calcCanvasResolution(this.device, this.gpu.context.canvas as HTMLCanvasElement)
  }

  protected get contextView() {
    return this.gpu.context.getCurrentTexture().createView()
  }

  protected get resolution() {
    const { width, height } = this.gpu.context.canvas
    return { width, height, aspect: width / height }
  }
}
