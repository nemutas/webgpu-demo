import { CanvasBase } from '../webgpu/core/CanvasBase'
import { getGPUContexts, GPU } from '../webgpu/core/gpu'

export class WebGPUCanvas extends HTMLElement {
  static Define(Canvas: new (gpu: GPU) => CanvasBase) {
    customElements.define('webgpu-canvas', this)

    WebGPUCanvas.Run(Canvas)
  }

  static Run(Canvas: new (gpu: GPU) => CanvasBase) {
    const id = setInterval(() => {
      const gpu = document.querySelector<WebGPUCanvas>('webgpu-canvas')?.gpu
      if (gpu) {
        new Canvas(gpu)
        clearInterval(id)
      } else if (gpu === null) {
        clearInterval(id)
        location.href = '/webgpu-demo/pages/error/'
      }
    }, 10)
  }

  gpu?: GPU | null

  connectedCallback() {
    if (!this.isConnected) return

    this.gpu?.device.destroy()
    this.gpu = undefined

    const canvasElement = this.querySelector<HTMLCanvasElement>('canvas')!

    getGPUContexts(canvasElement)
      .then((gpu) => {
        this.gpu = gpu
      })
      .catch((err: Error) => {
        this.gpu = null
        console.error(err.message)
      })
  }

  disconnectedCallback() {
    this.gpu?.device.destroy()
    this.gpu = undefined
  }
}
