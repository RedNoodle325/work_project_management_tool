import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import { drivingMilesToSite, geocodeUSZip } from '@/lib/zipCoordinates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id: siteId } = await params
  await ensureOpsSchema()

  const siteRows = await sql`
    SELECT latitude, longitude, postal_code FROM public.sites WHERE id = ${siteId}
  `
  let site = siteRows[0]

  if (site && (site.latitude == null || site.longitude == null) && site.postal_code) {
    const coordinates = await geocodeUSZip(site.postal_code)
    if (coordinates) {
      const [updated] = await sql`
        update public.sites set latitude = ${coordinates.latitude}, longitude = ${coordinates.longitude}
        where id = ${siteId} returning latitude, longitude, postal_code
      `
      site = updated
    }
  }

  const missingTechCoordinates = await sql`
    select id, home_zip from public.technicians
    where is_active = true and home_zip is not null and (latitude is null or longitude is null)
  `
  await Promise.all(missingTechCoordinates.map(async tech => {
    const coordinates = await geocodeUSZip(tech.home_zip)
    if (coordinates) await sql`
      update public.technicians
      set latitude = ${coordinates.latitude}, longitude = ${coordinates.longitude},
          location_city = coalesce(location_city, ${coordinates.city}), location_state = coalesce(location_state, ${coordinates.state})
      where id = ${tech.id}
    `
  }))

  if (!site || site.latitude == null || site.longitude == null) {
    const techs = await sql`
      SELECT *, NULL::numeric AS distance_miles FROM public.technicians WHERE is_active = true ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST, name ASC
    `
    return NextResponse.json(techs)
  }

  const lat = site.latitude
  const lng = site.longitude

  const techs = await sql`
    SELECT
      t.id, t.name, t.first_name, t.last_name, t.home_zip, t.location_city, t.location_state, t.latitude, t.longitude,
      t.is_active, t.notes, t.created_at, t.updated_at,
      CASE
        WHEN t.latitude IS NOT NULL AND t.longitude IS NOT NULL
          THEN 3958.8 * acos(LEAST(1.0,
            cos(radians(${lat})) * cos(radians(t.latitude)) *
            cos(radians(t.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(t.latitude))
          ))
        ELSE NULL
      END AS distance_miles,
      false AS has_pto
    FROM public.technicians t
    WHERE t.is_active = true
    ORDER BY distance_miles ASC NULLS LAST, t.last_name ASC NULLS LAST, t.first_name ASC NULLS LAST, t.name ASC
  `
  const drivingMiles = await drivingMilesToSite({ latitude: Number(lat), longitude: Number(lng) }, techs)
  return NextResponse.json(techs.map((tech, index) => ({
    ...tech,
    distance_miles: drivingMiles[index] ?? tech.distance_miles,
    distance_kind: drivingMiles[index] == null ? 'straight_line' : 'driving',
  })))
}
