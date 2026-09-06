import { get } from './client'

export interface Country {
  id: string
  isoCode: string
  name: string
}

const MAX_PAGE_SIZE = 100

/**
 * The backend paginates every list endpoint (max 100/page) even for small
 * reference tables like this one — this fetches every page and flattens
 * the result, since the registration wizard's country picker needs the
 * full list (~250 countries), not one page of it.
 */
export async function getAllCountries(): Promise<Country[]> {
  const countries: Country[] = []
  let page = 1
  let totalPages = 1

  do {
    const { data, meta } = await get<Country[]>('/countries', { page, limit: MAX_PAGE_SIZE })
    countries.push(...data)
    totalPages = meta?.totalPages ?? 1
    page += 1
  } while (page <= totalPages)

  return countries
}
