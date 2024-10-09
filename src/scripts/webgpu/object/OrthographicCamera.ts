import { mat4 } from 'wgpu-matrix'
import { Camera } from './Camera'

type Params = {
  left?: number
  right?: number
  bottom?: number
  top?: number
  near?: number
  far?: number
}

export class OrthographicCamera extends Camera {
  public left = -1
  public right = 1
  public bottom = -1
  public top = 1
  public near = 0.1
  public far = 100

  constructor(device: GPUDevice, params: Params) {
    super(device)

    params.left && (this.left = params.left)
    params.right && (this.right = params.right)
    params.bottom && (this.bottom = params.bottom)
    params.top && (this.top = params.top)
    params.near && (this.near = params.near)
    params.far && (this.far = params.far)

    this.updateProjectionMatrix()
  }

  updateProjectionMatrix() {
    mat4.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far, this.projectionMatrix)
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.gpuBuffer, 
      4 * 16 * 0,
      this.projectionMatrix.buffer, 
      this.projectionMatrix.byteOffset, 
      this.projectionMatrix.byteLength
    )
  }
}
