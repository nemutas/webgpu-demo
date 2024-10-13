import { mat4 } from 'wgpu-matrix'

type Triple = [number, number, number]

export abstract class Camera {
  public position: Triple = [0, 0, 5]
  public target: Triple = [0, 0, 0]
  public up: Triple = [0, 1, 0]

  public readonly projectionMatrix
  public readonly viewMatrix
  public readonly buffer: GPUBuffer

  private readonly positionArray = new Float32Array(3)
  private _bindGroupLayout?: GPUBindGroupLayout
  private _bindGroup?: GPUBindGroup

  constructor(protected readonly device: GPUDevice) {
    this.buffer = this.createBuffer()

    this.projectionMatrix = mat4.create()

    this.viewMatrix = mat4.create()
    this.updateViewMatrix()
  }

  abstract updateProjectionMatrix(): void

  private createBuffer() {
    return this.device.createBuffer({
      size: 4 * 16 * 2 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  updateViewMatrix() {
    // update view matrix
    mat4.lookAt(this.position, this.target, this.up, this.viewMatrix)
    this.writeViewMatrixBuffer()

    // update position
    this.positionArray.set(this.position)
    this.writePositionBuffer()
  }

  writeViewMatrixBuffer() {
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.buffer, 
      4 * 16 * 1,
      this.viewMatrix.buffer, 
      this.viewMatrix.byteOffset, 
      this.viewMatrix.byteLength
    )
  }

  writePositionBuffer() {
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.buffer, 
      4 * 16 * 2,
      this.positionArray.buffer, 
      this.positionArray.byteOffset, 
      this.positionArray.byteLength
    )
  }

  get bindGroupLayout() {
    if (!this._bindGroupLayout) {
      this._bindGroupLayout = this.createUniformBindGroupLayout(this.buffer.size)
    }
    return this._bindGroupLayout
  }

  get bindGroup() {
    if (!this._bindGroup) {
      this._bindGroup = this.createBindGroup(this.bindGroupLayout, this.buffer)
    }
    return this._bindGroup
  }

  private createUniformBindGroupLayout(minBindingSize?: number) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', minBindingSize },
        },
      ],
    })
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: { buffer } }],
    })
  }
}
