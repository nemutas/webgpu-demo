export async function loadImageBitmap(url: string, colorSpace: ColorSpaceConversion = 'none') {
  const res = await fetch(url)
  const blob = await res.blob()
  return await createImageBitmap(blob, { colorSpaceConversion: colorSpace })
}
