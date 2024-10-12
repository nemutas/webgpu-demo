import { mat4, Mat4 } from 'wgpu-matrix'
import shaderCode from './compute.wgsl'
import * as WGU from 'webgpu-utils'
import { createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'

export class Compute {
  private readonly blockSize = 10 // per deimension
  public readonly numInstances: number
  private readonly numInstancesPerDimension: number

  public readonly buffer: GPUBuffer
  private readonly bindGroup: GPUBindGroup
  private readonly pipeline: GPUComputePipeline

  private readonly uniformData: { values: WGU.StructuredView; buffer: GPUBuffer }

  constructor(
    private readonly device: GPUDevice,
    requestNumInstances: number,
  ) {
    this.numInstancesPerDimension = Math.floor(Math.sqrt(requestNumInstances) / this.blockSize) * this.blockSize
    this.numInstances = Math.pow(this.numInstancesPerDimension, 2)

    const shader = shaderCode.replaceAll('NUM_INSTANCES', this.numInstances.toFixed(0))

    const defs = WGU.makeShaderDataDefinitions(shader)

    const values = WGU.makeStructuredView(defs.storages.instancedMatrix)
    this.buffer = this.createMatrixBuffer(values)

    const uniformValues = WGU.makeStructuredView(defs.uniforms.u)
    const uniformBuffer = this.createUniformBuffer(uniformValues)
    this.uniformData = { values: uniformValues, buffer: uniformBuffer }

    const layout = this.createBindGroupLayout([this.buffer.size, uniformBuffer.size])
    this.bindGroup = this.createBindGroup(layout, [this.buffer, uniformBuffer])

    this.pipeline = this.createPipeline([layout], shader)
  }

  private createMatrixBuffer(values: WGU.StructuredView) {
    const instancedMatrix = new Array<Mat4>(this.numInstances)
    const r = () => Math.random() * 2 - 1
    const scale = 0.05

    for (let i = 0; i < this.numInstances; i++) {
      const mat = mat4.identity()
      mat4.translate(mat, [r() * 4, r() * 4, r() * 4], mat)
      mat4.rotate(mat, [r(), r(), r()], r() * Math.PI, mat)
      mat4.scale(mat, [scale, scale, scale], mat)

      instancedMatrix[i] = mat
    }
    values.set(instancedMatrix)

    const buffer = this.device.createBuffer({
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      size: values.arrayBuffer.byteLength,
    })
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)

    return buffer
  }

  private createUniformBuffer(values: WGU.StructuredView) {
    values.set({
      size: [this.numInstancesPerDimension, this.numInstancesPerDimension],
    })

    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }

  private createBindGroupLayout(minBindingSizes: number[]) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage', minBindingSize: minBindingSizes[0] },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform', minBindingSize: minBindingSizes[1] },
        },
      ],
    })
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffers: GPUBuffer[]) {
    return this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: buffers[0] } },
        { binding: 1, resource: { buffer: buffers[1] } },
      ],
    })
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[], shader: string) {
    return this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      compute: {
        module: this.device.createShaderModule({ code: shader }),
        constants: { blockSize: this.blockSize },
      },
    })
  }

  private update(dt: number) {
    this.uniformData.values.set({ time: dt })
    this.device.queue.writeBuffer(this.uniformData.buffer, 0, this.uniformData.values.arrayBuffer)
  }

  render(encoder: GPUCommandEncoder, dt: number) {
    this.update(dt)

    const pass = encoder.beginComputePass()
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.dispatchWorkgroups(this.numInstancesPerDimension / this.blockSize, this.numInstancesPerDimension / this.blockSize)
    pass.end()
  }
}
