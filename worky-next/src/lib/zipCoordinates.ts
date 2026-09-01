export interface ZipCoordinates {
  zip: string
  city: string
  state: string
  latitude: number
  longitude: number
}

export async function geocodeUSZip(value: unknown): Promise<ZipCoordinates | null> {
  const zip = String(value || '').match(/\d{5}/)?.[0]
  if (!zip) return null
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!response.ok) return null
    const payload = await response.json() as {
      places?: Array<{ latitude?: string; longitude?: string; 'place name'?: string; 'state abbreviation'?: string }>
    }
    const place = payload.places?.[0]
    const latitude = Number(place?.latitude)
    const longitude = Number(place?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return {
      zip,
      city: place?.['place name'] || '',
      state: place?.['state abbreviation'] || '',
      latitude,
      longitude,
    }
  } catch {
    return null
  }
}

export async function drivingMilesToSite(
  site: { latitude: number; longitude: number },
  technicians: Array<{ latitude?: number | string | null; longitude?: number | string | null }>,
): Promise<Array<number | null>> {
  const result: Array<number | null> = technicians.map(() => null)
  const located = technicians
    .map((technician, index) => ({ index, latitude: Number(technician.latitude), longitude: Number(technician.longitude) }))
    .filter(technician => Number.isFinite(technician.latitude) && Number.isFinite(technician.longitude))
  if (!located.length) return result

  try {
    const coordinates = [
      `${site.longitude},${site.latitude}`,
      ...located.map(technician => `${technician.longitude},${technician.latitude}`),
    ].join(';')
    const sources = located.map((_, index) => index + 1).join(';')
    const response = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=${sources}&destinations=0&annotations=distance`,
      { signal: AbortSignal.timeout(6500) },
    )
    if (!response.ok) return result
    const payload = await response.json() as { distances?: Array<Array<number | null>> }
    located.forEach((technician, index) => {
      const meters = payload.distances?.[index]?.[0]
      if (typeof meters === 'number') result[technician.index] = meters / 1609.344
    })
  } catch {
    return result
  }
  return result
}
