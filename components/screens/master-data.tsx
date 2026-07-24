'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Boxes } from 'lucide-react'
import type { Product, Batch } from '@/lib/types'
import { getAllProducts, getAllBatches } from '@/lib/mock'
import { StatusBadge } from '@/components/ui/status-badge'
import { VersionChip } from '@/components/ui/version-chip'

export function MasterData() {
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')

  useEffect(() => {
    async function loadData() {
      const [productsData, batchesData] = await Promise.all([getAllProducts(), getAllBatches()])
      setProducts(productsData)
      setBatches(batchesData)
      setIsLoading(false)
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-12 w-48 animate-pulse rounded-lg bg-muted"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Master Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage products, batches, and registrations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Batches
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid gap-4">
            {products.map(product => (
              <div
                key={product.id}
                className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.strength} - {product.dosageForm}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={product.status} />
                    <VersionChip version={product.versions.length} label="v" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Active Ingredients</p>
                    <p className="text-foreground font-medium">{product.activeIngredients.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Manufacturing Country</p>
                    <p className="text-foreground font-medium">{product.manufacturingCountry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-foreground font-medium">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches" className="space-y-4">
          <div className="grid gap-4">
            {batches.map(batch => {
              const product = products.find(p => p.id === batch.productId)
              const daysUntilExpiry = Math.ceil(
                (new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
              const isExpired = daysUntilExpiry < 0

              return (
                <div
                  key={batch.id}
                  className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{batch.batchNumber}</h3>
                      <p className="text-sm text-muted-foreground">{product?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={batch.status} />
                      {isExpired && (
                        <div className="px-2 py-1 rounded-full bg-status-error/10 text-status-error text-xs font-medium">
                          Expired
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-foreground font-medium">
                        {batch.quantity} {batch.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-foreground font-medium">{batch.location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Manufacturing</p>
                      <p className="text-foreground font-medium">
                        {new Date(batch.manufacturingDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expiry</p>
                      <p
                        className={`font-medium ${
                          isExpired
                            ? 'text-status-error'
                            : daysUntilExpiry < 180
                              ? 'text-status-warning'
                              : 'text-status-success'
                        }`}
                      >
                        {new Date(batch.expiryDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Quality Tests */}
                  {batch.qualityTestResults && batch.qualityTestResults.length > 0 && (
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Quality Tests</p>
                      <div className="flex flex-wrap gap-2">
                        {batch.qualityTestResults.map(test => (
                          <span
                            key={test.id}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              test.result === 'pass'
                                ? 'bg-status-success/10 text-status-success'
                                : test.result === 'fail'
                                  ? 'bg-status-error/10 text-status-error'
                                  : 'bg-status-warning/10 text-status-warning'
                            }`}
                          >
                            {test.name}: {test.result}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
