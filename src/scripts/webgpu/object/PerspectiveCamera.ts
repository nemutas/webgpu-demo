import { mat4 } from 'wgpu-matrix'
import { Camera } from './Camera'

type Params = {
  fovDeg?: number
  aspect?: number
  near?: number
  far?: number
}

export class PerspectiveCamera extends Camera {
  public fovDeg = 45
  public aspect = 1
  public near = 0.1
  public far = 100

  constructor(device: GPUDevice, params?: Params) {
    super(device)

    params?.fovDeg && (this.fovDeg = params.fovDeg)
    params?.aspect && (this.aspect = params.aspect)
    params?.near && (this.near = params.near)
    params?.far && (this.far = params.far)

    this.updateProjectionMatrix()
  }

  updateProjectionMatrix() {
    mat4.perspective((this.fovDeg * Math.PI) / 180, this.aspect, this.near, this.far, this.projectionMatrix)
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.buffer, 
      4 * 16 * 0,
      this.projectionMatrix.buffer, 
      this.projectionMatrix.byteOffset, 
      this.projectionMatrix.byteLength
    )
  }

  updateAspect(aspect: number) {
    this.aspect = aspect
    this.updateProjectionMatrix()
  }
}
