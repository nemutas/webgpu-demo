import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js'

export async function loadImageBitmap(url: string, colorSpace: ColorSpaceConversion = 'none') {
  const res = await fetch(url)
  const blob = await res.blob()
  return await createImageBitmap(blob, { colorSpaceConversion: colorSpace })
}

export async function loadDoracoModel(path: string) {
  const loader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  loader.setDRACOLoader(dracoLoader)

  const model = await loader.loadAsync(path)
  dracoLoader.dispose()

  return model
}
