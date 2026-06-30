'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Building2, ChevronDown, ChevronRight, MapPin, Server, Users } from 'lucide-react'
import type { HierarchyCustomerV2 } from '@/types/v2'

export function HierarchyTree({ customers }: { customers: HierarchyCustomerV2[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set(customers.flatMap(c => [c.id, ...c.locations.map(l => l.id)])))
  const toggle = (id: string) => setOpen(current => {
    const next = new Set(current)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="ops-tree">
      {customers.map(customer => (
        <div key={customer.id} className="ops-tree-group">
          <button className="ops-tree-row ops-tree-customer" onClick={() => toggle(customer.id)}>
            {open.has(customer.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <Users size={16} />
            <span>{customer.name}</span>
            <small>{customer.locations.reduce((count, location) => count + (location.sites?.length || 0), 0)} sites</small>
          </button>
          {open.has(customer.id) && customer.locations.map(location => (
            <div key={location.id} className="ops-tree-location">
              <button className="ops-tree-row" onClick={() => toggle(location.id)}>
                {open.has(location.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <MapPin size={15} />
                <span><strong>{location.campus_code}</strong> · {location.city}, {location.state}</span>
                <small>{location.sites?.length || 0}</small>
              </button>
              {open.has(location.id) && (
                <div className="ops-tree-sites">
                  {location.sites?.map(site => (
                    <Link href={`/sites/${site.id}`} key={site.id} className="ops-tree-site">
                      <span className={`ops-health ops-health-${site.status}`} />
                      <Building2 size={14} />
                      <span>{site.name}</span>
                      <small><Server size={12} /> {site.unit_count}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
