// https://webgpu.github.io/webgpu-samples/?sample=shadowMapping

import { loadDoracoModel } from '@scripts/webgpu/common/loader'
import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'
import * as THREE from 'three'
import type { BuffersAndAttributes, StructuredView } from 'webgpu-utils'
import * as WGU from 'webgpu-utils'
import modelShader from './model.wgsl'
import shadowShader from './shadow.wgsl'
import { createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { mat4 } from 'wgpu-matrix'
import { OrthographicCamera } from '@scripts/webgpu/object/OrthographicCamera'

export class Canvas extends CanvasBase {
  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly light: OrthographicCamera
  private readonly lightRadius: number

  constructor(gpu: GPU) {
    super(gpu)

    this.scene = new RenderScene(gpu)
    this.camera = this.createCamera()
    this.light = this.createLightCamera()
    this.lightRadius = Math.sqrt(this.light.position[0] * this.light.position[0] + this.light.position[2] * this.light.position[2])

    this.loadMedelVertexData().then((modelVertexData) => {
      const groundVertexData = this.createGroundVertexData()

      const defs = WGU.makeShaderDataDefinitions(modelShader)
      const modelUniformBindGroupLayout = this.createUniformBindGroupLayout(defs.uniforms.model.size)

      const modelUniformValues = WGU.makeStructuredView(defs.uniforms.model)
      const modelUniformBuffer = this.createModelUniformBuffer(modelUniformValues)
      const modelUniformBindGroup = this.createBindGroup(modelUniformBindGroupLayout, modelUniformBuffer)

      const groundUniformValues = WGU.makeStructuredView(defs.uniforms.model)
      const groundUniformBuffer = this.createGroundUniformBuffer(groundUniformValues)
      const groundUniformBindGroup = this.createBindGroup(modelUniformBindGroupLayout, groundUniformBuffer)

      const depthTextureBindGroupLayout = this.createDepthTextureBindGroupLayout()
      const shadowDepthTexture = this.createShadowDepthTexture()
      const depthTextureBindGroup = this.createDepthTextureBindGroup(depthTextureBindGroupLayout, shadowDepthTexture)
      const shadowPassDescriptor = this.createShadowPassDescriptor(shadowDepthTexture)

      const pipeline = this.createPipeline(
        [this.camera.bindGroupLayout, modelUniformBindGroupLayout, this.light.bindGroupLayout, depthTextureBindGroupLayout],
        [...modelVertexData.bufferLayouts],
      )
      const shadowPipeline = this.createShadowPipeline([this.light.bindGroupLayout, modelUniformBindGroupLayout], [...modelVertexData.bufferLayouts])

      this.render(
        pipeline,
        modelVertexData,
        modelUniformBindGroup,
        groundVertexData,
        groundUniformBindGroup,
        shadowPassDescriptor,
        shadowPipeline,
        depthTextureBindGroup,
      )
      window.addEventListener('resize', this.resize.bind(this))
    })
  }

  // =============================================
  // model data
  // =============================================
  private async loadMedelVertexData() {
    const model = await loadDoracoModel(import.meta.env.BASE_URL + 'models/dragon.drc')
    const geometry = (model.scene.getObjectByName('dragon') as THREE.Mesh).geometry
    return WGU.createBuffersAndAttributesFromArrays(this.device, {
      position: geometry.attributes.position.array,
      normal: geometry.attributes.normal.array,
      indices: geometry.index!.array,
    })
  }

  private createModelUniformBuffer(values: StructuredView) {
    const modelMatrix = mat4.identity()
    mat4.rotation([0, 1, 0], Math.PI / 6, modelMatrix)
    const normalMatrix = mat4.transpose(mat4.inverse(modelMatrix))
    values.set({ modelMatrix, normalMatrix })

    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }

  // =============================================
  // ground data
  // =============================================
  private createGroundVertexData() {
    const geometry = new THREE.PlaneGeometry(5, 5)
    return WGU.createBuffersAndAttributesFromArrays(this.device, {
      position: geometry.attributes.position.array,
      normal: geometry.attributes.normal.array,
      indices: geometry.index!.array,
    })
  }

  private createGroundUniformBuffer(values: StructuredView) {
    const modelMatrix = mat4.rotation([1, 0, 0], -Math.PI / 2)
    mat4.translate(modelMatrix, [0, 0, 0.03], modelMatrix)

    const normalMatrix = mat4.transpose(mat4.inverse(modelMatrix))
    values.set({ modelMatrix, normalMatrix })

    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }
  // =============================================

  private createBindGroup(layout: GPUBindGroupLayout, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: { buffer } }],
    })
  }

  private createCamera() {
    const camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 0.01, far: 20 })
    camera.position = [0, 2, 4]
    camera.target[1] = 0.5
    camera.updateViewMatrix()
    return camera
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

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: modelShader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module,
        buffers: vertexBufferLayouts,
      },
      fragment: {
        module,
        targets: [{ format: this.gpu.presentationFormat }],
        constants: {
          shadowDepthTextureSize: this.shadowDepthTextureSize,
        },
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.scene.pipelineDepthStencilState,
      multisample: this.scene.pipleneMultisampleState,
    })
  }

  // =============================================
  // shadow
  // =============================================
  private readonly shadowDepthTextureSize = 1024 * 2

  private createDepthTextureBindGroupLayout() {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'comparison' },
        },
      ],
    })
  }

  private createDepthTextureBindGroup(layout: GPUBindGroupLayout, shadowDepthTexture: GPUTexture) {
    return this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: shadowDepthTexture.createView() },
        { binding: 1, resource: this.device.createSampler({ compare: 'less' }) },
      ],
    })
  }

  private createShadowDepthTexture() {
    return this.device.createTexture({
      size: [this.shadowDepthTextureSize, this.shadowDepthTextureSize, 1],
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      format: 'depth32float',
    })
  }

  private createShadowPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module: this.device.createShaderModule({ code: shadowShader }),
        buffers: vertexBufferLayouts,
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float',
      },
    })
  }

  private createLightCamera() {
    const frustum = 3
    const camera = new OrthographicCamera(this.device, { left: -frustum, right: frustum, bottom: -frustum, top: frustum, near: 1, far: 30 })
    camera.position = [5, 4, 2]
    camera.updateViewMatrix()
    return camera
  }

  private createShadowPassDescriptor(shadowDepthTexture: GPUTexture): GPURenderPassDescriptor {
    return {
      colorAttachments: [],
      depthStencilAttachment: {
        view: shadowDepthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    }
  }

  // =============================================

  private render(
    pipeline: GPURenderPipeline,
    modelVertexData: BuffersAndAttributes,
    modelUniformBindGroup: GPUBindGroup,
    groundVertexData: BuffersAndAttributes,
    groundUniformBindGroup: GPUBindGroup,
    shadowPassDescriptor: GPURenderPassDescriptor,
    shadowPipeline: GPURenderPipeline,
    depthTextureBindGroup: GPUBindGroup,
  ) {
    const { et } = this.clock.update()

    this.light.position[0] = Math.sin(-et * 1e-3 * 0.3) * this.lightRadius
    this.light.position[2] = Math.cos(-et * 1e-3 * 0.3) * this.lightRadius
    this.light.updateViewMatrix()

    this.scene.update()

    const encoder = this.device.createCommandEncoder()
    {
      // draw depth from light
      const pass = encoder.beginRenderPass(shadowPassDescriptor)
      // common
      pass.setPipeline(shadowPipeline)
      pass.setBindGroup(0, this.light.bindGroup)
      // model
      pass.setVertexBuffer(0, modelVertexData.buffers[0])
      pass.setIndexBuffer(modelVertexData.indexBuffer!, modelVertexData.indexFormat!)
      pass.setBindGroup(1, modelUniformBindGroup)
      pass.drawIndexed(modelVertexData.numElements)
      // ground
      pass.setVertexBuffer(0, groundVertexData.buffers[0])
      pass.setIndexBuffer(groundVertexData.indexBuffer!, groundVertexData.indexFormat!)
      pass.setBindGroup(1, groundUniformBindGroup)
      pass.drawIndexed(groundVertexData.numElements)
      //
      pass.end()
    }
    {
      // draw model
      const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
      // common
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, this.camera.bindGroup)
      pass.setBindGroup(2, this.light.bindGroup)
      pass.setBindGroup(3, depthTextureBindGroup)
      // model
      pass.setVertexBuffer(0, modelVertexData.buffers[0])
      pass.setIndexBuffer(modelVertexData.indexBuffer!, modelVertexData.indexFormat!)
      pass.setBindGroup(1, modelUniformBindGroup)
      pass.drawIndexed(modelVertexData.numElements)
      // ground
      pass.setVertexBuffer(0, groundVertexData.buffers[0])
      pass.setIndexBuffer(groundVertexData.indexBuffer!, groundVertexData.indexFormat!)
      pass.setBindGroup(1, groundUniformBindGroup)
      pass.drawIndexed(groundVertexData.numElements)
      //
      pass.end()
    }
    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(
      this.render.bind(
        this,
        pipeline,
        modelVertexData,
        modelUniformBindGroup,
        groundVertexData,
        groundUniformBindGroup,
        shadowPassDescriptor,
        shadowPipeline,
        depthTextureBindGroup,
      ),
    )
  }

  private resize() {
    this.scene.resize()

    this.camera.aspect = this.resolution.aspect
    this.camera.updateProjectionMatrix()
  }
}
