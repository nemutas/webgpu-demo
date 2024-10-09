import { mat4 } from 'wgpu-matrix'

type Triple = [number, number, number]

export abstract class Camera {
  public position: Triple = [0, 0, 5]
  public target: Triple = [0, 0, 0]
  public up: Triple = [0, 1, 0]

  public readonly projectionMatrix
  public readonly viewMatrix
  public readonly gpuBuffer: GPUBuffer
  public readonly bindGroupLayout: GPUBindGroupLayout
  public readonly bindGroup: GPUBindGroup

  private readonly positionArray = new Float32Array(3)

  constructor(protected readonly device: GPUDevice) {
    this.gpuBuffer = this.createBuffer()
    this.bindGroupLayout = this.createUniformBindGroupLayout(this.gpuBuffer.size)
    this.bindGroup = this.createBindGroup(this.bindGroupLayout, this.gpuBuffer)

    this.projectionMatrix = mat4.create()

    this.viewMatrix = mat4.create()
    this.updateViewMatrix()
  }

  protected createBuffer() {
    return this.device.createBuffer({
      size: 4 * 16 * 2 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  protected createUniformBindGroupLayout(minBindingSize?: number) {
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

  protected createBindGroup(layout: GPUBindGroupLayout, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: { buffer } }],
    })
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

    // update position
    this.positionArray.set(this.position)
    // prettier-ignore
    this.device.queue.writeBuffer(
      this.gpuBuffer, 
      4 * 16 * 2,
      this.positionArray.buffer, 
      this.positionArray.byteOffset, 
      this.positionArray.byteLength
    )
  }

  abstract updateProjectionMatrix(): void
}
