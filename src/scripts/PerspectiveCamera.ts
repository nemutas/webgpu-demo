import { mat4 } from 'wgpu-matrix'

type Params = {
  fovDeg?: number
  aspect?: number
  near?: number
  far?: number
}

export class PerspectiveCamera {
  public fovDeg = 45
  public aspect = 1
  public near = 0.1
  public far = 100
  public position: [number, number, number] = [0, 0, 5]
  public target: [number, number, number] = [0, 0, 0]
  public up: [number, number, number] = [0, 1, 0]

  public readonly projectionMatrix
  public readonly viewMatrix
  public readonly gpuBuffer: GPUBuffer

  constructor(
    private readonly device: GPUDevice,
    params: Params,
  ) {
    params.fovDeg && (this.fovDeg = params.fovDeg)
    params.aspect && (this.aspect = params.aspect)
    params.near && (this.near = params.near)
    params.far && (this.far = params.far)

    this.gpuBuffer = this.createBuffer()
    this.projectionMatrix = mat4.create()
    this.viewMatrix = mat4.create()

    this.updateProjectionMatrix()
    this.updateViewMatrix()
  }

  private createBuffer() {
    return this.device.createBuffer({
      size: 4 * 16 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  updateProjectionMatrix() {
    mat4.perspective((this.fovDeg * Math.PI) / 180, this.aspect, this.near, this.far, this.projectionMatrix)
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.gpuBuffer, 
      4 * 16 * 0,
      this.projectionMatrix.buffer, 
      this.projectionMatrix.byteOffset, 
      this.projectionMatrix.byteLength
    )
  }

  updateViewMatrix() {
    mat4.lookAt(this.position, this.target, this.up, this.viewMatrix)
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.gpuBuffer, 
      4 * 16 * 1,
      this.viewMatrix.buffer, 
      this.viewMatrix.byteOffset, 
      this.viewMatrix.byteLength
    )
  }
}
