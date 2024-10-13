import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import { Main } from './Main'
import { Postprocessing } from './Postprocessing'
import { pane } from '@scripts/Gui'

export class Canvas extends CanvasBase {
  private main!: Main
  private postprocessing!: Postprocessing

  constructor(gpu: GPU) {
    super(gpu)

    Main.create(gpu).then((main) => {
      this.main = main
      this.postprocessing = new Postprocessing(gpu, this.main.renderTarget)

      this.render()
      window.addEventListener('resize', this.resize.bind(this))
    })
  }

  render() {
    pane.updateFps()

    const { et, dt } = this.clock.update()

    const encoder = this.device.createCommandEncoder()

    this.main.render(encoder, dt)
    this.postprocessing.render(encoder, et)

    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(this.render.bind(this))
  }

  resize() {
    this.main.resize()
    this.postprocessing.resize(this.main.renderTarget)
  }
}
